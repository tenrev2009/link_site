# links-bot

Petit service qui reçoit un lien (Canva, YouTube, site web), récupère son titre et son image,
et l'ajoute dans Firestore (`links`) avec le statut **À valider**.

## API

- `GET /health` : état du service
- `POST /links` : ajoute un lien
  - En-tête `Authorization: Bearer <jeton>` : jeton de connexion Firebase du compte admin, ou `API_TOKEN`
  - Corps JSON : `{ "url": "…" }` ou `{ "text": "texte contenant un lien" }`,
    optionnel `"category"` et `"status"` (`pending` par défaut, `private`, `public`)
  - Réponse `201` si ajouté, `200` si le lien existait déjà

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Contenu du fichier JSON de la clé de compte de service Firebase |
| `ADMIN_EMAIL` | Adresse du compte admin autorisé depuis le site |
| `ALLOWED_ORIGINS` | Sites autorisés à appeler l'API (défaut : `https://links.biblio3d.net`) |
| `API_TOKEN` | Optionnel : jeton pour des automatisations (n8n…) |
| `PORT` | Défaut : `3000` |

## Déploiement Coolify

Application « Public Repository » sur ce dépôt, Build Pack **Dockerfile**, Base Directory **/bot**,
port **3000**, domaine `https://links-api.biblio3d.net`.
