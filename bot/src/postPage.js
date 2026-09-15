// Page publique d'un post (/p/<id>) : aperçu pour les réseaux sociaux (Open Graph) et lecture de la publication
import { splitCategories } from './links.js';

const SITE_NAME = 'biblio3d';
const DESCRIPTION_PREVIEW_LENGTH = 200;

// Robots qui construisent les aperçus de liens (ils lisent la page) ; les visiteurs sont redirigés vers le média.
// Les navigateurs intégrés aux applis (Facebook « FBAN », « LinkedInApp », Instagram…) sont bien des visiteurs.
const PREVIEW_BOTS =
  /facebookexternalhit|facebookcatalog|facebot|linkedinbot|twitterbot|whatsapp\/|pinterest(bot)?\/|telegrambot|slackbot|discordbot|skypeuripreview|redditbot|applebot|googlebot|bingbot|embedly|iframely|vkshare|mastodon|bluesky|w3c_validator/i;

export function isPreviewBot(userAgent) {
  return PREVIEW_BOTS.test(String(userAgent ?? ''));
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function truncate(text, length) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1).trimEnd()}…` : clean;
}

export function youTubeId(url) {
  const match = String(url ?? '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function mediaKind(link) {
  if (link.mediaType === 'video' || /\.mp4(\?|$)/i.test(link.url)) return 'video';
  if (link.mediaType === 'pdf' || /\.pdf(\?|$)/i.test(link.url)) return 'pdf';
  if (youTubeId(link.url)) return 'youtube';
  if (link.mediaType === 'image') return 'image';
  return 'link';
}

// Adresses de partage de chaque réseau (Instagram n'a pas de lien de partage web : copie du lien)
export function shareTargets({ url, title, imageUrl }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { id: 'facebook', label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'x', label: 'X', color: '#000000', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    {
      id: 'pinterest',
      label: 'Pinterest',
      color: '#E60023',
      href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : ''}`,
    },
    { id: 'instagram', label: 'Instagram', color: '#C13584', href: null },
  ];
}

