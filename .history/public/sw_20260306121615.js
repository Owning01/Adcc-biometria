const CACHE_NAME = 'adcc-v3-dynamic'; // Cambiamos el nombre para invalidar el anterior
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    // Forzar activación inmediata
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    // Tomar control de todos los clientes inmediatamente
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Borrar cachés viejas
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log('Borrand caché vieja:', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // ESTRATEGIA: Network First (Red primero, luego caché si falla)
    // Esto asegura que siempre se busque la última versión si hay internet.
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' || event.request.url.startsWith('chrome-extension')) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                const url = new URL(event.request.url);

                // Solo cachear esquemas http/https
                if (url.protocol === 'http:' || url.protocol === 'https:') {
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            cache.put(event.request, responseToCache);
                        } catch (e) {
                            console.warn('Cache put failed:', e);
                        }
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || new Response('Network error occurred', {
                        status: 408,
                        statusText: 'Network error occurred',
                    });
                });
            })
    );
});
