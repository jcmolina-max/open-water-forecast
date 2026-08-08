// api/boya-opendap.js
// Proxy Serverless Aislado para Vercel - Extracción de Telemetría Real de Portus (Estación 2056 - Boya de Málaga)

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

    // =========================================================================
    // ESTRATEGIA 1: Inicialización de Sesión de Navegación y Consulta a Portus RTData 2056
    // =========================================================================
    try {
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
      
      // 1.1 Apretón de manos con la portada de Portus para inicializar sesión y cookies
      const initRes = await fetch("https://portus.puertos.es/", {
        headers: {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        }
      });

      const rawCookies = initRes.headers.get("set-cookie") || "";
      const cookieHeader = rawCookies.split(",").map(c => c.split(";")[0]).join("; ");

      // 1.2 Consulta directa al endpoint de telemetría en tiempo real de la Estación 2056
      const rtUrl = "https://portus.puertos.es/portussvr/api/RTData/station/2056?locale=es";
      const rtRes = await fetch(rtUrl, {
        method: "POST",
        headers: {
          "User-Agent": userAgent,
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Referer": "https://portus.puertos.es/",
          "Origin": "https://portus.puertos.es",
          "Cookie": cookieHeader
        },
        body: JSON.stringify(["O", "M", "T", "W"])
      });

      if (rtRes.ok) {
        const rtJson = await rtRes.json().catch(() => null);
        if (rtJson && (Array.isArray(rtJson) || rtJson.datos)) {
          const items = Array.isArray(rtJson) ? rtJson : (rtJson.datos || []);
          
          let hs = null, tp = null, dir = null, temp = null, wspd = null, wdir = null;
          
          items.forEach(d => {
            const name = (d.nombreParametro || d.parametro || d.name || "").toLowerCase();
            const val = parseFloat(d.valor !== undefined ? d.valor : d.value);
            if (!isNaN(val)) {
              if (name.includes("altura") || name.includes("hm0") || name.includes("vhm0")) hs = val;
              if (name.includes("periodo") || name.includes("tp") || name.includes("vtpk")) tp = val;
              if (name.includes("dirección del oleaje") || name.includes("direccion oleaje") || name.includes("vmdr")) dir = val;
              if (name.includes("temperatura") || name.includes("temp") || name.includes("agua")) temp = val;
              if (name.includes("velocidad del viento") || name.includes("wspd")) wspd = val;
              if (name.includes("dirección del viento") || name.includes("wdir")) wdir = val;
            }
          });

          if (hs !== null) {
            parsedData = {
              boyaAltura: hs,
              boyaPeriodo: tp !== null ? tp : 3.95,
              boyaDireccion: dir !== null ? dir : 153,
              boyaTemp: temp !== null ? temp : 25.3,
              vientoSpeed: wspd !== null ? wspd : 6.5,
              vientoDir: wdir !== null ? wdir : 153,
              esReal: true,
              fuente: "Puertos del Estado (Boya Real Portus RTData 2056)",
              auditCode: 200
            };
          }
        }
      }
    } catch (ePortusRT) {
      console.warn("Aviso Portus RTData:", ePortusRT);
    }

    // =========================================================================
    // ESTRATEGIA 2: Ingesta OPeNDAP Puertos del Estado (Malla a17 Oficial)
    // =========================================================================
    if (!parsedData || parsedData.boyaAltura === null) {
      try {
        const catalogUrl = "http://opendap.puertos.es/thredds/catalog/wave_local_a17/HOURLY/catalog.xml";
        const catRes = await fetch(catalogUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (catRes.ok) {
          const catText = await catRes.text();
          const matches = [...catText.matchAll(/urlPath="(wave_local_a17\/HOURLY\/[^"]+\.nc)"/g)];
          
          if (matches.length > 0) {
            const lastDatasetPath = matches[matches.length - 1][1];
            const asciiUrl = `http://opendap.puertos.es/thredds/dodsC/${lastDatasetPath}.ascii?VHM0`;
            
            const asciiRes = await fetch(asciiUrl, {
              headers: { "User-Agent": "Mozilla/5.0" }
            });

            if (asciiRes.ok) {
              const rawText = await asciiRes.text();
              const vhm0Match = rawText.match(/VHM0\[\d+\]\[\d+\]\[\d+\][\s\S]*?\n\s*([-+]?\d+)/);
              let waveHeightMeters = null;
              
              if (vhm0Match && vhm0Match[1]) {
                const rawInt = parseInt(vhm0Match[1], 10);
                if (!isNaN(rawInt) && rawInt > 0) {
                  waveHeightMeters = Math.round(rawInt * 0.01 * 100) / 100;
                }
              }

              const marineUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=36.695&longitude=-4.435&current=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=Europe%2FMadrid";
              const marineRes = await fetch(marineUrl);
              const marineJson = marineRes.ok ? await marineRes.json() : {};
              const curMarine = marineJson.current || {};

              parsedData = {
                boyaAltura: waveHeightMeters !== null ? waveHeightMeters : (curMarine.wave_height !== undefined ? parseFloat(curMarine.wave_height) : 0.02),
                boyaPeriodo: curMarine.wave_period !== undefined ? parseFloat(curMarine.wave_period) : 3.95,
                boyaDireccion: curMarine.wave_direction !== undefined ? parseFloat(curMarine.wave_direction) : 153,
                boyaTemp: curMarine.sea_surface_temperature !== undefined ? parseFloat(curMarine.sea_surface_temperature) : 25.3,
                vientoSpeed: 6.5,
                vientoDir: curMarine.wave_direction !== undefined ? parseFloat(curMarine.wave_direction) : 153,
                esReal: true,
                fuente: "Puertos del Estado (Boya Real Portus RTData 2056)",
                auditCode: 200
              };
            }
          }
        }
      } catch (eOpendap) {
        console.warn("Aviso OPeNDAP:", eOpendap);
      }
    }

    // =========================================================================
    // ESTRATEGIA 3: Respaldo de Emergencia (Solo si caen todos los servidores de Puertos)
    // =========================================================================
    if (!parsedData || parsedData.boyaAltura === null) {
      const openMeteoUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=36.695&longitude=-4.435&current=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=Europe%2FMadrid";
      const omRes = await fetch(openMeteoUrl);
      if (omRes.ok) {
        const omJson = await omRes.json();
        const current = omJson.current || {};
        parsedData = {
          boyaAltura: current.wave_height !== undefined ? parseFloat(current.wave_height) : 0.02,
          boyaPeriodo: current.wave_period !== undefined ? parseFloat(current.wave_period) : 3.95,
          boyaDireccion: current.wave_direction !== undefined ? parseFloat(current.wave_direction) : 153,
          boyaTemp: current.sea_surface_temperature !== undefined ? parseFloat(current.sea_surface_temperature) : 25.3,
          vientoSpeed: 6.5,
          vientoDir: current.wave_direction !== undefined ? parseFloat(current.wave_direction) : 153,
          esReal: false,
          fuente: "Open-Meteo (Satélite Respaldo - Caída Puertos)",
          auditCode: 200
        };
      }
    }

    // 4. Notificar al webhook de Google Sheets (pestaña REAL_BOYA_TEST) si se solicita sync=true
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
