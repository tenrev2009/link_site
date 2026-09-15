// Configuration lue dans les variables d'environnement (onglet « Environment Variables » de Coolify)

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    throw new Error('Variable FIREBASE_SERVICE_ACCOUNT manquante (contenu du fichier JSON de la clé Firebase)');
  }
  // Accepte le JSON collé tel quel, ou encodé en base64 (une seule ligne, pour Coolify)
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ne contient pas un JSON valide');
  }
}

function readList(value, fallback) {
  return (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  serviceAccount: readServiceAccount(),
  // Compte autorisé via la connexion Firebase du site (admin, page /partager)
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  // Jeton optionnel pour les automatisations sans connexion Firebase (n8n, raccourcis…)
  apiToken: process.env.API_TOKEN?.trim() || null,
  allowedOrigins: readList(process.env.ALLOWED_ORIGINS, 'https://links.biblio3d.net'),
  // Adresse publique du service : liens des fichiers exportés et retour OAuth Canva
  publicUrl: (process.env.PUBLIC_URL?.trim() || 'https://links-api.biblio3d.net').replace(/\/+$/, ''),
  // Adresse des pages de partage /p/<id> (un autre domaine pointant vers ce service est possible)
  shareBaseUrl: (process.env.SHARE_BASE_URL?.trim() || process.env.PUBLIC_URL?.trim() || 'https://links-api.biblio3d.net').replace(/\/+$/, ''),
  // Vidéos et images exportées depuis Canva (volume persistant dans Coolify)
  mediaDir: process.env.MEDIA_DIR?.trim() || '/data/media',
  canva: {
    clientId: process.env.CANVA_CLIENT_ID?.trim() || 'OC-AaCcDmTgWYM6',
    clientSecret: process.env.CANVA_CLIENT_SECRET?.trim() || null,
    // Dossier « Site » : https://www.canva.com/folder/FAHVGvWXsZk
    folderId: process.env.CANVA_FOLDER_ID?.trim() || 'FAHVGvWXsZk',
    syncMinutes: Number(process.env.CANVA_SYNC_MINUTES) || 15,
  },
  // Fiches rédigées par Claude (descriptif, mots-clés, catégorie, texte alternatif)
  ai: {
    // Le SDK Anthropic lit lui-même ANTHROPIC_API_KEY
    enabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    model: process.env.CLAUDE_MODEL?.trim() || 'claude-opus-5',
    // Transcription des commentaires et interviews des vidéos, exécutée sur le VPS
    whisperModel: process.env.WHISPER_MODEL?.trim() || 'onnx-community/whisper-base',
    modelCacheDir: process.env.MODEL_CACHE_DIR?.trim() || '/data/models',
    maxAudioSeconds: Number(process.env.MAX_AUDIO_SECONDS) || 600,
  },
};
