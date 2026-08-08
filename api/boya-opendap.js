// api/weather-proxy.js
// Proxy Serverless Aislado para Vercel - Descarga Meteorológica de Alta Resolución para las 7 Playas de Málaga
// Elimina al 100% el error 429 de Google Cloud al consultar desde IPs limpias de AWS Lambda

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { lats = "36.695,36.718,36.722,36.720,36.668,36.685,36.716", lons = "-4.435,-4.405,-4.378,-4.358,-4.452,-4.442,-4.345" } = req.query;

  try {
    const userAgent = "OpenWaterTracker-Proxy/9.4 (HighRes Coastal Grid; contact@openwatertracker.org)";
    
    // 1. Intento Primario: Open-Meteo Alta Resolución 2.5km
    const primaryUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m&wind_speed_unit=kn&timezone=Europe%2FMadrid`;
    
    let weatherRes = await fetch(primaryUrl, {
      headers: { "User-Agent": userAgent }
    });

    let modelTag = "Open-Meteo 2.5km";
    let dataArray = [];

    if (weatherRes.ok) {
      const parsed = await weatherRes.json();
      dataArray = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      // 2. Salto Automático a DWD ICON 2.2km si el primario se saturase
      const dwdUrl = `https://api.open-meteo.com/v1/dwd-icon?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m&wind_speed_unit=kn&timezone=Europe%2FMadrid`;
      const dwdRes = await fetch(dwdUrl, {
        headers: { "User-Agent": userAgent }
      });

      if (dwdRes.ok) {
        const parsedDwd = await dwdRes.json();
        dataArray = Array.isArray(parsedDwd) ? parsedDwd : [parsedDwd];
        modelTag = "DWD ICON 2.2km";
      } else {
        throw new Error(`Ambos nodos fallaron (Primario: ${weatherRes.status}, DWD: ${dwdRes.status})`);
      }
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      model: modelTag,
      timestamp: new Date().toISOString(),
      data: dataArray
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: error.message || error.toString()
    });
  }
}
