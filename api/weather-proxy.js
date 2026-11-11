// api/weather-proxy.js
// Proxy Serverless Vercel para Open-Meteo (Evita bloqueos HTTP 429 de IPs de Google Cloud)

export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const lats = req.query.lats || req.body?.lats || "36.696,36.716,36.721,36.645,36.622";
    const lons = req.query.lons || req.body?.lons || "-4.437,-4.407,-4.378,-4.488,-4.498";
    const days = req.query.days || req.body?.days || "4";
    const hourly = req.query.hourly || req.body?.hourly || "wind_speed_10m,wind_direction_10m,temperature_2m";
    const tz = req.query.tz || req.body?.tz || "Europe/Madrid";

    // 1. Intento primario: Modelo DWD-ICON
    const dwdUrl = `https://api.open-meteo.com/v1/dwd-icon?latitude=${lats}&longitude=${lons}&hourly=${hourly}&forecast_days=${days}&timezone=${encodeURIComponent(tz)}`;
    
    let response = await fetch(dwdUrl, {
      headers: {
        'User-Agent': 'OpenWaterTracker-Proxy/9.4 (Vercel; WeatherProxy)'
      }
    });

    let modelUsed = "dwd-icon";

    // 2. Si DWD-ICON da error o 429, fallback automático al modelo general (GFS / Best Match)
    if (!response.ok) {
      console.warn(`[WeatherProxy] DWD-ICON devolvió HTTP ${response.status}. Reintentando con endpoint general forecast...`);
      const generalUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=${hourly}&forecast_days=${days}&timezone=${encodeURIComponent(tz)}`;
      
      response = await fetch(generalUrl, {
        headers: {
          'User-Agent': 'OpenWaterTracker-Proxy/9.4 (Vercel; WeatherProxyFallback)'
        }
      });
      modelUsed = "forecast-general";
    }

    if (!response.ok) {
      throw new Error(`Open-Meteo devolvió HTTP ${response.status} en ambos endpoints.`);
    }

    const data = await response.json();

    // Cache-Control para Vercel Edge: 10 minutos de caché para evitar peticiones redundantes
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    
    return res.status(200).json({
      success: true,
      proxy: "vercel-aws-edge",
      modelUsed,
      data: Array.isArray(data) ? data : [data]
    });
  } catch (error) {
    console.error('[WeatherProxy Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error en proxy meteorológico'
    });
  }
}
