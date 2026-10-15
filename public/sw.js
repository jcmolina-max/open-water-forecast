// OpenWater Tracker - Service Worker para Notificaciones Web Push (Hito 44)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || '🌊 OpenWater Tracker Málaga';
  const body = data.body || 'Previsión marítima actualizada a 72h.';
  const targetUrl = data.url || data.data?.url || '/';

  // 1. Opciones base universales (compatibles 100% con iOS WebKit / Safari, Android y Desktop)
  const baseOptions = {
    body: body,
    tag: data.tag || 'openwater-alerta-72h',
    data: {
      url: targetUrl
    }
  };

  // 2. Detección de entorno iOS (iPhone / iPad / iPod)
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent || '') || 
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );

  let finalOptions = { ...baseOptions };

  // 3. Opciones avanzadas solo para Android y Desktop Chrome/Firefox/Edge
  // En iOS WebKit, propiedades como 'actions', 'vibrate' y 'requireInteraction' provocan TypeError y activan el fallback genérico
  if (!isIOS) {
    if (data.icon) finalOptions.icon = data.icon;
    if (data.badge) finalOptions.badge = data.badge;
    finalOptions.vibrate = [300, 100, 300, 100, 300];
    finalOptions.requireInteraction = true;
    finalOptions.renotify = true;
    finalOptions.silent = false;
    finalOptions.timestamp = Date.now();
    if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
      finalOptions.actions = data.actions;
    } else {
      finalOptions.actions = [
        { action: 'open', title: 'Ver Previsión 🏊‍♂️' }
      ];
    }
  }

  // 4. Despacho blindado: si finalOptions fuera rechazada por cualquier navegador,
  // el catch reintenta de inmediato con las opciones mínimas seguras para que NUNCA aparezca "Notificación"
  event.waitUntil(
    self.registration.showNotification(title, finalOptions).catch((err) => {
      console.warn('[SW Push] Reintentando con opciones mínimas por incompatibilidad:', err);
      return self.registration.showNotification(title, {
        body: body,
        data: { url: targetUrl }
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
