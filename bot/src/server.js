import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';
import { createLinkFromUrl, extractUrl } from './links.js';

const firebaseApp = initializeApp({ credential: cert(config.serviceAccount) });
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 50) : '';

  const result = await createLinkFromUrl(db, { url, status, category });
  console.log(
    `[links] ${result.created ? 'ajouté' : 'déjà présent'} : ${result.link.url} (${result.link.status}, ${author})`
  );
  sendJson(res, result.created ? 201 : 200, result);
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && pathname === '/links') {
      await handleAddLink(req, res);
      return;
    }
    throw new HttpError(404, 'Introuvable');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[erreur]', err);
    sendJson(res, status, { error: status === 500 ? 'Erreur interne du service' : err.message });
  }
});

server.listen(config.port, () => {
  console.log(`links-bot prêt sur le port ${config.port} (origines autorisées : ${config.allowedOrigins.join(', ')})`);
  if (!config.adminEmail && !config.apiToken) {
    console.warn('Ni ADMIN_EMAIL ni API_TOKEN définis : toutes les requêtes seront refusées');
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
