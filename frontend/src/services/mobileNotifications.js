/**
 * Mobile & Browser Device Push Notification Service
 * Integrates Web Notifications API, PWA Service Worker & Audio/Haptic Chimes
 */

export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked prior to user interaction
  }
}

export function triggerVibration() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch {
    // Ignore vibration error
  }
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('This browser does not support desktop/mobile notifications.');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function triggerMobilePush(title, body, tag = 'artisan-ai') {
  // Always trigger sound & haptic feedback for real-time mobile feel
  playNotificationChime();
  triggerVibration();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  // 1. Attempt Service Worker showNotification with a strict 600ms timeout
  // to avoid hanging indefinitely if navigator.serviceWorker.ready doesn't settle
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 600))
      ]);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/artisan-logo.png',
          badge: '/artisan-logo.png',
          tag: `${tag}-${Date.now()}`,
          vibrate: [200, 100, 200],
          renotify: true
        });
        return true;
      }
    } catch {
      // SW timeout or error - continue to window.Notification fallback
    }
  }

  // 2. Standard Window Notification fallback
  try {
    new Notification(title, {
      body,
      icon: '/artisan-logo.png',
      badge: '/artisan-logo.png',
      tag: `${tag}-${Date.now()}`
    });
    return true;
  } catch (err) {
    console.warn('Window notification fallback failed:', err);
    return false;
  }
}