function mediaHtml(link, kind, imageUrl) {
  const title = escapeHtml(link.title);
  const alt = escapeHtml(link.altText || link.title);
  const url = escapeHtml(link.url);

  if (kind === 'video') {
    return `<video class="media" controls playsinline preload="metadata"${imageUrl ? ` poster="${escapeHtml(imageUrl)}"` : ''} src="${url}"></video>`;
  }
  if (kind === 'youtube') {
    return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${youTubeId(link.url)}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const image = imageUrl ? `<img class="media" src="${escapeHtml(imageUrl)}" alt="${alt}">` : '';
  if (kind === 'image') return image;
  const label = kind === 'pdf' ? 'Ouvrir le PDF' : 'Ouvrir le lien';
  return `${image}<p><a class="button primary" href="${url}" target="_blank" rel="noopener">${label}</a></p>`;
}

// previewImageUrl : image 1200 × 630 hébergée sur le VPS (voir preview.js), prioritaire pour les aperçus
export function renderPostPage({ id, link, shareUrl, siteUrl, previewImageUrl = null }) {
  const kind = mediaKind(link);
  const pageImageUrl = link.imageUrl || (kind === 'youtube' ? `https://img.youtube.com/vi/${youTubeId(link.url)}/hqdefault.jpg` : '');
  const imageUrl = previewImageUrl || pageImageUrl;
  const previewDescription = truncate(link.description || `${link.title} — ${link.category ?? ''}`, DESCRIPTION_PREVIEW_LENGTH);
  const title = escapeHtml(link.title);
  const keywords = Array.isArray(link.keywords) ? link.keywords : [];

  const meta = [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', kind === 'video' ? 'video.other' : 'article'],
    ['property', 'og:title', link.title],
    ['property', 'og:description', previewDescription],
    ['property', 'og:url', shareUrl],
    ['property', 'og:locale', 'fr_FR'],
    ...(imageUrl
      ? [
          ['property', 'og:image', imageUrl],
          ...(previewImageUrl
            ? [
                ['property', 'og:image:secure_url', previewImageUrl],
                ['property', 'og:image:type', 'image/jpeg'],
                ['property', 'og:image:width', '1200'],
                ['property', 'og:image:height', '630'],
              ]
            : []),
          ['property', 'og:image:alt', link.altText || link.title],
        ]
      : []),
    ...(kind === 'video'
      ? [
          ['property', 'og:video', link.url],
          ['property', 'og:video:secure_url', link.url],
          ['property', 'og:video:type', 'video/mp4'],
        ]
      : []),
    ['name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', link.title],
    ['name', 'twitter:description', previewDescription],
    ...(imageUrl ? [['name', 'twitter:image', imageUrl]] : []),
    ['name', 'description', previewDescription],
  ]
    .map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`)
    .join('\n  ');

  const shareButtons = shareTargets({ url: shareUrl, title: link.title, imageUrl })
    .map((target) =>
      target.href
        ? `<a class="share" style="--brand:${target.color}" href="${escapeHtml(target.href)}" target="_blank" rel="noopener">${target.label}</a>`
        : `<button class="share" style="--brand:${target.color}" type="button" data-copy="instagram">${target.label}</button>`
    )
    .join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · ${SITE_NAME}</title>
  <link rel="canonical" href="${escapeHtml(shareUrl)}">
  <link rel="icon" href="${escapeHtml(siteUrl)}/icons/icon-192.png">
  ${meta}
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f9fafb; color: #111827; line-height: 1.6; }
    main { max-width: 48rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    header { display: flex; justify-content: center; margin-bottom: 1.5rem; }
    header img { height: 5rem; width: auto; }
    article { background: #fff; border-radius: 0.75rem; box-shadow: 0 1px 3px rgb(0 0 0 / 0.1); overflow: hidden; }
    .media { display: block; width: 100%; max-height: 80vh; object-fit: contain; background: #111827; }
    .embed { position: relative; padding-top: 56.25%; background: #111827; }
    .embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .content { padding: 1.25rem 1.5rem 1.5rem; }
    h1 { font-size: 1.5rem; line-height: 1.3; margin: 0 0 0.75rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; padding: 0; list-style: none; }
    .chips li { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: #eff6ff; color: #1d4ed8; }
    .chips li.category { background: #dbeafe; font-weight: 600; }
    h2 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 1.5rem 0 0.5rem; }
    .shares { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .share { font: inherit; font-size: 0.875rem; font-weight: 600; color: #fff; background: var(--brand); border: 0; border-radius: 0.5rem; padding: 0.45rem 0.9rem; text-decoration: none; cursor: pointer; }
    .share.neutral { --brand: #374151; }
    .button { display: inline-block; font-weight: 600; text-decoration: none; border-radius: 0.5rem; padding: 0.55rem 1rem; }
    .button.primary { background: #2563eb; color: #fff; }
    .back { display: block; text-align: center; margin-top: 1.5rem; color: #2563eb; font-weight: 600; text-decoration: none; }
    .notice { min-height: 1.5rem; font-size: 0.875rem; color: #047857; margin-top: 0.5rem; }
    a:focus-visible, button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
  </style>
</head>
<body>
  <main>
    <header><a href="${escapeHtml(siteUrl)}/"><img src="${escapeHtml(siteUrl)}/logo.png" alt="${SITE_NAME}"></a></header>
    <article>
      ${mediaHtml(link, kind, pageImageUrl)}
      <div class="content">
        <h1>${title}</h1>
        ${link.description ? `<p>${escapeHtml(link.description)}</p>` : ''}
        <ul class="chips">
          ${splitCategories(link.category).map((category) => `<li class="category">${escapeHtml(category)}</li>`).join('')}
          ${keywords.map((keyword) => `<li>${escapeHtml(keyword)}</li>`).join('')}
        </ul>
        <h2>Partager</h2>
        <div class="shares">
          <button class="share neutral" type="button" data-native hidden>Partager…</button>
          ${shareButtons}
          <button class="share neutral" type="button" data-copy="link">Copier le lien</button>
        </div>
        <p class="notice" role="status" aria-live="polite"></p>
      </div>
    </article>
    <a class="back" href="${escapeHtml(siteUrl)}/">← Voir tous les liens</a>
  </main>
  <script>
    (() => {
      const shareUrl = ${JSON.stringify(shareUrl).replace(/</g, '\\u003c')};
      const shareTitle = ${JSON.stringify(link.title).replace(/</g, '\\u003c')};
      const notice = document.querySelector('.notice');
      const native = document.querySelector('[data-native]');
      if (navigator.share) {
        native.hidden = false;
        native.addEventListener('click', () => navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {}));
      }
      document.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            notice.textContent = button.dataset.copy === 'instagram'
              ? 'Lien copié : collez-le dans votre story, votre bio ou un message Instagram.'
              : 'Lien copié.';
          } catch {
            notice.textContent = shareUrl;
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

export function renderNotFoundPage({ siteUrl }) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Publication introuvable · ${SITE_NAME}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f9fafb; color: #111827; text-align: center; padding: 4rem 1rem">
  <h1 style="font-size: 1.5rem">Publication introuvable</h1>
  <p>Cette publication n'existe pas ou n'est pas publique.</p>
  <p><a href="${escapeHtml(siteUrl)}/" style="color: #2563eb; font-weight: 600">Voir tous les liens</a></p>
</body>
</html>`;
}
