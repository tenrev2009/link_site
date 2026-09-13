// Client Canva Connect : connexion OAuth (PKCE), jetons stockés dans Firestore, dossiers et exports
import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

const API_URL = 'https://api.canva.com/rest/v1';
const AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_SCOPES = 'folder:read design:meta:read design:content:read';

const PENDING_MAX_AGE_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const EXPORT_POLL_MS = 3_000;
const EXPORT_TIMEOUT_MS = 10 * 60_000;

export class CanvaError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createCanvaClient(db) {
  // Documents lisibles uniquement côté serveur (les règles Firestore bloquent le reste)
  const tokensDoc = db.collection('integrations').doc('canva');
  const pendingDoc = db.collection('integrations').doc('canvaPending');
  const redirectUri = `${config.publicUrl}/canva/callback`;
  let refreshing = null;

  const isConfigured = () => Boolean(config.canva.clientSecret);

  async function requestToken(params) {
    const credentials = Buffer.from(`${config.canva.clientId}:${config.canva.clientSecret}`).toString('base64');
    const response = await fetch(`${API_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new CanvaError(`Jeton Canva refusé : ${body.error_description ?? body.error ?? response.status}`, {
        status: response.status,
        code: body.error,
      });
    }
    return body;
  }

  async function saveTokens(tokens, extra = {}) {
    const now = Date.now();
    await tokensDoc.set(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: now + (tokens.expires_in ?? 14_400) * 1000,
        scope: tokens.scope ?? '',
        updatedAt: new Date(now).toISOString(),
        ...extra,
      },
      { merge: true }
    );
  }

  async function startAuthorization() {
    if (!isConfigured()) throw new CanvaError('CANVA_CLIENT_SECRET manquant sur le serveur', { status: 503 });

    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    await pendingDoc.set({ state, verifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      code_challenge_method: 's256',
      response_type: 'code',
      client_id: config.canva.clientId,
      redirect_uri: redirectUri,
      scope: CANVA_SCOPES,
      code_challenge: challenge,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, '%20')}`;
  }

  async function completeAuthorization({ code, state }) {
    const pending = (await pendingDoc.get()).data();
    // Le state aléatoire garantit que la connexion a été lancée depuis l'admin
    if (!pending || !state || pending.state !== state || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
      throw new CanvaError('Demande de connexion expirée ou invalide : relancez « Connecter Canva » depuis l\'admin.');
    }
    await pendingDoc.delete();

    const tokens = await requestToken({
      grant_type: 'authorization_code',
      code: code ?? '',
      code_verifier: pending.verifier,
      redirect_uri: redirectUri,
    });
    await saveTokens(tokens, { connectedAt: new Date().toISOString() });
  }

  async function getStoredTokens() {
    const data = (await tokensDoc.get()).data();
    return data?.refreshToken ? data : null;
  }

  async function getAccessToken() {
    const stored = await getStoredTokens();
    if (!stored) throw new CanvaError('Canva n\'est pas connecté', { code: 'not_connected' });
    if (stored.accessToken && stored.accessTokenExpiresAt - Date.now() > 60_000) return stored.accessToken;

    // Les refresh tokens Canva sont à usage unique : un seul renouvellement à la fois
    refreshing ??= (async () => {
      try {
        const tokens = await requestToken({ grant_type: 'refresh_token', refresh_token: stored.refreshToken });
        await saveTokens(tokens);
        return tokens.access_token;
      } catch (err) {
        if (err.code === 'invalid_grant') await tokensDoc.delete();
        throw err;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function api(path, { method = 'GET', body } = {}) {
    const token = await getAccessToken();
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new CanvaError(`API Canva (${method} ${path.split('?')[0]}) : ${data.message ?? data.code ?? response.status}`, {
        status: response.status,
        code: data.code,
      });
    }
    return data;
  }

  // itemType : « design » ou « folder »
  async function listFolderItems(folderId, itemType) {
    const items = [];
    let continuation;
    do {
      const params = new URLSearchParams({ item_types: itemType, limit: '100' });
      if (continuation) params.set('continuation', continuation);
      const page = await api(`/folders/${encodeURIComponent(folderId)}/items?${params}`);
      for (const item of page.items ?? []) {
        if (item.type === itemType && item[itemType]) items.push(item[itemType]);
      }
      continuation = page.continuation;
    } while (continuation);
    return items;
  }

  // Lance un export et attend sa fin ; renvoie les URL de téléchargement (valables 24 h)
  async function exportDesign(designId, format) {
    let { job } = await api('/exports', { method: 'POST', body: { design_id: designId, format } });
    const deadline = Date.now() + EXPORT_TIMEOUT_MS;

    while (job.status === 'in_progress') {
      if (Date.now() > deadline) throw new CanvaError('Export Canva trop long (plus de 10 minutes)');
      await new Promise((resolve) => setTimeout(resolve, EXPORT_POLL_MS));
      ({ job } = await api(`/exports/${encodeURIComponent(job.id)}`));
    }

    if (job.status !== 'success' || !job.urls?.length) {
      throw new CanvaError(`Export Canva échoué : ${job.error?.message ?? job.error?.code ?? job.status}`, {
        code: job.error?.code,
      });
    }
    return job.urls;
  }

  async function status() {
    const stored = await getStoredTokens();
    return {
      configured: isConfigured(),
      connected: Boolean(stored),
      connectedAt: stored?.connectedAt ?? null,
    };
  }

  return { isConfigured, startAuthorization, completeAuthorization, listFolderItems, exportDesign, status };
}
