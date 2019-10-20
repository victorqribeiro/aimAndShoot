const filesToCache = [
    	'./',
      './index.html',
      './js/main.js',
      './js/Matrix.js',
      './js/Dejavu.js',
      './js/Genetics.js',
      './js/Player.js',
      './js/Bullet.js',
      './css/main.css',
      './sounds/shoot.mp3',
      './favicon.png',
      './artwork.png',
      './manifest.json'
 ];

const staticCacheName = 'aimAndShoot-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName)
    .then(cache => {
      return cache.addAll(filesToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
    .then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request)

			.then(response => {
				return caches.open(staticCacheName).then(cache => {
					cache.put(event.request.url, response.clone());
					return response;
				});
			});

    }).catch(error => {})
  );
});

self.addEventListener('activate', event => {

  const cacheWhitelist = [staticCacheName];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
