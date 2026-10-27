// api/send-push.js
// Despachador Serverless Vercel de Notificaciones Web Push (VAPID)
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "BBd2zgCtf2M_SnXfMy4WC6QScpQEt1R2317LqJiAWQbc19LBSIXcSsxLgRoZiNwz2ZNTw0JedEFnxuPRTVBWKh0").trim();
// La clave privada se lee EXCLUSIVAMENTE de las variables de entorno secretas de Vercel (limpia de comillas y espacios)
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || "mailto:contacto@openwatertracker.es").trim();

let vapidConfigured = false;
function ensureVapidConfig() {
  if (!vapidConfigured) {
    if (!VAPID_PRIVATE_KEY) {
      throw new Error('Falta la variable de entorno secreta VAPID_PRIVATE_KEY en Vercel (Project Settings > Environment Variables).');
    }
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    ensureVapidConfig();

    const { subscriptions, payload } = req.body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(400).json({ error: 'Falta array de subscriptions.' });
    }

    const notificationPayload = JSON.stringify({
      title: payload?.title || '🌊 OpenWater Tracker Málaga',
      body: payload?.body || 'Nueva alerta marítima disponible.',
      icon: payload?.icon || '/icon-192.png',
      badge: payload?.badge || '/badge-72.png',
      url: payload?.url || '/'
    });

    const pushOptions = {
      TTL: 86400, // 24 horas
      urgency: 'high' // Máxima prioridad para despertar pantalla en reposo
    };

    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub, notificationPayload, pushOptions))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const failedDetails = [];
    const deadEndpoints = [];

    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        const statusCode = r.reason?.statusCode || 500;
        const rawBody = r.reason?.body;
        const bodyStr = typeof rawBody === 'string' ? rawBody : (rawBody ? JSON.stringify(rawBody) : '');
        const ep = subscriptions[idx]?.endpoint || '';
        
        let errorDesc = `HTTP ${statusCode}`;
        if (bodyStr) {
          errorDesc += `: ${bodyStr}`;
        } else if (r.reason?.message) {
          errorDesc += `: ${r.reason.message}`;
        }

        failedDetails.push({ endpoint: ep, statusCode, error: errorDesc });
        if (statusCode === 410 || statusCode === 404) {
          deadEndpoints.push(ep);
        }
      }
    });

    if (failedDetails.length > 0) {
      console.warn(`[Vercel SendPush] ${failed} fallos de entrega detectados:`, JSON.stringify(failedDetails));
    }

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
      deadEndpoints,
      errors: failedDetails.slice(0, 10)
    });
  } catch (error) {
    console.error('Error enviando web push:', error);
    return res.status(500).json({ error: error.message || 'Error interno en despacho push.' });
  }
}
