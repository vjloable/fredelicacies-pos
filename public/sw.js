/**
 * Fredelecacies POS — Image Service Worker
 *
 * Strategy: Cache-First for all image requests.
 * - Optimized images from Next.js (/_next/image?...)
 * - Raw images from Supabase storage (*.supabase.co/storage/...)
 * - Static public assets (*.png, *.jpg, *.svg, *.webp, *.avif)
 *
 * "New replacement" is automatic: Supabase upload URLs always include a
 * Date.now() timestamp, so a replaced image = new URL = cache miss = fresh fetch.
 */

const CACHE_NAME = 'frede-images-v1';

const IMAGE_PATTERNS = [
  /\/_next\/image(\?.*)?$/,
  /\.supabase\.co\/storage\/v1\/object\/public\//,
  /\.(png|jpg|jpeg|webp|avif|svg|gif)(\?.*)?$/,
];

function isImageRequest(request) {
  if (request.method !== 'GET') return false;
  const url = request.url;
  return IMAGE_PATTERNS.some((p) => p.test(url));
}

// On install: skip waiting so the SW activates immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activate: delete old image cache versions and claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('frede-images-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-First: serve from cache, fall back to network and store result
self.addEventListener('fetch', (event) => {
  if (!isImageRequest(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            // Only cache valid responses (not errors, not opaque cross-origin)
            if (response.ok && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached ?? new Response('', { status: 503 }));
      })
    )
  );
});
