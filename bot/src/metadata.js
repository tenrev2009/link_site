// Récupère titre, description et image d'une page (balises Open Graph)

// Canva renvoie une page « Unsupported client » aux user-agents qu'il ne reconnaît pas
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_500_000;

const EMPTY = { title: '', description: '', imageUrl: '' };

export async function fetchMetadata(inputUrl) {
  const response = await fetch(inputUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  const finalUrl = response.url || inputUrl;
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || !contentType.includes('html')) {
    await response.body?.cancel();
    return { finalUrl, ...EMPTY };
  }

  const html = await readLimited(response, MAX_HTML_BYTES);
  return { finalUrl, ...parseHtmlMetadata(html, finalUrl) };
}

async function readLimited(response, maxBytes) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let received = 0;

  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }

  await reader.cancel().catch(() => {});
  return html;
}

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const IGNORED_TITLES = /unsupported client/i;

export function parseHtmlMetadata(html, baseUrl) {
  const meta = new Map();

  for (const [tag] of html.matchAll(META_TAG)) {
    const attrs = {};
    for (const match of tag.matchAll(ATTRIBUTE)) {
      attrs[match[1].toLowerCase()] = match[2] ?? match[3];
    }
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    const content = decodeEntities(attrs.content ?? '').trim();
    // Garde la première valeur non vide pour chaque clé
    if (key && content && !meta.get(key)) meta.set(key, content);
  }

  const pick = (...keys) => keys.map((key) => meta.get(key)).find(Boolean) ?? '';
  const titleTag = decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();

  let title = pick('og:title', 'twitter:title') || titleTag;
  if (IGNORED_TITLES.test(title)) title = '';

  const image = pick('og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src');

  return {
    title,
    description: pick('og:description', 'twitter:description', 'description'),
    imageUrl: image ? toAbsoluteUrl(image, baseUrl) : '',
  };
}

// Canva bloque la lecture directe de ses pages par un serveur (403), mais son oEmbed répond
const CANVA_OEMBED_URL = 'https://www.canva.com/_oembed';
const CANVA_DEFAULT_TITLES = /^(untitled|design sans titre)$/i;

export async function fetchCanvaOembed(designUrl) {
  const response = await fetch(`${CANVA_OEMBED_URL}?format=json&url=${encodeURIComponent(designUrl)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`oEmbed Canva : HTTP ${response.status}`);

  const data = await response.json();
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  return {
    title: CANVA_DEFAULT_TITLES.test(title) ? '' : title,
    imageUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
  };
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const isHex = code[1].toLowerCase() === 'x';
      const codePoint = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}
