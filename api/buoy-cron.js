// api/buoy-cron.js
export default async function handler(req, res) {
  try {
    const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_SCRIPT_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec";
    
    // Código de Estación Real de La Misericordia: 1070084
    const portusRealUrl = "https://portus.puertos.es/portussvr/api/lastData/station/1070084?locale=es";
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://portus.puertos.es/",
      "Origin": "https://portus.puertos.es",
      "Content-Type": "application/json"
    };

    let buoyRealData = null;

    // 1. Intento lectura Boya Real Málaga (Estación 1070084)
    try {
      const response = await fetch(portusRealUrl, { 
        method: "POST", 
        headers, 
        body: JSON.stringify(["O","M"]) 
      });
      
      if (response.ok) {
        const json = await response.json();
        if (json && json.datos && json.datos.length > 0) {
          const hsItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes("Altura"));
          const tpItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes("Periodo"));
          const dirItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes("Direccion"));
          
          buoyRealData = {
            altura: hsItem ? parseFloat(hsItem.valor) : null,
            periodo: tpItem ? parseFloat(tpItem.valor) : null,
            direccion: dirItem ? parseFloat(dirItem.valor) : null,
            fuente: "Puertos del Estado (Estación 1070084 - Málaga)"
          };
        }
      }
    } catch (e) {
      console.warn("Error en lectura directa Puertos 1070084:", e);
    }

    // 2. Si no responde la boya, consulta Open-Meteo Respaldo
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
          fuente: "Open-Meteo (Satélite Respaldo)"
        };
      }
    }

    // 3. Inyección en Google Sheets
    const sheetPayload = {
      origenDato: "Boya: " + (buoyRealData ? buoyRealData.fuente : "Sin Conexión"),
      playa: "misericordia",
      boyaAltura: buoyRealData ? buoyRealData.altura : null,
      boyaPeriodo: buoyRealData ? buoyRealData.periodo : null,
      boyaDireccion: buoyRealData ? buoyRealData.direccion : null,
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
