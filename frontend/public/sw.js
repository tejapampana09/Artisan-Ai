/* Artisan AI PWA Service Worker v1.0.7 */
const CACHE_NAME = 'artisan-ai-cache-v7';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('artisan-ai-cache-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache API data, authenticated responses or third-party requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname === '/api' || url.pathname.startsWith('/api/') ||
      request.headers.has('Authorization')) return;
  // Only cache the app shell and immutable build assets.
  if (request.mode !== 'navigate' && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' &&
          !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    } catch {
      return (await caches.match(request)) || Response.error();
    }
  })());
});

// PWA Native Mobile Push Event Listener
self.addEventListener('push', (event) => {
  let data = { title: 'Artisan AI Alert 🔔', body: 'You have a new market order or enquiry update!' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/artisan-logo.png',
      badge: '/artisan-logo.png',
      vibrate: [200, 100, 200],
      tag: 'artisan-push-' + Date.now(),
      renotify: true
    })
  );
});

// Mobile Push Notification Click Event - Opens/Focuses app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
