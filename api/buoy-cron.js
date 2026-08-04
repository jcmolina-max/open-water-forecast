// api/buoy-cron.js
// Extractor Autónomo Vercel Cron (24/7) - Puertos del Estado Málaga (Estación 2056 / Widget 35218)

export default async function handler(req, res) {
  try {
    const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_SCRIPT_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec";
    const portusUrl = "https://portus.puertos.es/portussvr/api/ubicaciones/35218?locale=es";
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://portus.puertos.es/",
      "Origin": "https://portus.puertos.es"
    };

    let buoyRealData = null;

    // 1. Intento lectura en vivo de Puertos del Estado (Estación 2056 - Málaga)
    try {
      const response = await fetch(portusUrl, { headers });
      if (response.ok) {
        const json = await response.json();
        if (json && (json.Hs !== undefined || json.altura !== undefined || json.latitud !== undefined)) {
          buoyRealData = {
            altura: json.Hs !== undefined ? parseFloat(json.Hs) : (json.altura !== undefined ? parseFloat(json.altura) : null),
            periodo: json.Tp !== undefined ? parseFloat(json.Tp) : (json.periodo !== undefined ? parseFloat(json.periodo) : null),
            direccion: json.Dir !== undefined ? parseFloat(json.Dir) : (json.direccion !== undefined ? parseFloat(json.direccion) : null),
            vientoKnots: json.vientoKnots !== undefined ? parseFloat(json.vientoKnots) : null,
            vientoDir: json.vientoDir !== undefined ? parseFloat(json.vientoDir) : null,
            temp: json.WaterTemp !== undefined ? parseFloat(json.WaterTemp) : (json.temp !== undefined ? parseFloat(json.temp) : null),
            fuente: "Puertos del Estado (Estación 2056 - Málaga)"
          };
        }
      }
    } catch (e) {
      console.warn("Fallo conexión Puertos:", e);
    }

    // 2. Si Puertos no responde, consulta Open-Meteo Respaldo
    if (!buoyRealData || buoyRealData.altura === null) {
      const openMeteoUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=36.695&longitude=-4.435&current=wave_height,wave_direction,wave_period&timezone=Europe%2FBerlin";
      const omRes = await fetch(openMeteoUrl);
      if (omRes.ok) {
        const omJson = await omRes.json();
        const current = omJson.current || {};
        buoyRealData = {
          altura: current.wave_height !== undefined ? parseFloat(current.wave_height) : null,
          periodo: current.wave_period !== undefined ? parseFloat(current.wave_period) : null,
          direccion: current.wave_direction !== undefined ? parseFloat(current.wave_direction) : null,
          vientoKnots: null,
          vientoDir: null,
          temp: null,
          fuente: "Open-Meteo (Satélite Respaldo)"
        };
      }
    }

    // 3. Enviar a Google Sheets (Telemetria_Sectores)
    const sheetPayload = {
      origenDato: "Boya: " + (buoyRealData ? buoyRealData.fuente : "Sin Conexión"),
      playa: "misericordia",
      boyaAltura: buoyRealData ? buoyRealData.altura : null,
      boyaPeriodo: buoyRealData ? buoyRealData.periodo : null,
      boyaDireccion: buoyRealData ? buoyRealData.direccion : null,
      boyaTemp: buoyRealData ? buoyRealData.temp : null,
      notasCalibracion: "Extracción Vercel Cron: " + (buoyRealData ? buoyRealData.fuente : "Fallo Conexión")
    };

    if (GOOGLE_WEBHOOK_URL) {
      await fetch(GOOGLE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheetPayload)
      });
    }

    return res.status(200).json({ success: true, buoyRealData });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.toString() });
  }
}
