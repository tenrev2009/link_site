// Service worker minimal : rend le site installable pour apparaître dans le menu « Partager » d'Android.
// Aucune mise en cache : toutes les requêtes passent par le réseau normalement.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
