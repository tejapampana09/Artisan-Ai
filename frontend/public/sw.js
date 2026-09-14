/* Artisan AI PWA Service Worker v1.0.5 */
const CACHE_NAME = 'artisan-ai-cache-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = event.request.url;

  // Always fetch API, manifest, and icon assets live from network to prevent stale caching
  if (
    url.includes('/api/') || 
    url.includes('/manifest.json') || 
    url.includes('/icon-') || 
    url.includes('/artisan-logo') || 
    url.includes('apple-touch-icon') ||
    url.includes('favicon.ico')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request))
  );
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
