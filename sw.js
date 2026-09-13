const CACHE = 'voxly-v2';
const CORE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || caches.match('/index.html'))
      )
  );
});

// ---------------- Web Push ----------------
self.addEventListener('push', (e) => {
  let notification = { title: 'Voxly', body: 'Новое сообщение', data: {} };
  try {
    const data = e.data ? e.data.json() : null;
    if (data && typeof data === 'object') {
      notification.title = data.title || notification.title;
      notification.body = data.body || notification.body;
      notification.data = data.data || {};
    }
  } catch {
    // non-JSON payload (e.g. empty ping) — show default
  }
  e.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: notification.data,
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  const data = e.notification.data || {};
  e.notification.close();
  const chatId = data.chatId || data.channelId;
  let targetUrl = '/';
  if (chatId) targetUrl = `/?chat=${encodeURIComponent(chatId)}`;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winList) => {
      for (const client of winList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});