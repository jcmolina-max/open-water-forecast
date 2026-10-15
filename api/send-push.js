// api/send-push.js
// Despachador Serverless Vercel de Notificaciones Web Push (VAPID)
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BLrS1Zj7HbR_gN6sq9cWLgvcNOTpS5ECBGBQd65teg3VoZGRVnVvMNRvn_WRP0PsKgjKCa147lC6ZxBPskbimW4";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "nysIpvSrPumo7Pu4OmOzEguQoCoFQh3nLZOt4UlMT5A";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contacto@openwatertracker.es";

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

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

    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub, notificationPayload))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Error enviando web push:', error);
    return res.status(500).json({ error: error.message || 'Error interno en despacho push.' });
  }
}
