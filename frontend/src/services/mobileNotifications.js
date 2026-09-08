/**
 * Mobile & Browser Device Push Notification Service
 * Integrates Web Notifications API & PWA Service Worker
 */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop/mobile notifications.');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function getNotificationPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function triggerMobilePush(title, body, tag = 'artisan-ai') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: '/artisan-logo.png',
          badge: '/artisan-logo.png',
          tag: tag + '-' + Date.now(),
          vibrate: [200, 100, 200],
          renotify: true
        });
      }).catch(() => {
        try {
          new Notification(title, { body, icon: '/artisan-logo.png', tag });
        } catch {
          // Ignore fallback errors
        }
      });
    } else {
      new Notification(title, { body, icon: '/artisan-logo.png', tag });
    }
  } catch (err) {
    console.error('Failed to trigger mobile push notification:', err);
  }
}
