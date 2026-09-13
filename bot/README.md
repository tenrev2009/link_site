# links-bot

Service qui alimente le site de liens :

- **Ajout par lien** : reçoit un lien (Canva, YouTube, site web), récupère son titre et son image
  et l'ajoute dans Firestore (`links`) avec le statut **À valider**.
- **Import automatique Canva** : surveille un dossier Canva ; chaque nouveau design est exporté
  (MP4 si son nom contient `[vidéo]`, sinon PNG), stocké sur le VPS et ajouté **À valider**.

## API

Routes protégées : en-tête `Authorization: Bearer <jeton>` (jeton de connexion Firebase du compte admin, ou `API_TOKEN`).

| Route | Rôle |
|---|---|
| `GET /health` | État du service |
| `POST /links` | Ajoute un lien : `{ "url": "…" }` ou `{ "text": "…" }`, optionnel `category`, `status` |
| `GET /canva/status` | Connexion Canva et dernière synchro (protégée) |
| `POST /canva/connect` | Renvoie l'adresse d'autorisation Canva (protégée) |
| `POST /canva/sync` | Lance une synchro immédiate (protégée) |
| `GET /canva/callback` | Retour OAuth de Canva |
| `GET /media/<fichier>` | Vidéos et images exportées |

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Clé de compte de service Firebase (JSON, ou base64 sur une ligne) |
| `ADMIN_EMAIL` | Adresse du compte admin autorisé depuis le site |
| `ALLOWED_ORIGINS` | Sites autorisés à appeler l'API (défaut : `https://links.biblio3d.net`) |
| `CANVA_CLIENT_SECRET` | Secret de l'intégration Canva : active l'import automatique |
| `CANVA_CLIENT_ID` | Défaut : `OC-AaCcDmTgWYM6` |
| `CANVA_FOLDER_ID` | Dossier surveillé (défaut : `FAHVGvWXsZk`, « Site ») |
| `CANVA_SYNC_MINUTES` | Fréquence de synchro (défaut : `15`) |
| `PUBLIC_URL` | Adresse publique du service (défaut : `https://links-api.biblio3d.net`) |
| `MEDIA_DIR` | Dossier des exports (défaut : `/data/media`) |
| `API_TOKEN` | Optionnel : jeton pour des automatisations (n8n…) |

## Déploiement Coolify

Application « Public Repository » sur ce dépôt, Build Pack **Dockerfile**, Base Directory **/bot**,
port **3000**, domaine `https://links-api.biblio3d.net`.

**Persistent Storage** : un *Volume Mount* sur `/data`, sinon les exports sont perdus à chaque déploiement.

Intégration Canva (portail développeurs) : scopes `folder:read`, `design:meta:read`, `design:content:read`,
adresse de retour `https://links-api.biblio3d.net/canva/callback`.
