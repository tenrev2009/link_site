import { createHash } from 'node:crypto';
import { fetchCanvaOembed, fetchMetadata } from './metadata.js';

// Paramètres de suivi retirés des URL (utlId : liens de partage Canva, si : YouTube)
const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|utlid|si|feature)$/i;
const FIRESTORE_ALREADY_EXISTS = 6;

export function extractUrl(text) {
  const match = String(text ?? '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;!?]+$/, '') : null;
}

export function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

// Type de lien : clé anti-doublon, catégorie et icône par défaut
export function identify(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^(www|m)\./, '');

  if (host === 'canva.com') {
    const [, designId, token] = parsed.pathname.match(/^\/design\/([^/]+)\/([^/]+)/) ?? [];
    return {
      key: designId ? `canva:${designId}` : url,
      category: 'Canva',
      iconName: 'Image',
      source: 'canva',
      // Miniature publique d'un design partagé, déduite de son adresse
      fallbackImageUrl: designId ? `https://www.canva.com/design/${designId}/${token}/screen?type=thumbnail` : '',
      fallbackTitle: 'Design Canva',
    };
  }

  if (host === 'youtube.com' || host === 'youtu.be') {
    const videoId =
      host === 'youtu.be'
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get('v') ?? parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    return { key: videoId ? `youtube:${videoId}` : url, category: 'Vidéos', iconName: 'Youtube', source: 'youtube' };
  }

  if (host === 'github.com') {
    return { key: url, category: 'GitHub', iconName: 'Github', source: 'github' };
  }

  return { key: url, category: 'Liens', iconName: 'Link', source: 'web' };
}

function toSummary(id, data) {
  const { title, url, imageUrl, category, status } = data;
  return { id, title, url, imageUrl, category, status };
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err));

// Suit les redirections (canva.link…) et récupère titre, description et image
export async function resolveLink(inputUrl) {
  let metadata;
  let metadataError = null;
  try {
    metadata = await fetchMetadata(inputUrl);
  } catch (err) {
    // Page injoignable : on crée quand même le lien, il sera complété à la validation
    metadataError = errorMessage(err);
    metadata = { finalUrl: inputUrl, title: '', description: '', imageUrl: '' };
  }

  const url = normalizeUrl(metadata.finalUrl);
  const kind = identify(url);

  if (kind.source === 'canva') {
    try {
      const oembed = await fetchCanvaOembed(url);
      metadata.title = oembed.title || metadata.title;
      metadata.imageUrl = oembed.imageUrl || metadata.imageUrl;
      metadataError = null;
    } catch (err) {
      metadataError = errorMessage(err);
    }
  }

  const hostname = new URL(url).hostname.replace(/^www\./, '');
  return {
    url,
    kind,
    title: metadata.title || kind.fallbackTitle || hostname,
    description: metadata.description,
    imageUrl: metadata.imageUrl || kind.fallbackImageUrl || '',
    metadataError,
  };
}

// Identifiant du document d'un lien ajouté par partage (clé anti-doublon, ex. « canva:DAHUcF7LBG8 »)
export function shareLinkId(key) {
  return `auto-${createHash('sha1').update(key).digest('hex').slice(0, 20)}`;
}

// Les liens sont triés par priorité croissante : un nouveau lien passe devant tous les autres
export async function topPriority(links) {
  const priorities = (await links.get()).docs
    .map((doc) => doc.data().priority)
    .filter((priority) => Number.isFinite(priority));
  return priorities.length > 0 ? Math.min(...priorities) - 1 : 0;
}

export async function createLinkFromUrl(db, { url: inputUrl, status, category }) {
  const { url, kind, title, description, imageUrl, metadataError } = await resolveLink(inputUrl);
  const links = db.collection('links');
  const docRef = links.doc(shareLinkId(kind.key));

  const existingById = await docRef.get();
  const existing = existingById.exists
    ? existingById
    : (await links.where('url', '==', url).limit(1).get()).docs[0];
  if (existing) {
    return { created: false, link: toSummary(existing.id, existing.data()) };
  }

  const priority = await topPriority(links);
  const now = new Date().toISOString();
  const data = {
    title,
    url,
    description,
    imageUrl,
    category: category || kind.category,
    iconName: kind.iconName,
    priority,
    status,
    source: kind.source,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await docRef.create(data);
  } catch (err) {
    // Deux envois simultanés du même lien
    if (err?.code === FIRESTORE_ALREADY_EXISTS) {
      const snapshot = await docRef.get();
      return { created: false, link: toSummary(snapshot.id, snapshot.data()) };
    }
    throw err;
  }

  return { created: true, metadataError, link: toSummary(docRef.id, data) };
}
