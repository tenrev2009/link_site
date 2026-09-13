// Configuration lue dans les variables d'environnement (onglet « Environment Variables » de Coolify)

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    throw new Error('Variable FIREBASE_SERVICE_ACCOUNT manquante (contenu du fichier JSON de la clé Firebase)');
  }
  // Accepte le JSON collé tel quel, ou encodé en base64
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
};
