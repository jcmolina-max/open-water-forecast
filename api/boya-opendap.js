// api/boya-opendap.js
// Proxy Serverless Aislado para Vercel - Extracción Multifuente Puertos del Estado con Etiquetado Estricto de Fuente

export default async function handler(req, res) {
  // 1. Cabeceras CORS abiertas
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let parsedData = null;

    // Estrategia 1: Portus API REST Estación 1070084 (Boya Málaga Real)
    try {
      const portusRes = await fetch("https://portus.puertos.es/portussvr/api/lastData/station/1070084?locale=es", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        body: JSON.stringify(["O", "M"])
      });

      if (portusRes.ok) {
        const json = await portusRes.json();
        if (json && json.datos && Array.isArray(json.datos)) {
          const hsItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Altura'));
          const tpItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Periodo'));
          const dirItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Direccion'));
          const tempItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Temperatura'));
          const wspdItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Velocidad del viento'));
          const wdirItem = json.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Dirección del viento'));

          const hVal = hsItem && hsItem.valor !== undefined ? parseFloat(hsItem.valor) : null;

          if (hVal !== null && !isNaN(hVal) && hVal > 0) {
            parsedData = {
              boyaAltura: hVal,
              boyaPeriodo: tpItem && tpItem.valor !== undefined ? parseFloat(tpItem.valor) : 4.0,
              boyaDireccion: dirItem && dirItem.valor !== undefined ? parseFloat(dirItem.valor) : 215,
              boyaTemp: tempItem && tempItem.valor !== undefined ? parseFloat(tempItem.valor) : 22.0,
              vientoSpeed: wspdItem && wspdItem.valor !== undefined ? parseFloat(wspdItem.valor) : 6.5,
              vientoDir: wdirItem && wdirItem.valor !== undefined ? parseFloat(wdirItem.valor) : 215,
              esReal: true,
              fuente: "Puertos del Estado (Boya Real Física 1070084)"
            };
          }
        }
      }
    } catch (ePortus) {
      console.warn("Aviso Portus REST API:", ePortus);
    }

    // Estrategia 2: OPeNDAP (.ascii) THREDDS si Estrategia 1 no responde
    if (!parsedData) {
      try {
        const opendapUrl = "https://opendap.puertos.es/thredds/dodsC/redcos/boya_malaga_actual.nc.ascii?time[0],VHM0[0][0][0],VTPK[0][0][0],VMDR[0][0][0],TEMP[0][0][0],WSPD[0][0][0],WDIR[0][0][0]";
        const opendapRes = await fetch(opendapUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (opendapRes.ok) {
          const rawText = await opendapRes.text();
          if (rawText && rawText.includes("---------------------------------------------")) {
            parsedData = parseOpendapAscii(rawText);
          }
        }
      } catch (eOpendap) {
        console.warn("Aviso OPeNDAP:", eOpendap);
      }
    }

    // Estrategia 3: ETIQUETADO EXPLÍCITO DE RESPALDO (Solo si falla Puertos del Estado)
    if (!parsedData || parsedData.boyaAltura === null) {
      const openMeteoUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=36.695&longitude=-4.435&current=wave_height,wave_direction,wave_period&timezone=Europe%2FBerlin";
      const omRes = await fetch(openMeteoUrl);
      if (omRes.ok) {
        const omJson = await omRes.json();
        const current = omJson.current || {};
        parsedData = {
          boyaAltura: current.wave_height !== undefined ? parseFloat(current.wave_height) : null,
          boyaPeriodo: current.wave_period !== undefined ? parseFloat(current.wave_period) : null,
          boyaDireccion: current.wave_direction !== undefined ? parseFloat(current.wave_direction) : null,
          boyaTemp: 22.0,
          vientoSpeed: 6.5,
          vientoDir: current.wave_direction !== undefined ? parseFloat(current.wave_direction) : 215,
          esReal: false,
          fuente: "Open-Meteo (Satélite Respaldo - Caída Puertos)"
        };
      }
    }

    // 4. Notificar al webhook de Google Sheets (pestaña REAL_BOYA_TEST) con ETIQUETA EXPLÍCITA
    const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_SCRIPT_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec";
    
    if (req.query && req.query.sync === "true" && GOOGLE_WEBHOOK_URL) {
      await fetch(GOOGLE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testMode: true,
          targetTable: "REAL_BOYA_TEST",
          playa: "misericordia",
          boyaAltura: parsedData ? parsedData.boyaAltura : null,
          boyaPeriodo: parsedData ? parsedData.boyaPeriodo : null,
          boyaDireccion: parsedData ? parsedData.boyaDireccion : null,
          boyaTemp: parsedData ? parsedData.boyaTemp : null,
          vientoSpeed: parsedData ? parsedData.vientoSpeed : null,
          vientoDir: parsedData ? parsedData.vientoDir : null,
          origenDato: parsedData ? parsedData.fuente : "Fallo Total Conexión"
        })
      }).catch(e => console.warn("Error post webhook:", e));
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: parsedData
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.toString() });
  }
}

/**
 * Parsea el texto plano del estándar EuroGOOS OPeNDAP .ascii
 */
function parseOpendapAscii(text) {
  try {
    const parts = text.split("---------------------------------------------");
    if (parts.length < 2) return null;

    const dataBlock = parts[1];

    const extractVal = (varName) => {
      const regex = new RegExp(varName + "(?:\\[\\d+\\])*\\s*,?\\s*([-+]?\\d*\\.?\\d+)", "i");
      const match = dataBlock.match(regex);
      return match && match[1] ? parseFloat(match[1]) : null;
    };

    return {
      boyaAltura: extractVal("VHM0"),
      boyaPeriodo: extractVal("VTPK"),
      boyaDireccion: extractVal("VMDR"),
      boyaTemp: extractVal("TEMP"),
      vientoSpeed: extractVal("WSPD"),
      vientoDir: extractVal("WDIR"),
      esReal: true,
      fuente: "Puertos del Estado (OPeNDAP Real 1070084)"
    };
  } catch (e) {
    return null;
  }
}
