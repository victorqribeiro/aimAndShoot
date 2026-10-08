// The game no longer uses a service worker. Browsers that installed the old
// one (cache-first, including API calls) pick up this version, which deletes
// only its own cache and unregisters itself. Other apps' caches are untouched.

self.addEventListener('install', event => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.delete('aimAndShoot-v1')
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});
