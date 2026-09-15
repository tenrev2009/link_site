import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';
import { createLinkFromUrl, extractUrl, splitCategories } from './links.js';
import { createCanvaClient } from './canva.js';
import { createCanvaSync } from './canvaSync.js';
import { ensureMediaDir, serveMedia } from './media.js';
import { createDescriber } from './ai/describe.js';
import { isPreviewBot, renderNotFoundPage, renderPostPage } from './postPage.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { ensurePreview, previewVersion, warmPreviews } from './preview.js';

const PREVIEW_WARM_MINUTES = 15;

const firebaseApp = initializeApp({ credential: cert(config.serviceAccount) });
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const canva = createCanvaClient(db);
const describer = config.ai.enabled ? createDescriber() : null;
const canvaSync = createCanvaSync({ db, canva, describer });

const STATUSES = new Set(['pending', 'private', 'public']);
const MAX_BODY_BYTES = 16_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// Page affichée dans le navigateur au retour de Canva
function sendHtml(res, status, title, message) {
  const adminUrl = `${config.allowedOrigins[0] ?? ''}/admin`;
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #111827; line-height: 1.5">
  <h1 style="font-size: 1.5rem">${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="${escapeHtml(adminUrl)}" style="color: #2563eb; font-weight: 600">Retour à l'admin</a></p>
</body>
</html>`);
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

// Jeton API (automatisations) ou jeton de connexion Firebase du compte admin (site)
async function authenticate(req) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new HttpError(401, 'Authentification requise');

  if (config.apiToken && safeEqual(token, config.apiToken)) return 'jeton API';

  if (config.adminEmail) {
    try {
      const decoded = await auth.verifyIdToken(token);
      if (decoded.email?.toLowerCase() === config.adminEmail) return decoded.email;
    } catch {
      // Jeton Firebase invalide ou expiré
    }
  }

  throw new HttpError(401, 'Accès refusé');
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Requête trop volumineuse');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON invalide');
  }
}

async function handleAddLink(req, res) {
  const author = await authenticate(req);
  const body = await readJson(req);

  // `text` : texte partagé depuis une appli (« Regarde mon design https://canva.link/… »)
  const url = extractUrl(body.url) ?? extractUrl(body.text) ?? extractUrl(body.title);
  if (!url) throw new HttpError(422, 'Aucun lien http(s) trouvé dans le texte envoyé');

  const status = STATUSES.has(body.status) ? body.status : 'pending';
  const category = typeof body.category === 'string' ? splitCategories(body.category).join(', ').slice(0, 120) : '';

  const result = await createLinkFromUrl(db, { url, status, category });
  console.log(
    `[links] ${result.created ? 'ajouté' : 'déjà présent'} : ${result.link.url} (${result.link.status}, ${author})`
  );
  sendJson(res, result.created ? 201 : 200, result);
}

async function handleCanvaStatus(req, res) {
  await authenticate(req);
  const [connection, sync] = await Promise.all([canva.status(), canvaSync.status()]);
  sendJson(res, 200, {
    ...connection,
    ...sync,
    folderId: config.canva.folderId,
    syncMinutes: config.canva.syncMinutes,
  });
}

async function handleCanvaConnect(req, res) {
  await authenticate(req);
  if (!canva.isConfigured()) throw new HttpError(503, 'Ajoutez CANVA_CLIENT_SECRET dans Coolify pour activer Canva');
  sendJson(res, 200, { url: await canva.startAuthorization() });
}

async function handleCanvaSync(req, res) {
  await authenticate(req);
  if (!(await canva.status()).connected) throw new HttpError(409, 'Canva n\'est pas connecté');
  // La synchro peut durer plusieurs minutes (exports vidéo) : l'admin suit l'avancement via /canva/status
  canvaSync.runSync('manuelle').catch(() => {});
  sendJson(res, 202, { started: true });
}

// Page de partage d'un post public : lue par les réseaux sociaux pour construire l'aperçu
async function handlePostPage(req, res, linkId, searchParams) {
  const siteUrl = config.allowedOrigins[0] ?? '';
  const link = (await db.collection('links').doc(linkId).get()).data();
  const found = link?.status === 'public';

  // Un visiteur qui clique sur l'aperçu arrive directement sur la vidéo (ou le PDF, l'image, YouTube).
  // Seuls les robots des réseaux lisent la page ; « ?apercu=1 » l'affiche pour vérification.
  if (found && link.url && !isPreviewBot(req.headers['user-agent']) && !searchParams.has('apercu')) {
    res.writeHead(302, { Location: link.url, 'Cache-Control': 'no-store', Vary: 'User-Agent' });
    res.end();
    return;
  }

  // Image d'aperçu 1200 × 630 hébergée ici ; en cas d'échec, l'image d'origine du lien sert de secours
  let previewImageUrl = null;
  if (found) {
    try {
      await ensurePreview(linkId, link);
      previewImageUrl = `${config.shareBaseUrl}/p/${linkId}/apercu-${previewVersion(link)}.jpg`;
    } catch (err) {
      console.error(`[aperçu] « ${link.title} » : ${err.message}`);
    }
  }

  const html = found
    ? renderPostPage({ id: linkId, link, shareUrl: `${config.shareBaseUrl}/p/${linkId}`, siteUrl, previewImageUrl })
    : renderNotFoundPage({ siteUrl });

  res.writeHead(found ? 200 : 404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': found ? 'public, max-age=300' : 'no-store',
    Vary: 'User-Agent',
  });
  res.end(req.method === 'HEAD' ? undefined : html);
}

// Image d'aperçu d'un post public (le numéro de version dans l'adresse force les réseaux à la recharger)
async function handlePreviewImage(req, res, linkId) {
  const link = (await db.collection('links').doc(linkId).get()).data();
  if (link?.status !== 'public') throw new HttpError(404, 'Aperçu introuvable');

  const file = await ensurePreview(linkId, link);
  const { size } = await stat(file);
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': size,
    'Cache-Control': 'public, max-age=604800',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

async function handleRedescribe(req, res, linkId) {
  await authenticate(req);
  if (!describer) throw new HttpError(503, 'Ajoutez ANTHROPIC_API_KEY dans Coolify pour activer les fiches rédigées par Claude');
  const fields = await canvaSync.redescribeLink(linkId);
  console.log(`[claude] fiche régénérée : ${linkId}`);
  sendJson(res, 200, fields);
}

async function handleCanvaCallback(res, searchParams) {
  const error = searchParams.get('error');
  if (error) {
    sendHtml(res, 400, 'Connexion Canva annulée', `Canva a répondu : ${error}. Vous pouvez réessayer depuis l'admin.`);
    return;
  }

  try {
    await canva.completeAuthorization({ code: searchParams.get('code'), state: searchParams.get('state') });
  } catch (err) {
    console.error('[canva] connexion échouée :', err.message);
    sendHtml(res, 400, 'Connexion Canva impossible', err.message);
    return;
  }

  console.log('[canva] compte connecté');
  canvaSync.runSync('après connexion').catch(() => {});
  sendHtml(
    res,
    200,
    'Canva est connecté ✅',
    `Le dossier est surveillé toutes les ${config.canva.syncMinutes} minutes. Les nouveaux designs apparaîtront dans « À valider ».`
  );
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${pathname}`;

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/media/')) {
      if (await serveMedia(req, res, pathname.slice('/media/'.length))) return;
      throw new HttpError(404, 'Fichier introuvable');
    }
    const previewImage =
      (req.method === 'GET' || req.method === 'HEAD') && pathname.match(/^\/p\/([A-Za-z0-9_-]{1,200})\/apercu-[0-9a-f]{10}\.jpg$/);
    if (previewImage) {
      await handlePreviewImage(req, res, previewImage[1]);
      return;
    }
    const post = (req.method === 'GET' || req.method === 'HEAD') && pathname.match(/^\/p\/([A-Za-z0-9_-]{1,200})\/?$/);
    if (post) {
      await handlePostPage(req, res, post[1], searchParams);
      return;
    }
    const redescribe = req.method === 'POST' && pathname.match(/^\/links\/([A-Za-z0-9_-]{1,200})\/describe$/);
    if (redescribe) {
      await handleRedescribe(req, res, redescribe[1]);
      return;
    }

    switch (route) {
      case 'GET /health':
        sendJson(res, 200, { ok: true });
        return;
      case 'POST /links':
        await handleAddLink(req, res);
        return;
      case 'GET /canva/status':
        await handleCanvaStatus(req, res);
        return;
      case 'POST /canva/connect':
        await handleCanvaConnect(req, res);
        return;
      case 'POST /canva/sync':
        await handleCanvaSync(req, res);
        return;
      case 'GET /canva/callback':
        await handleCanvaCallback(res, searchParams);
        return;
      default:
        throw new HttpError(404, 'Introuvable');
    }
  } catch (err) {
    const status = err instanceof HttpError || err?.status === 404 ? err.status : 500;
    if (status === 500) console.error('[erreur]', err);
    sendJson(res, status, { error: status === 500 ? 'Erreur interne du service' : err.message });
  }
});

server.listen(config.port, () => {
  console.log(`links-bot prêt sur le port ${config.port} (origines autorisées : ${config.allowedOrigins.join(', ')})`);
  if (!config.adminEmail && !config.apiToken) {
    console.warn('Ni ADMIN_EMAIL ni API_TOKEN définis : toutes les requêtes seront refusées');
  }

  ensureMediaDir().catch((err) => {
    console.error(`[media] dossier ${config.mediaDir} inaccessible en écriture : ${err.message}`);
  });

  console.log(
    describer
      ? `[claude] fiches rédigées avec ${config.ai.model}, transcription ${config.ai.whisperModel}`
      : '[claude] ANTHROPIC_API_KEY absente : fiches non rédigées'
  );

  // Aperçus des posts publics préparés à l'avance : WhatsApp et Facebook n'attendent pas longtemps
  const warm = () => warmPreviews(db).catch((err) => console.error(`[aperçu] préparation impossible : ${err.message}`));
  setTimeout(warm, 30_000);
  setInterval(warm, PREVIEW_WARM_MINUTES * 60_000);

  if (canva.isConfigured()) {
    canvaSync.startScheduler();
    console.log(`[canva] surveillance du dossier ${config.canva.folderId} toutes les ${config.canva.syncMinutes} min`);
  } else {
    console.log('[canva] CANVA_CLIENT_SECRET absent : import Canva désactivé');
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
