const CACHE_NAME = 'tetris-pwa-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './stats.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './screenshot-wide.png',
  './screenshot-narrow.png',
  './js/game.js',
  './js/Tracker.js',
  './js/SFX.js',
  './js/stats-panel.js',
  './js/firebase-config.js',
  './js/websocket-client.js'
];

// Install Event - Caches assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Cleans up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serves from cache or network
self.addEventListener('fetch', (event) => {
  // Solo procesar peticiones GET y evitar peticiones a APIs externas si no queremos cachearlas
  if (event.request.method !== 'GET') return;
  
  // Estrategia Cache First, falling back to Network
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Si no está en caché, ir a la red
        return fetch(event.request).then(
          (response) => {
            // Verificar respuesta válida antes de cachear si quisiéramos cachear dinámicamente
            // (por ahora solo devolvemos la respuesta de red)
            return response;
          }
        ).catch(() => {
          // Si la red falla y no está en caché (ej. una ruta desconocida), podemos devolver un fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
