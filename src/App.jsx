/**
 * ============================================================================
 * GOOGLE APPS SCRIPT v32.1 MASTER COMPLETO (MOTOR CRON ALERTAS 72H CALIBRADO CON APP)
 * Proyecto: Calibraciones OpenWater Tracker (Málaga - 7 Playas)
 * 
 * NOVEDADES v32.1:
 * 1. Mantiene el 100% de la v31.0: Lectura defensiva de CONFIG_SECTORES_FACTORES y CONFIG_ALERTAS_REGLAS.
 * 2. Mantiene guardado dinámico de factores desde el panel de calibración (save_sector_factor).
 * 3. Mantiene gestión anónima y segura de SUSCRIPTORES_PUSH (subscribe_push y unsubscribe_push).
 * 4. NUEVO (v32.1): El robot evaluador a 72h APLICA LOS ALGORITMOS DE LA APP (getBoyaScaleFactorGas):
 *    - En lugar de evaluar la ola bruta del satélite en altamar, calcula la ola calibrada en la orilla:
 *      Ola Orilla = Ola Satélite * Factor Sector (F_orilla).
 *    - Lee en vivo los factores de CONFIG_SECTORES_FACTORES de Google Sheets (misma fuente de verdad).
 *    - Coherencia total: Lo que evalúa el robot a las 20:00h coincide con lo que muestra la app.
 * 5. Prioridad escalonada (Día 1 > Día 2 > Día 3) para Ventana de Oro, Mar Balsa y Swell de Levante.
 * 6. Despacho automático de notificaciones Web Push de alta urgencia vía Vercel (/api/send-push).
 * 7. Control anti-spam: Máximo 1 notificación diaria (salvo modo prueba forzado) y registro en HISTORIAL_ALERTAS_PUSH.
 * 8. Función instalarTriggerDiario20h() para activar el robot automático diario a las 20:00h en España con 1 clic.
 * 9. Función probarEnvioAlertas72hManual() para probar el sistema en directo de inmediato.
 * ============================================================================
 */

function doPost(e) {
  try {
    if (!e || e.postData === undefined) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "preflight_ok" }))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // MÓDULO DE PRUEBAS _TEST
    if (data && data.testMode === true) {
      return handleTestPayload(ss, data);
    }

    // 1. REGISTRO DE VISITAS
    if (data && data.action === "registrar_visita") {
      var visitSheet = ss.getSheetByName("Visitas");
      if (!visitSheet) {
        visitSheet = ss.insertSheet("Visitas");
        visitSheet.appendRow(["Fecha", "Origen"]);
      }
      visitSheet.appendRow([new Date(), data.origen || "Desconocido"]);
      return ContentService.createTextOutput(JSON.stringify({ "status": "visita_registrada" }))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 1.1 SUSCRIPCIÓN A WEB PUSH (ANÓNIMA Y SEGURA - VAPID)
    if (data && data.action === "subscribe_push") {
      var pushSheet = ss.getSheetByName("SUSCRIPTORES_PUSH");
      if (!pushSheet) {
        pushSheet = ss.insertSheet("SUSCRIPTORES_PUSH");
        pushSheet.appendRow(["ID_SUBSCRIPTION", "ENDPOINT", "P256DH", "AUTH", "PERFIL", "PLAYA", "FECHA_ALTA", "ESTADO"]);
      }
      
      var endpoint = data.endpoint || "";
      var p256dh = data.p256dh || "";
      var auth = data.auth || "";
      var perfil = data.perfil || "nadador";
      var playaFav = data.playa || "todas";
      
      var rows = pushSheet.getDataRange().getValues();
      var found = false;
      for (var r = 1; r < rows.length; r++) {
        if (rows[r][1] === endpoint) {
          pushSheet.getRange(r + 1, 3).setValue(p256dh);
          pushSheet.getRange(r + 1, 4).setValue(auth);
          pushSheet.getRange(r + 1, 5).setValue(perfil);
          pushSheet.getRange(r + 1, 6).setValue(playaFav);
          pushSheet.getRange(r + 1, 7).setValue(new Date());
          pushSheet.getRange(r + 1, 8).setValue("ACTIVO");
          found = true;
          break;
        }
      }
      
      if (!found) {
        var newId = "PUSH-" + Utilities.getUuid().substring(0, 8).toUpperCase();
        pushSheet.appendRow([newId, endpoint, p256dh, auth, perfil, playaFav, new Date(), "ACTIVO"]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "push_subscribed", "success": true }))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 1.2 DESUSCRIPCIÓN A WEB PUSH
    if (data && data.action === "unsubscribe_push") {
      var pushSheet = ss.getSheetByName("SUSCRIPTORES_PUSH");
      if (pushSheet) {
        var rows = pushSheet.getDataRange().getValues();
        for (var r = 1; r < rows.length; r++) {
          if (rows[r][1] === data.endpoint) {
            pushSheet.getRange(r + 1, 8).setValue("BAJA");
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "status": "push_unsubscribed", "success": true }))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 1.3 DISPARO MANUAL DE PRUEBA DE ALERTAS 72H
    if (data && data.action === "test_alertas_72h") {
      var testResult = ejecutarRevisionDiariaAlertas72h(true);
      return ContentService.createTextOutput(JSON.stringify(testResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1.5 SOBREESCRITURA DIRECTA DE CELDAS EN CONFIG_SECTORES_FACTORES
    if (data && (data.action === "save_sector_factor" || data.action === "save_beach_config")) {
      var okFactor = updateConfigSectorFactor(ss, data.playa, data.sectorId, data.isFuerte, data.factor);
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": okFactor ? "factor_updated" : "sector_not_found",
        "playa": data.playa,
        "sectorId": data.sectorId,
        "isFuerte": data.isFuerte,
        "factor": data.factor 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    // 1.6 REGISTRO EN CAJA NEGRA DE ANOMALÍAS TELEMÉTRICAS (HITO 47)
    if (data && data.action === "log_anomalia") {
      return handleLogAnomalia(ss, data);
    }
    // 2. REGISTRO COMPLETO DE CALIBRACIÓN / REPORTES
    var sheet = ss.getSheetByName("Calibración") || ss.getSheetByName("Calibracion") || ss.getSheetByName("Calibraciones") || ss.getActiveSheet();
    
    var timestamp = new Date();
    var buoyData = fetchPuertosBuoyData();
    var fuenteDato = buoyData ? buoyData.fuente : "Desconocido";
    var origenDato = data.origenDato || ("Boya: Sincronización (" + fuenteDato + ")");
    var playa = (data.playa || "misericordia").toLowerCase();
    var horaNado = data.horaNado || "";
    var realOlas = data.realOlas !== undefined ? data.realOlas : "";
    var realResaca = data.realResaca !== undefined ? data.realResaca : "";
    var realCorriente = data.realCorriente !== undefined ? data.realCorriente : "";
    var realVientoFza = data.realVientoFza !== undefined ? data.realVientoFza : "";
    var realVientoDir = data.realVientoDir !== undefined ? data.realVientoDir : "";
    var sensaciones = data.sensaciones || "";
    var appScore = data.appScore !== undefined ? data.appScore : "";
    var appOlas = data.appOlas !== undefined ? data.appOlas : "";
    var appEnergia = data.appEnergia !== undefined ? data.appEnergia : "";
    var appVientoNudos = data.appVientoNudos !== undefined ? data.appVientoNudos : "";
    var appVientoDir = data.appVientoDir !== undefined ? data.appVientoDir : "";
    var notas = data.notasCalibracion || data.notas || ("Fuente: " + fuenteDato);

    var boyaAltura = (data.boyaAltura !== undefined && data.boyaAltura !== "") ? data.boyaAltura : ((buoyData && buoyData.altura !== undefined) ? buoyData.altura : 0.02);
    var boyaPeriodo = (data.boyaPeriodo !== undefined && data.boyaPeriodo !== "") ? data.boyaPeriodo : ((buoyData && buoyData.periodo !== undefined) ? buoyData.periodo : 3.95);
    var boyaDireccion = (data.boyaDireccion !== undefined && data.boyaDireccion !== "") ? data.boyaDireccion : ((buoyData && buoyData.direccion !== undefined) ? buoyData.direccion : 153);
    var boyaTemp = (data.boyaTemp !== undefined && data.boyaTemp !== "") ? data.boyaTemp : (buoyData ? buoyData.temp : 25.3);

    var modelEcmwfOlas = data.modelEcmwfOlas !== undefined ? data.modelEcmwfOlas : "";
    var modelGfsOlas = data.modelGfsOlas !== undefined ? data.modelGfsOlas : "";
    var modelTodoSurfOlas = data.modelTodoSurfOlas !== undefined ? data.modelTodoSurfOlas : "";

    // EXTRACCIÓN ROBUSTA DE LA FECHA REAL DEL NADO (Soporte Hoy / Ayer / Calendario)
    var yyyy = Utilities.formatDate(timestamp, "Europe/Madrid", "yyyy");
    var mm = Utilities.formatDate(timestamp, "Europe/Madrid", "MM");
    var dd = Utilities.formatDate(timestamp, "Europe/Madrid", "dd");
    var cleanHH = Utilities.formatDate(timestamp, "Europe/Madrid", "HH");

    var rawFechaEnvio = String(data.fechaNado || data.fecha || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(rawFechaEnvio)) {
      var partsF = rawFechaEnvio.split("-");
      yyyy = partsF[0];
      mm = partsF[1];
      dd = partsF[2].substring(0, 2);
    } else if (data.fechaHora && /^\d{4}-\d{2}-\d{2}/.test(String(data.fechaHora).trim())) {
      var partsFH = String(data.fechaHora).trim().split(" ")[0].split("-");
      yyyy = partsFH[0];
      mm = partsFH[1];
      dd = partsFH[2].substring(0, 2);
    }

    if (horaNado) {
      var partsH = cleanSwimHour(horaNado).split(":");
      if (partsH.length > 0 && !isNaN(parseInt(partsH[0]))) {
        cleanHH = String(parseInt(partsH[0])).padStart(2, '0');
      }
    }

    var fechaRealNadoTexto = yyyy + "-" + mm + "-" + dd;
    var horaCompletaRegistro = fechaRealNadoTexto + " " + cleanHH + ":00";

    // ESCRITURA 1: Pestaña Tradicional "Calibración"
    var isAutoSync = (origenDato.indexOf("Sincronizaci") !== -1 || (sensaciones && sensaciones.indexOf("Sincronizaci") !== -1));
    if (!isAutoSync || origenDato.indexOf("Admin") !== -1) {
      sheet.appendRow([
        timestamp, horaCompletaRegistro, playa, realOlas,
        realResaca, realCorriente, realVientoFza, realVientoDir, sensaciones, origenDato,
        appScore, appOlas, appEnergia, appVientoNudos, appVientoDir, notas,
        boyaAltura, boyaPeriodo, boyaDireccion, boyaTemp,
        modelEcmwfOlas, modelGfsOlas, modelTodoSurfOlas
      ]);
    }

    // ESCRITURA 2: Pestaña Rama Mejora "REPORTES_NADADORES_TEST" (Solo para reportes de personas)
    var isRealSwimmer = (origenDato.indexOf("Nadador") !== -1 || origenDato.indexOf("Admin") !== -1 || origenDato.indexOf("Web") !== -1 || (sensaciones && sensaciones.indexOf("Sincronización") === -1));
    
    if (isRealSwimmer) {
      try {
        var repSheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
        if (!repSheet) {
          crearPestanasTest();
          repSheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
        }

        var playaCode = playa.substring(0, 3).toUpperCase();
        if (playa.indexOf("misericordia") !== -1) playaCode = "MIS";
        else if (playa.indexOf("malagueta") !== -1) playaCode = "MAL";
        else if (playa.indexOf("pedregalejo") !== -1) playaCode = "PED";
        else if (playa.indexOf("palo") !== -1) playaCode = "PAL";
        else if (playa.indexOf("alamos") !== -1) playaCode = "ALA";
        else if (playa.indexOf("bajondillo") !== -1) playaCode = "BAJ";
        else if (playa.indexOf("cala") !== -1) playaCode = "CAL";
        else if (playa.indexOf("rincon") !== -1) playaCode = "RIN";
        else if (playa.indexOf("guadalmar") !== -1) playaCode = "GUA";
        else if (playa.indexOf("sacaba") !== -1) playaCode = "SAC";
        else if (playa.indexOf("candado") !== -1) playaCode = "CAN";

        var baseSlotId = playaCode + "-" + yyyy + mm + dd + "-" + cleanHH + "00";
        var nextRepNum = 1;
        
        // Determinar número correlativo de reporte para evitar sobreescrituras en la misma hora
        if (repSheet.getLastRow() > 1) {
          var existingIds = repSheet.getRange(2, 1, repSheet.getLastRow() - 1, 1).getValues();
          for (var eId = 0; eId < existingIds.length; eId++) {
            var currIdStr = String(existingIds[eId][0]);
            if (currIdStr.indexOf(baseSlotId) === 0) {
              nextRepNum++;
            }
          }
        }

        var idRegistroTest = baseSlotId + "-REP" + nextRepNum;
        var fechaHoraCanonTest = yyyy + "-" + mm + "-" + dd + " " + cleanHH + ":00";
        var alturaMeteosTest = parseSwimmerOlasToMeters(realOlas);

        repSheet.appendRow([
          idRegistroTest,
          fechaHoraCanonTest,
          playa,
          alturaMeteosTest,
          sensaciones || "Plato / Calma",
          data.rumbo_natacion_grados || 90,
          notas || "Reporte Nadador Web",
          origenDato || "Formulario Web v9.4+",
          Utilities.formatDate(timestamp, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
          "OK 200"
        ]);

        // ESCRITURA 3: Pestaña "REAL_BOYA_TEST" (Solo cuando es calibración manual de Admin con datos de boya)
        if (origenDato.indexOf("Admin") !== -1 || origenDato.indexOf("Calibración") !== -1) {
          try {
            var sheetBoya = ss.getSheetByName("REAL_BOYA_TEST");
            if (!sheetBoya) {
              crearPestanasTest();
              sheetBoya = ss.getSheetByName("REAL_BOYA_TEST");
            }
            
            var cleanBoyaDir = parseFloat(String(boyaDireccion).replace(',', '.')) || 135;
            var cleanBoyaAlt = parseFloat(String(boyaAltura).replace(',', '.')) || 0.10;
            var cleanBoyaPer = parseFloat(String(boyaPeriodo).replace(',', '.')) || 3.5;
            var cleanBoyaTemp = parseFloat(String(boyaTemp).replace(',', '.')) || 20.0;

            sheetBoya.appendRow([
              baseSlotId,
              fechaHoraCanonTest,
              playa,
              cleanBoyaAlt,
              cleanBoyaDir,
              cleanBoyaPer,
              cleanBoyaTemp,
              appVientoNudos || 5.0,
              appVientoDir || 110,
              "✏️ Calibración Manual Admin (Dato Físico Verificado)",
              Utilities.formatDate(timestamp, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss")
            ]);
          } catch (errBoya) {
            Logger.log("Aviso guardando en REAL_BOYA_TEST: " + errBoya.toString());
          }
        }

        actualizarMotorAnalisisTest();
      } catch (errDual) {
        Logger.log("Aviso en Doble Escritura Test: " + errDual.toString());
      }
    }
    // Actualización automática de la pestaña del Cuadrilátero con cada nuevo reporte
    try {
      if (typeof ejecutarAnalisisCuadrilateroCompleto === "function") {
        ejecutarAnalisisCuadrilateroCompleto();
      }
    } catch (errCuad) {
      Logger.log("Aviso actualizando Cuadrilátero: " + errCuad.toString());
    }
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "buoy": buoyData,
      "idRegistro": idRegistroTest || ("MIS-" + yyyy + mm + dd + "-" + cleanHH + "00")
    })).setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.TEXT);
  }
}

function getNearestHourlySlot(dateObj) {
  var d = new Date(dateObj.getTime());
  if (d.getMinutes() >= 30) {
    d.setHours(d.getHours() + 1);
  }
  var yyyy = Utilities.formatDate(d, "Europe/Madrid", "yyyy");
  var mm = Utilities.formatDate(d, "Europe/Madrid", "MM");
  var dd = Utilities.formatDate(d, "Europe/Madrid", "dd");
  var hh = Utilities.formatDate(d, "Europe/Madrid", "HH");

  return {
    yyyy: yyyy,
    mm: mm,
    dd: dd,
    hh: hh,
    fechaHoraCanon: yyyy + mm + dd + "-" + hh + "00",
    targetTimeIso: yyyy + "-" + mm + "-" + dd + "T" + hh + ":00"
  };
}

/**
 * Sanitización limpia de comas a puntos y reconocimiento de mar plato (0.05m, 0.10m, etc.)
 */
function parseSwimmerOlasToMeters(raw) {
  if (raw === null || raw === undefined || raw === "" || (raw instanceof Date)) return 0.10;
  
  var cleanStr = String(raw).trim().replace(',', '.');
  var num = parseFloat(cleanStr);
  
  if (isNaN(num) || num < 0) return 0.10;
  
  // Escala ordinal 1 a 6
  if (num === 1) return 0.10;
  if (num === 2) return 0.20;
  if (num === 3) return 0.35;
  if (num === 4) return 0.50;
  if (num === 5) return 0.70;
  if (num === 6) return 0.90;
  
  // Si ya es un valor métrico exacto (ej: 0.05, 0.15, 0.40)
  return num <= 5 ? num : 0.10;
}

function extractCleanSwimmerWave(val, comment) {
  if (val !== null && val !== undefined && val !== "" && !(val instanceof Date)) {
    var strVal = String(val).trim().replace(',', '.');
    var n = parseFloat(strVal);
    if (!isNaN(n) && n >= 0 && n <= 5.0) {
      return parseSwimmerOlasToMeters(n);
    }
  }
  if (comment && typeof comment === "string") {
    var m = comment.match(/\((\d+(?:[\.,]\d+)?)\)/);
    if (m && m[1]) {
      var parsedM = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(parsedM)) {
        return parseSwimmerOlasToMeters(parsedM);
      }
    }
  }
  return 0.10;
}

function cleanSwimHour(raw) {
  if (!raw) return "10:00";
  var s = String(raw);
  if (s.indexOf("1899") !== -1 || s.indexOf("GMT") !== -1 || s.indexOf("T") !== -1) {
    try {
      var d = new Date(raw);
      return Utilities.formatDate(d, "Europe/Madrid", "HH:mm");
    } catch (e) {
      return "10:00";
    }
  }
  return s.length >= 5 ? s.substring(0, 5) : s;
}

/**
 * Lectura segura de CONFIG_SECTORES_PLAYAS
 */
function readConfigSectoresPlayas(ss) {
  try {
    var sheet = ss.getSheetByName("CONFIG_SECTORES_FACTORES") ||
                ss.getSheetByName("CONFIG_SECTORES_PLAYAS") || 
                ss.getSheetByName("GEOMETRIA_PLAYAS_SECTORES") || 
                ss.getSheetByName("SECTORES_PLAYAS") ||
                ss.getSheetByName("CONFIG_PLAYAS");
    if (!sheet || sheet.getLastRow() <= 1) return null;
    
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(h) { return String(h).toLowerCase().trim(); });
    
    var idxPlaya = headers.findIndex(function(h) { return h.indexOf("playa") !== -1 || h.indexOf("beach") !== -1 || h.indexOf("spot") !== -1; });
    var idxFacing = headers.findIndex(function(h) { return h.indexOf("facing") !== -1 || h.indexOf("orientaci") !== -1 || h.indexOf("rumbo") !== -1; });
    var idxLat = headers.findIndex(function(h) { return h.indexOf("lat") !== -1; });
    var idxLon = headers.findIndex(function(h) { return h.indexOf("lon") !== -1 || h.indexOf("lng") !== -1; });
    var idxSectorId = headers.findIndex(function(h) { return h.indexOf("id_sector") !== -1 || h.indexOf("sector_id") !== -1; });
    var idxSectorName = headers.findIndex(function(h) { return h.indexOf("nombre_sector") !== -1 || h.indexOf("nombre") !== -1 || h.indexOf("sector") !== -1; });
    var idxRangoMin = headers.findIndex(function(h) { return h.indexOf("grado_min") !== -1 || h.indexOf("min") !== -1 || h.indexOf("desde") !== -1; });
    var idxRangoMax = headers.findIndex(function(h) { return h.indexOf("grado_max") !== -1 || h.indexOf("max") !== -1 || h.indexOf("hasta") !== -1; });
    var idxFactorSuave = headers.findIndex(function(h) { return h.indexOf("factor_suave") !== -1 || h.indexOf("suave") !== -1; });
    var idxFactorFuerte = headers.findIndex(function(h) { return h.indexOf("factor_fuerte") !== -1 || h.indexOf("fuerte") !== -1; });
    var idxUmbral = headers.findIndex(function(h) { return h.indexOf("umbral") !== -1 || h.indexOf("viento") !== -1 || h.indexOf("knots") !== -1; });
    var idxAviso = headers.findIndex(function(h) { return h.indexOf("aviso") !== -1 || h.indexOf("desc") !== -1; });

    var configByBeach = {};
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var playaRaw = idxPlaya !== -1 ? String(row[idxPlaya]).toLowerCase().trim() : "";
      if (!playaRaw) continue;
      
      var playaKey = playaRaw;
      if (playaKey.indexOf("misericordia") !== -1) playaKey = "misericordia";
      else if (playaKey.indexOf("malagueta") !== -1) playaKey = "malagueta";
      else if (playaKey.indexOf("pedregalejo") !== -1) playaKey = "pedregalejo";
      else if (playaKey.indexOf("alamos") !== -1) playaKey = "los_alamos";
      else if (playaKey.indexOf("bajondillo") !== -1) playaKey = "bajondillo";
      else if (playaKey.indexOf("cala") !== -1) playaKey = "cala_del_moral";
      else if (playaKey.indexOf("rincon") !== -1) playaKey = "rincon_victoria";

      if (!configByBeach[playaKey]) {
        configByBeach[playaKey] = {
          facing: idxFacing !== -1 && !isNaN(Number(row[idxFacing])) ? Number(row[idxFacing]) : null,
          lat: idxLat !== -1 && !isNaN(Number(row[idxLat])) ? Number(row[idxLat]) : null,
          lon: idxLon !== -1 && !isNaN(Number(row[idxLon])) ? Number(row[idxLon]) : null,
          sectors: []
        };
      }
      
      var secId = idxSectorId !== -1 ? String(row[idxSectorId]).trim() : "";
      var secName = idxSectorName !== -1 ? String(row[idxSectorName]).trim() : secId;
      if (secId || secName) {
        var rMin = idxRangoMin !== -1 && !isNaN(Number(row[idxRangoMin])) ? Number(row[idxRangoMin]) : null;
        var rMax = idxRangoMax !== -1 && !isNaN(Number(row[idxRangoMax])) ? Number(row[idxRangoMax]) : null;
        var fSuave = idxFactorSuave !== -1 && !isNaN(parseFloat(String(row[idxFactorSuave]).replace(',', '.'))) ? parseFloat(String(row[idxFactorSuave]).replace(',', '.')) : null;
        var fFuerte = idxFactorFuerte !== -1 && !isNaN(parseFloat(String(row[idxFactorFuerte]).replace(',', '.'))) ? parseFloat(String(row[idxFactorFuerte]).replace(',', '.')) : null;
        var umbralKnots = idxUmbral !== -1 && !isNaN(Number(row[idxUmbral])) ? Number(row[idxUmbral]) : 12;
        var avisoTxt = idxAviso !== -1 ? String(row[idxAviso]).trim() : "";

        configByBeach[playaKey].sectors.push({
          id: secId,
          name: secName,
          min: rMin,
          max: rMax,
          factor_suave: fSuave,
          factor_fuerte: fFuerte,
          umbral_viento_knots: umbralKnots,
          aviso: avisoTxt
        });
      }
    }
    return Object.keys(configByBeach).length > 0 ? configByBeach : null;
  } catch (e) {
    Logger.log("Aviso leyendo CONFIG_SECTORES_FACTORES: " + e.toString());
    return null;
  }
}

/**
 * Sobreescribe la celda de Factor_Suave o Factor_Fuerte en CONFIG_SECTORES_FACTORES
 */
function updateConfigSectorFactor(ss, playaKey, sectorId, isFuerte, newFactor) {
  try {
    var sheet = ss.getSheetByName("CONFIG_SECTORES_FACTORES") ||
                ss.getSheetByName("CONFIG_SECTORES_PLAYAS") ||
                ss.getSheetByName("SECTORES_PLAYAS");
    if (!sheet || sheet.getLastRow() <= 1) return false;

    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(h) { return String(h).toLowerCase().trim(); });

    var idxPlaya = headers.findIndex(function(h) { return h.indexOf("playa") !== -1 || h.indexOf("beach") !== -1 || h.indexOf("spot") !== -1; });
    var idxSectorId = headers.findIndex(function(h) { return h.indexOf("id_sector") !== -1 || h.indexOf("sector_id") !== -1 || h.indexOf("sector") !== -1; });
    var idxFactorSuave = headers.findIndex(function(h) { return h.indexOf("factor_suave") !== -1 || h.indexOf("suave") !== -1; });
    var idxFactorFuerte = headers.findIndex(function(h) { return h.indexOf("factor_fuerte") !== -1 || h.indexOf("fuerte") !== -1; });

    if (idxPlaya === -1 || idxSectorId === -1) return false;

    var targetColIdx = isFuerte ? idxFactorFuerte : idxFactorSuave;
    if (targetColIdx === -1) targetColIdx = isFuerte ? 6 : 5; // 0-based col index

    var targetPlaya = String(playaKey || '').toLowerCase().trim();
    var targetSec = String(sectorId || '').toLowerCase().trim();

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var pRaw = String(row[idxPlaya] || '').toLowerCase().trim();
      var sRaw = String(row[idxSectorId] || '').toLowerCase().trim();

      var pMatch = (pRaw === targetPlaya) || 
                   (targetPlaya === 'misericordia' && pRaw.indexOf('misericordia') !== -1) ||
                   (targetPlaya === 'malagueta' && pRaw.indexOf('malagueta') !== -1) ||
                   (targetPlaya === 'pedregalejo' && pRaw.indexOf('pedregalejo') !== -1) ||
                   (targetPlaya === 'los_alamos' && pRaw.indexOf('alamos') !== -1) ||
                   (targetPlaya === 'bajondillo' && pRaw.indexOf('bajondillo') !== -1) ||
                   (targetPlaya === 'cala_del_moral' && pRaw.indexOf('cala') !== -1) ||
                   (targetPlaya === 'rincon_victoria' && pRaw.indexOf('rincon') !== -1);

      var sMatch = (sRaw === targetSec) || (sRaw.indexOf(targetSec) !== -1) || (targetSec.indexOf(sRaw) !== -1);

      if (pMatch && sMatch) {
        // Escribir celda físicamente en la hoja
        sheet.getRange(r + 1, targetColIdx + 1).setValue(newFactor !== null ? Number(newFactor) : "");
        return true;
      }
    }
    return false;
  } catch (e) {
    Logger.log("Error sobrescribiendo factor en hoja: " + e.toString());
    return false;
  }
}

/**
 * Lectura segura de CONFIG_ALERTAS_REGLAS
 */
function readConfigAlertasReglas(ss) {
  try {
    var sheet = ss.getSheetByName("CONFIG_ALERTAS_REGLAS") || 
                ss.getSheetByName("ALERTAS_REGLAS") || 
                ss.getSheetByName("CONFIG_REGLAS") ||
                ss.getSheetByName("CONFIG_ALERTAS");
    if (!sheet || sheet.getLastRow() <= 1) return null;
    
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(h) { return String(h).toLowerCase().trim(); });
    
    var idxKey = headers.findIndex(function(h) { return h.indexOf("regla") !== -1 || h.indexOf("param") !== -1 || h.indexOf("clave") !== -1 || h.indexOf("nombre") !== -1; });
    var idxVal = headers.findIndex(function(h) { return h.indexOf("valor") !== -1 || h.indexOf("umbral") !== -1 || h.indexOf("val") !== -1; });
    
    if (idxKey === -1) idxKey = 0;
    if (idxVal === -1) idxVal = 1;

    var configAlertas = {};
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var key = String(row[idxKey] || '').trim();
      var val = row[idxVal];
      if (!key) continue;
      
      if (val !== undefined && val !== null && val !== "") {
        var numVal = Number(String(val).replace(',', '.'));
        configAlertas[key] = !isNaN(numVal) ? numVal : String(val).trim();
      }
    }
    return Object.keys(configAlertas).length > 0 ? configAlertas : null;
  } catch (e) {
    Logger.log("Aviso leyendo CONFIG_ALERTAS_REGLAS: " + e.toString());
    return null;
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "test_alertas_72h") {
      var manualTestRes = ejecutarRevisionDiariaAlertas72h(true);
      return ContentService.createTextOutput(JSON.stringify(manualTestRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Calibración") || ss.getSheetByName("Calibracion") || ss.getSheetByName("Calibraciones") || ss.getActiveSheet();
    
    var lastRow = sheet.getLastRow();
    var records = [];
    
    if (lastRow > 1) {
      var startRow = Math.max(2, lastRow - 500);
      var numRows = lastRow - startRow + 1;
      var range = sheet.getRange(startRow, 1, numRows, 23);
      var values = range.getValues();
      var displayValues = range.getDisplayValues();
      
      for (var i = values.length - 1; i >= 0; i--) {
        var row = values[i];
        var dRow = displayValues[i];
        
        var cleanBoyaH = dRow[16] || row[16];
        var cleanBoyaP = dRow[17] || row[17];
        var cleanBoyaD = dRow[18] || row[18];
        var cleanBoyaT = dRow[19] || row[19];

        records.push({
          timestamp: row[0],
          horaNado: dRow[1] || row[1],
          playa: row[2],
          realOlas: dRow[3] !== undefined ? dRow[3] : row[3],
          realResaca: row[4],
          realCorriente: row[5],
          realVientoFza: row[6],
          realVientoDir: row[7],
          sensaciones: row[8],
          origenDato: row[9],
          appScore: row[10],
          appOlas: row[11],
          appEnergia: row[12],
          appVientoNudos: row[13],
          appVientoDir: row[14],
          notas: row[15],
          boyaAltura: cleanBoyaH,
          boyaPeriodo: cleanBoyaP,
          boyaDireccion: cleanBoyaD,
          boyaTemp: cleanBoyaT,
          modelEcmwfOlas: dRow[20] || row[20],
          modelGfsOlas: dRow[21] || row[21],
          modelTodoSurfOlas: dRow[22] || row[22]
        });
      }
    }
    
    var visitSheet = ss.getSheetByName("Visitas");
    var totalVisitas = 0;
    if (visitSheet && visitSheet.getLastRow() > 1) {
      totalVisitas = visitSheet.getLastRow() - 1;
    }

    var configSectores = readConfigSectoresPlayas(ss);
    var configAlertas = readConfigAlertasReglas(ss);

    // Lectura de telemetrÃ­a de REGISTRO_BOYA_REAL (Ãšltima lectura en vivo + Historial Horario 96h - Hito 47)
    var sheetBoyaReal = ss.getSheetByName("REGISTRO_BOYA_REAL");
    var ultimaBoyaReal = null;
    var boyaRealRecords = [];

    if (sheetBoyaReal && sheetBoyaReal.getLastRow() > 1) {
      var lastRowIdx = sheetBoyaReal.getLastRow();

      // 1. Última lectura en vivo (buscar hacia atrás para asegurar datos válidos si la última fila fue PARCIAL)
      var bRowLast = null;
      for (var rIdx = lastRowIdx; rIdx >= 2; rIdx--) {
        var rowCand = sheetBoyaReal.getRange(rIdx, 1, 1, 15).getValues()[0];
        var altCand = rowCand[4];
        if (altCand !== "" && altCand !== null && altCand !== undefined && String(altCand).toLowerCase().indexOf("parcial") === -1) {
          bRowLast = rowCand;
          break;
        }
      }
      if (!bRowLast) {
        bRowLast = sheetBoyaReal.getRange(lastRowIdx, 1, 1, 15).getValues()[0];
      }

      ultimaBoyaReal = {
        id: bRowLast[0],
        fechaHora: bRowLast[1],
        fecha: bRowLast[2],
        hora: bRowLast[3],
        altura: bRowLast[4],
        periodoPico: bRowLast[5],
        periodoMedio: bRowLast[6],
        dirOleaje: bRowLast[7],
        tempAgua: bRowLast[8],
        vientoMs: bRowLast[9],
        vientoNudos: bRowLast[10],
        dirViento: bRowLast[11],
        estado: bRowLast[12],
        fuente: bRowLast[13]
      };

      // 2. Historial continuo hora a hora (Ãºltimas 96 horas para el grÃ¡fico de triangulaciÃ³n)
      try {
        var bStartRow = Math.max(2, lastRowIdx - 336);
        var bNumRows = lastRowIdx - bStartRow + 1;
        var bValues = sheetBoyaReal.getRange(bStartRow, 1, bNumRows, 15).getValues();
        var bDisplayValues = sheetBoyaReal.getRange(bStartRow, 1, bNumRows, 15).getDisplayValues();

        for (var b = 0; b < bValues.length; b++) {
          var bRow = bValues[b];
          var bDRow = bDisplayValues[b];

          var idStr = String(bRow[0] || "").trim();
          var slotIso = "";
          var fStr = "";
          var hStr = "";
          if (idStr.length >= 13 && idStr.indexOf("-") === 8) {
            var yyyy = idStr.substring(0, 4);
            var mm = idStr.substring(4, 6);
            var dd = idStr.substring(6, 8);
            var hh = idStr.substring(9, 11);
            var min = idStr.substring(11, 13);
            slotIso = yyyy + "-" + mm + "-" + dd + "T" + hh + ":" + min + ":00";
            fStr = yyyy + "-" + mm + "-" + dd;
            hStr = hh + ":" + min;
          }

          var rawAlt = bDRow[4] !== undefined && bDRow[4] !== "" ? bDRow[4] : bRow[4];
          var numAlt = (rawAlt !== null && rawAlt !== undefined && rawAlt !== "" && String(rawAlt).toLowerCase().indexOf("parcial") === -1)
            ? parseFloat(String(rawAlt).replace(',', '.'))
            : null;

          var rawTemp = bDRow[8] !== undefined && bDRow[8] !== "" ? bDRow[8] : bRow[8];
          var numTemp = (rawTemp !== null && rawTemp !== undefined && rawTemp !== "")
            ? parseFloat(String(rawTemp).replace(',', '.'))
            : null;

          var rawWindKn = bDRow[10] !== undefined && bDRow[10] !== "" ? bDRow[10] : bRow[10];
          var numWindKn = (rawWindKn !== null && rawWindKn !== undefined && rawWindKn !== "")
            ? parseFloat(String(rawWindKn).replace(',', '.'))
            : null;

          var rawPeriodo = bDRow[5] !== undefined && bDRow[5] !== "" ? bDRow[5] : bRow[5];
          var numPeriodo = (rawPeriodo !== null && rawPeriodo !== undefined && rawPeriodo !== "")
            ? parseFloat(String(rawPeriodo).replace(',', '.'))
            : null;

          var rawDirOla = bDRow[7] !== undefined && bDRow[7] !== "" ? bDRow[7] : bRow[7];
          var numDirOla = (rawDirOla !== null && rawDirOla !== undefined && rawDirOla !== "")
            ? parseFloat(String(rawDirOla).replace(',', '.'))
            : null;

          var rawDirViento = bDRow[11] !== undefined && bDRow[11] !== "" ? bDRow[11] : bRow[11];
          var numDirViento = (rawDirViento !== null && rawDirViento !== undefined && rawDirViento !== "")
            ? parseFloat(String(rawDirViento).replace(',', '.'))
            : null;

          boyaRealRecords.push({
            id: idStr,
            iso: slotIso,
            fecha: fStr || String(bDRow[2] || bRow[2] || ""),
            hora: hStr || String(bDRow[3] || bRow[3] || ""),
            altura: (numAlt !== null && !isNaN(numAlt)) ? numAlt : null,
            periodo: (numPeriodo !== null && !isNaN(numPeriodo)) ? numPeriodo : null,
            tempAgua: (numTemp !== null && !isNaN(numTemp)) ? numTemp : null,
            vientoKnots: (numWindKn !== null && !isNaN(numWindKn)) ? numWindKn : null,
            dirOla: (numDirOla !== null && !isNaN(numDirOla)) ? numDirOla : null,
            dirViento: (numDirViento !== null && !isNaN(numDirViento)) ? numDirViento : null,
            calidad: String(bRow[12] || "")
          });
        }
      } catch (errLoop) {
        Logger.log("Aviso leyendo historial REGISTRO_BOYA_REAL: " + errLoop.toString());
      }
    }

    var response = {
      "status": "success",
      "total_registros": records.length,
      "total_visitas": totalVisitas,
      "data": records,
      "config_sectores": configSectores,
      "config_alertas": configAlertas,
      "ultima_boya_real": ultimaBoyaReal,
      "boya_real_horaria": boyaRealRecords
    };
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchPuertosBuoyData() {
  try {
    var url = "https://portus.puertos.es/portusbuzon/BuzonServlet?proceso=REDMAR_RTDATA&estacion=2056";
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    
    var json = JSON.parse(response.getContentText());
    if (!json || !json.data || json.data.length === 0) return null;
    
    var latest = json.data[0];
    return {
      altura: latest.Hm0 || latest.Hs || 0.02,
      periodo: latest.Tp || latest.Tz || 3.95,
      direccion: latest.DirM || latest.DirPeak || 153,
      temp: latest.WaterTemp || 25.3,
      fuente: "Puertos del Estado (Boya Real Portus RTData 2056)"
    };
  } catch (e) {
    Logger.log("Error consultando boya Puertos: " + e.toString());
    return null;
  }
}

/**
 * Cron Horario de Previsiones para las 7 Playas de Málaga (Coordenadas de Orilla a 6 decimales)
 */
function syncHourlyForecasts7Beaches() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPrev = ss.getSheetByName("PREVISIONES_TEST");
  if (!sheetPrev) {
    crearPestanasTest();
    sheetPrev = ss.getSheetByName("PREVISIONES_TEST");
  }

  var now = new Date();
  var slot = getNearestHourlySlot(now);
  var targetTimeIso = slot.targetTimeIso;

  var beaches = [
    { code: "MIS", name: "misericordia",     lat: 36.688139, lon: -4.441750 },
    { code: "MAL", name: "malagueta",        lat: 36.718556, lon: -4.407750 },
    { code: "PED", name: "pedregalejo",      lat: 36.720444, lon: -4.374278 },
    { code: "ALA", name: "los_alamos",       lat: 36.635500, lon: -4.484639 },
    { code: "BAJ", name: "bajondillo",       lat: 36.626250, lon: -4.491472 },
    { code: "CAL", name: "cala_del_moral",   lat: 36.714194, lon: -4.305167 },
    { code: "RIN", name: "rincon_victoria",  lat: 36.714417, lon: -4.287972 }
  ];

  var lats = beaches.map(function(b) { return b.lat; }).join(",");
  var lons = beaches.map(function(b) { return b.lon; }).join(",");

  var marineUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=" + lats + "&longitude=" + lons +
    "&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=Europe%2FMadrid";
  
  var marineResCode = 0;
  var marineDataArray = [];
  try {
    var resMarine = UrlFetchApp.fetch(marineUrl, { muteHttpExceptions: true });
    marineResCode = resMarine.getResponseCode();
    if (marineResCode === 200) {
      var parsedMarine = JSON.parse(resMarine.getContentText());
      marineDataArray = Array.isArray(parsedMarine) ? parsedMarine : [parsedMarine];
    }
  } catch (errMarine) {
    Logger.log("Aviso Marine API: " + errMarine.toString());
  }

  var meteoUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons +
    "&hourly=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m,cape,cloud_cover,precipitation_probability&timezone=Europe%2FMadrid";
  
  var meteoResCode = 0;
  var meteoDataArray = [];
  try {
    var resMeteo = UrlFetchApp.fetch(meteoUrl, { muteHttpExceptions: true });
    meteoResCode = resMeteo.getResponseCode();
    if (meteoResCode === 200) {
      var parsedMeteo = JSON.parse(resMeteo.getContentText());
      meteoDataArray = Array.isArray(parsedMeteo) ? parsedMeteo : [parsedMeteo];
    }
  } catch (errMeteo) {
    Logger.log("Aviso Meteo API: " + errMeteo.toString());
  }

  for (var i = 0; i < beaches.length; i++) {
    var b = beaches[i];
    var idRegistro = b.code + "-" + slot.fechaHoraCanon;

    var marineObj = marineDataArray[i] || {};
    var meteoObj = meteoDataArray[i] || {};

    var mHourly = marineObj.hourly || {};
    var wHourly = meteoObj.hourly || {};

    var timeIdx = -1;
    if (mHourly.time && Array.isArray(mHourly.time)) {
      timeIdx = mHourly.time.indexOf(targetTimeIso);
    }
    if (timeIdx === -1 && wHourly.time && Array.isArray(wHourly.time)) {
      timeIdx = wHourly.time.indexOf(targetTimeIso);
    }
    if (timeIdx === -1) timeIdx = 0;

    var hs = (mHourly.wave_height && mHourly.wave_height[timeIdx] !== undefined) ? Number(mHourly.wave_height[timeIdx]) : 0.0;
    var dirOla = (mHourly.wave_direction && mHourly.wave_direction[timeIdx] !== undefined) ? Number(mHourly.wave_direction[timeIdx]) : 0;
    var perOla = (mHourly.wave_period && mHourly.wave_period[timeIdx] !== undefined) ? Number(mHourly.wave_period[timeIdx]) : 0.0;
    var tempAguaPrev = (mHourly.sea_surface_temperature && mHourly.sea_surface_temperature[timeIdx] !== undefined) ? Number(mHourly.sea_surface_temperature[timeIdx]) : 25.0;

    var velKm = (wHourly.wind_speed_10m && wHourly.wind_speed_10m[timeIdx] !== undefined) ? Number(wHourly.wind_speed_10m[timeIdx]) : 0.0;
    var velKnots = Number((velKm * 0.539957).toFixed(1));
    var dirViento = (wHourly.wind_direction_10m && wHourly.wind_direction_10m[timeIdx] !== undefined) ? Number(wHourly.wind_direction_10m[timeIdx]) : 0;
    var humRel = (wHourly.relative_humidity_2m && wHourly.relative_humidity_2m[timeIdx] !== undefined) ? Number(wHourly.relative_humidity_2m[timeIdx]) : 0;
    var tempAire = (wHourly.temperature_2m && wHourly.temperature_2m[timeIdx] !== undefined) ? Number(wHourly.temperature_2m[timeIdx]) : 0.0;

    var auditDiag = (marineResCode === 200 && meteoResCode === 200) ? "OK 200" : ("WARN Marine:" + marineResCode + " Meteo:" + meteoResCode);

    sheetPrev.appendRow([
      idRegistro,
      slot.yyyy + "-" + slot.mm + "-" + slot.dd + " " + slot.hh + ":00",
      b.name,
      hs,
      dirOla,
      perOla,
      velKnots,
      dirViento,
      humRel,
      tempAire,
      auditDiag,
      tempAguaPrev,
      Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss")
    ]);
  }

  actualizarMotorAnalisisTest();
}

/**
 * Actualiza la Matriz Relacional de 16 Columnas de MOTOR_ANALISIS_TEST
 */
function actualizarMotorAnalisisTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPrev = ss.getSheetByName("PREVISIONES_TEST");
  var sheetBoya = ss.getSheetByName("REAL_BOYA_TEST");
  var sheetRep = ss.getSheetByName("REPORTES_NADADORES_TEST");
  var sheetMotor = ss.getSheetByName("MOTOR_ANALISIS_TEST");

  if (!sheetPrev || !sheetMotor) return;

  var prevRows = sheetPrev.getLastRow() > 1 ? sheetPrev.getRange(2, 1, sheetPrev.getLastRow() - 1, sheetPrev.getLastColumn()).getValues() : [];
  var boyaRows = (sheetBoya && sheetBoya.getLastRow() > 1) ? sheetBoya.getRange(2, 1, sheetBoya.getLastRow() - 1, sheetBoya.getLastColumn()).getValues() : [];
  var repRows = (sheetRep && sheetRep.getLastRow() > 1) ? sheetRep.getRange(2, 1, sheetRep.getLastRow() - 1, sheetRep.getLastColumn()).getValues() : [];

  var prevMap = {};
  for (var p = 0; p < prevRows.length; p++) {
    var rP = prevRows[p];
    prevMap[String(rP[0])] = {
      idReg: rP[0],
      fechaHora: rP[1],
      playa: rP[2],
      altOla: Number(rP[3]) || 0,
      dirOla: Number(rP[4]) || 0,
      perOla: Number(rP[5]) || 0,
      velViento: Number(rP[6]) || 0,
      dirViento: Number(rP[7]) || 0,
      humRel: Number(rP[8]) || 0,
      tempAire: Number(rP[9]) || 0,
      tempAguaPrev: Number(rP[11]) || 0
    };
  }

  var boyaMapBySlot = {};
  for (var b = 0; b < boyaRows.length; b++) {
    var rB = boyaRows[b];
    var idParts = String(rB[0]).split("-");
    var slotKey = idParts.length > 1 ? idParts.slice(1).join("-") : String(rB[0]);
    boyaMapBySlot[slotKey] = {
      altOla: Number(rB[3]) || 0,
      dirOla: Number(rB[4]) || 0,
      perOla: Number(rB[5]) || 0,
      tempAgua: Number(rB[6]) || 0,
      velViento: Number(rB[7]) || 0,
      dirViento: Number(rB[8]) || 0,
      fuente: rB[9] || "✏️ Calibración Manual Admin (Verificado)"
    };
  }

  var rowsToInsert = [];

  // 1. Inserción de Líneas de Previsión + Boya
  for (var idKey in prevMap) {
    var prev = prevMap[idKey];
    var slotK = idKey.split("-").slice(1).join("-");
    var boya = boyaMapBySlot[slotK];

    var boyaAltDisplay = boya ? boya.altOla : "";
    var fSesgo = (boya && prev.altOla > 0) ? (boya.altOla / prev.altOla) : 1.0;
    var fRefraccion = 1.0;
    var fCombinado = fSesgo * fRefraccion;
    var regimen = calcularRegimenMalaga(prev.dirOla, prev.dirViento, prev.velViento, prev.tempAire, prev.perOla);
    var notaLinea = boya ? "Previsión + Boya Real Admin" : "Previsión Base (Sin Boya Física)";

    rowsToInsert.push([
      prev.idReg,
      prev.fechaHora,
      prev.playa,
      prev.altOla,
      boyaAltDisplay,
      "",
      prev.dirOla,
      prev.perOla,
      prev.velViento,
      prev.dirViento,
      fSesgo.toFixed(2),
      fRefraccion.toFixed(2),
      fCombinado.toFixed(2),
      "",
      regimen,
      notaLinea
    ]);
  }

  var repCountPerSlot = {};

  // 2. Inserción de TODOS los Reportes de Nadadores (Sin Sobreescrituras)
  for (var r = 0; r < repRows.length; r++) {
    var rRep = repRows[r];
    var rawIdReg = String(rRep[0]).trim();
    var repPlaya = String(rRep[2]).toLowerCase();
    
    var repSwimmerOla = extractCleanSwimmerWave(rRep[3], rRep[9] || rRep[6] || rRep[4]);

    var repSlotBase = rawIdReg.replace(/-REP\d+$/i, "");
    if (!repCountPerSlot[repSlotBase]) repCountPerSlot[repSlotBase] = 1;
    else repCountPerSlot[repSlotBase]++;

    var cleanRepId = (rawIdReg.indexOf("-REP") !== -1 && rawIdReg !== repSlotBase) 
      ? rawIdReg 
      : (repSlotBase + "-REP" + repCountPerSlot[repSlotBase]);

    var repSlotK = repSlotBase.split("-").slice(1).join("-");

    var prevRef = prevMap[repSlotBase] || {
      altOla: repSwimmerOla,
      dirOla: 110,
      perOla: 3.75,
      velViento: 6.5,
      dirViento: 110,
      humRel: 78,
      tempAire: 29.5
    };

    var boyaRef = boyaMapBySlot[repSlotK] || {
      altOla: prevRef.altOla,
      dirOla: prevRef.dirOla,
      perOla: prevRef.perOla,
      tempAgua: 25.3,
      velViento: prevRef.velViento,
      dirViento: prevRef.dirViento
    };

    var fSesgoR = (prevRef.altOla > 0) ? (boyaRef.altOla / prevRef.altOla) : 1.0;
    var fRefraccionR = 1.0;
    var fCombR = fSesgoR * fRefraccionR;
    var errSubjetivo = (repSwimmerOla - boyaRef.altOla).toFixed(2);
    
    var regR = calcularRegimenMalaga(prevRef.dirOla, prevRef.dirViento, prevRef.velViento, prevRef.tempAire, prevRef.perOla);

    var rawCom = String(rRep[6] || rRep[4] || "").trim();
    var notaNadador = "Reporte #" + repCountPerSlot[repSlotBase];
    if (rawCom) {
      var nomMatch = rawCom.match(/\[Nombre:\s*([^\|\]]+)/i);
      var nombre = nomMatch ? nomMatch[1].trim() : "";
      var comLimpio = rawCom.replace(/\[[^\]]+\]/g, "").trim();
      if (nombre && comLimpio) notaNadador = nombre + " (" + comLimpio + ")";
      else if (nombre) notaNadador = "Nadador: " + nombre;
      else if (comLimpio) notaNadador = comLimpio;
      else notaNadador = rawCom;
    }

    rowsToInsert.push([
      cleanRepId,
      rRep[1],
      repPlaya,
      prevRef.altOla,
      boyaRef.altOla,
      repSwimmerOla,
      prevRef.dirOla,
      prevRef.perOla,
      prevRef.velViento,
      prevRef.dirViento,
      fSesgoR.toFixed(2),
      fRefraccionR.toFixed(2),
      fCombR.toFixed(2),
      errSubjetivo,
      regR,
      notaNadador
    ]);
  }

  sheetMotor.clearContents();
  sheetMotor.appendRow([
    "ID_Registro",
    "Fecha_Hora",
    "Playa",
    "Hs_OpenMeteo_m",
    "Hs_BoyaReal_m",
    "Hs_Swimmer_m",
    "Dir_Ola_grados",
    "Periodo_s",
    "Viento_Speed_kn",
    "Viento_Dir_grados",
    "F_sesgo",
    "F_refraccion",
    "F_combinado",
    "Error_Subjetivo_m",
    "Regimen_Clasificado",
    "Notas_Auditoria"
  ]);

  if (rowsToInsert.length > 0) {
    sheetMotor.getRange(2, 1, rowsToInsert.length, 16).setValues(rowsToInsert);
  }
}

/**
 * Clasificación Física y Oceanográfica de los 5 Regímenes en Málaga
 */
function calcularRegimenMalaga(dirOla, dirViento, velViento, tempAire, periodo) {
  if ((dirViento >= 285 && dirViento <= 360) || (dirViento >= 0 && dirViento <= 35) || (tempAire >= 27.5 && dirViento >= 270)) {
    return "Terral Puro (Viento NW/N de Tierra)";
  }
  if ((dirViento >= 45 && dirViento <= 155) || (dirOla >= 50 && dirOla <= 145 && dirViento < 180)) {
    if (velViento >= 10.0 || (periodo >= 5.5 && dirOla >= 60 && dirOla <= 140)) {
      return "Levante Fuerte (E/SE ≥10kn)";
    }
    return "Levante Suave / Brisa (E/SE <10kn)";
  }
  if (dirViento >= 175 && dirViento <= 284) {
    if (velViento >= 10.0 || (periodo >= 5.5 && dirOla >= 190 && dirOla <= 260)) {
      return "Poniente Fuerte (S/SO ≥10kn)";
    }
    return "Poniente Suave / Resaca (S/SO <10kn)";
  }
  return velViento >= 10.0 ? "Viento Costero Fuerte" : "Brisa Térmica / Calma";
}

function crearPestanasTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var tabs = [
    { name: "PREVISIONES_TEST", headers: ["ID_Registro", "Fecha_Hora", "Playa", "Hs_m", "Dir_grados", "Periodo_s", "Viento_Speed_kn", "Viento_Dir_grados", "Humedad_pct", "Temp_Aire_c", "Diagnostico_Auditoria", "Temp_Agua_Prevista_c", "Timestamp_Ejecucion"] },
    { name: "REAL_BOYA_TEST", headers: ["ID_Registro", "Fecha_Hora", "Playa", "Hs_m", "Dir_grados", "Periodo_s", "Temp_Agua_c", "Viento_Speed_kn", "Viento_Dir_grados", "Origen_Notas", "Timestamp_Ejecucion"] },
    { name: "REPORTES_NADADORES_TEST", headers: ["ID_Registro", "Fecha_Hora", "Playa", "Ola_Swimmer_m", "Sensacion_Swimmer", "Rumbo_grados", "Comentarios", "Origen_Dato", "Timestamp_Recepcion", "Audit_Status"] },
    { name: "MOTOR_ANALISIS_TEST", headers: ["ID_Registro", "Fecha_Hora", "Playa", "Hs_OpenMeteo_m", "Hs_BoyaReal_m", "Hs_Swimmer_m", "Dir_Ola_grados", "Periodo_s", "Viento_Speed_kn", "Viento_Dir_grados", "F_sesgo", "F_refraccion", "F_combinado", "Error_Subjetivo_m", "Regimen_Clasificado", "Notas_Auditoria"] }
  ];

  for (var i = 0; i < tabs.length; i++) {
    var sheet = ss.getSheetByName(tabs[i].name);
    if (!sheet) {
      sheet = ss.insertSheet(tabs[i].name);
      sheet.appendRow(tabs[i].headers);
      sheet.getRange(1, 1, 1, tabs[i].headers.length).setFontWeight("bold").setBackground("#d9ead3");
    }
  }
}

function handleTestPayload(ss, data) {
  var target = data.targetTable || "REAL_BOYA_TEST";
  var sheet = ss.getSheetByName(target);
  if (!sheet) {
    crearPestanasTest();
    sheet = ss.getSheetByName(target);
  }

  var now = new Date();
  var slot = getNearestHourlySlot(now);
  var idReg = (data.playa || "misericordia").substring(0, 3).toUpperCase() + "-" + slot.fechaHoraCanon;

  sheet.appendRow([
    idReg,
    slot.yyyy + "-" + slot.mm + "-" + slot.dd + " " + slot.hh + ":00",
    (data.playa || "misericordia").toLowerCase(),
    data.boyaAltura || 0.02,
    data.boyaDireccion || 153,
    data.boyaPeriodo || 3.95,
    data.boyaTemp || 25.3,
    data.vientoSpeed || 6.5,
    data.vientoDir || 153,
    data.origenDato || "Puertos del Estado (Boya Real Portus RTData 2056)",
    Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss")
  ]);

  actualizarMotorAnalisisTest();
  return ContentService.createTextOutput(JSON.stringify({ status: "success", target: target, idRegistro: idReg }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================================
 * MOTOR CRON EVALUADOR DIARIO DE ALERTAS A 72 HORAS (Hito 44 - Fase 3)
 * Ejecución programada diaria a las 20:00h (Europe/Madrid)
 * ============================================================================
 */

/**
 * ============================================================================
 * MOTOR 1: RECOLECTOR DE PREVISIONES A 72H (Hito 46 - Arquitectura Caché B.1)
 * Ejecución diaria programada a las 19:00h (Europe/Madrid)
 * Descarga y consolida ambos satélites (Marino + Clima) en la pestaña CACHE_PREVISIONES_72H
 * ============================================================================
 */
/**
 * ============================================================================
 * HITO 47: CAJA NEGRA DE ANOMALÍAS Y TELEMETRÍA (LOG_ANOMALIAS_ATMOSFERICAS)
 * ============================================================================
 * Registra discrepancias críticas entre la percepción en playa / boya real
 * y los modelos de previsión, asociando variables de microclima atmosférico:
 * Presión MSL, Humedad, Punto de Rocío, CAPE, Riesgo de Taró y notas de usuarios.
 */
function handleLogAnomalia(ss, data) {
  try {
    var sheetName = "LOG_ANOMALIAS_ATMOSFERICAS";
    var sheet = ss.getSheetByName(sheetName);
    
    var headers = [
      "ID_ANOMALIA", "TIMESTAMP", "FECHA", "HORA", "PLAYA", "ORIGEN_DATO",
      "VIENTO_SAT_KN", "VIENTO_REAL_KN", "DIF_VIENTO_KN",
      "OLA_SAT_M", "OLA_REAL_M", "DIF_OLA_M",
      "PRESION_MSL_HPA", "HUMEDAD_PCT", "PUNTO_ROCIO_C", "TEMP_AIRE_C",
      "INDICE_CAPE", "RIESGO_TARO", "NOTAS_DISCREPANCIA"
    ];

        if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Auto-actualizar cabecera si la hoja es nueva o tenía la cabecera antigua de 12 columnas
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== "ID_ANOMALIA") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight("bold")
        .setBackground("#fce5cd")
        .setFontColor("#783f04");
      sheet.setFrozenRows(1);
    }

    var now = new Date();
    var tsStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss");
    var idAnomalia = "ANOM-" + Utilities.formatDate(now, "Europe/Madrid", "yyyyMMdd-HHmmss") + "-" + Utilities.getUuid().substring(0, 4).toUpperCase();

    var vReal = (data.vientoReal !== undefined && data.vientoReal !== "") ? Number(data.vientoReal) : null;
    var vSat = (data.vientoSat !== undefined && data.vientoSat !== "") ? Number(data.vientoSat) : null;
    var difViento = (vReal !== null && vSat !== null && !isNaN(vReal) && !isNaN(vSat)) ? (vReal - vSat).toFixed(1) : "";

    var oReal = (data.olaReal !== undefined && data.olaReal !== "") ? Number(data.olaReal) : null;
    var oSat = (data.olaSat !== undefined && data.olaSat !== "") ? Number(data.olaSat) : null;
    var difOla = (oReal !== null && oSat !== null && !isNaN(oReal) && !isNaN(oSat)) ? (oReal - oSat).toFixed(2) : "";

    var newRow = [
      idAnomalia,
      tsStr,
      data.fecha || Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd"),
      data.hora || Utilities.formatDate(now, "Europe/Madrid", "HH:00"),
      (data.playa || "misericordia").toLowerCase(),
      data.origenDato || "Detección Automática",
      vSat !== null ? vSat : "",
      vReal !== null ? vReal : "",
      difViento,
      oSat !== null ? oSat : "",
      oReal !== null ? oReal : "",
      difOla,
      data.presionMSL !== undefined ? data.presionMSL : "",
      data.humidity !== undefined ? data.humidity : "",
      data.dewPoint !== undefined ? data.dewPoint : "",
      data.airTemp !== undefined ? data.airTemp : "",
      data.cape !== undefined ? data.cape : "",
      data.taroRisk !== undefined ? data.taroRisk : "",
      data.notas || "Discrepancia telemétrica registrada"
    ];

    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({
      status: "anomalia_registrada",
      success: true,
      idAnomalia: idAnomalia
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("❌ Error en handleLogAnomalia: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función de verificación manual en Apps Script para probar la Caja Negra con 1 clic
 */
function probarRegistroAnomaliaManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payloadPrueba = {
    action: "log_anomalia",
    fecha: Utilities.formatDate(new Date(), "Europe/Madrid", "yyyy-MM-dd"),
    hora: "11:00",
    playa: "misericordia",
    origenDato: "Prueba Manual Apps Script (Hito 47)",
    vientoSat: 4.8,
    vientoReal: 13.5,
    olaSat: 0.22,
    olaReal: 0.55,
    presionMSL: 1017.5,
    humidity: 84,
    dewPoint: 17.2,
    airTemp: 22.4,
    cape: 180,
    taroRisk: "Aviso de Niebla / Taró",
    notas: "Prueba de inicialización y verificación de la Caja Negra de Anomalías"
  };
  var res = handleLogAnomalia(ss, payloadPrueba);
  Logger.log("✅ Resultado prueba Caja Negra: " + res.getContent());
  return res;
}
function recolectarPrevisiones72h() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var todayStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd");
  var nowStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss");

  var cacheSheet = ss.getSheetByName("CACHE_PREVISIONES_72H");
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet("CACHE_PREVISIONES_72H");
  }

  // 1. Playas y Coordenadas de Bahía de Málaga
  var beaches = [
    { code: "MIS", name: "misericordia",     displayName: "Misericordia", lat: "36.688139", lon: "-4.441750" },
    { code: "MAL", name: "malagueta",        displayName: "La Malagueta", lat: "36.718556", lon: "-4.407750" },
    { code: "PED", name: "pedregalejo",      displayName: "Pedregalejo", lat: "36.720444", lon: "-4.374278" },
    { code: "ALA", name: "los_alamos",       displayName: "Los Álamos", lat: "36.635500", lon: "-4.484639" },
    { code: "BAJ", name: "bajondillo",       displayName: "El Bajondillo", lat: "36.626250", lon: "-4.491472" },
    { code: "CAL", name: "cala_del_moral",   displayName: "La Cala del Moral", lat: "36.714194", lon: "-4.305167" },
    { code: "RIN", name: "rincon_victoria",  displayName: "Rincón de la Victoria", lat: "36.714417", lon: "-4.287972" }
  ];

  var lats = beaches.map(function(b) { return b.lat; }).join(",");
  var lons = beaches.map(function(b) { return b.lon; }).join(",");

  // Marine API: Trae olas, periodos, dirección y como salvavidas también viento y temperatura
  var marineUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=" + lats + "&longitude=" + lons +
    "&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature,wind_speed_10m,wind_direction_10m,temperature_2m&forecast_days=4&timezone=Europe%2FMadrid";
  
   // Clima API: Modelo meteorológico europeo DWD ICON (7 playas individuales sin saturación 429)
  var meteoUrl = "https://api.open-meteo.com/v1/dwd-icon?latitude=" + lats + "&longitude=" + lons +
    "&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&forecast_days=4&timezone=Europe%2FMadrid";

  // Función fetch defensiva con reintentos
  function fetchJsonConReintento_(url, tipoApi) {
    for (var intento = 1; intento <= 3; intento++) {
      try {
        var res = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          headers: { "User-Agent": "AguasAbiertasMalaga/9.4 (CacheCollector; OpenMeteoClient)" }
        });
        var code = res.getResponseCode();
        if (code === 200) {
          var parsed = JSON.parse(res.getContentText());
          return Array.isArray(parsed) ? parsed : [parsed];
        } else {
          Logger.log("⚠️ Intento " + intento + "/3: HTTP " + code + " en " + tipoApi);
          if (intento < 3) Utilities.sleep(3000 * intento);
        }
      } catch (eNet) {
        Logger.log("⚠️ Error de red intento " + intento + "/3 en " + tipoApi + ": " + eNet.toString());
        if (intento < 3) Utilities.sleep(3000 * intento);
      }
    }
    return null;
  }

  // Paso A: Descarga de Satélite Marino
  var marineArr = fetchJsonConReintento_(marineUrl, "Marine-API") || [];
  if (marineArr.length === 0) {
    Logger.log("❌ Error crítico en Recolector: Marine-API no respondió tras 3 intentos.");
    cacheSheet.getRange(1, 1, 1, 6).setValues([[
      "CONTROL_CACHE", todayStr, nowStr, "ERROR_FALLO_SATELITE_MARINO", "SIN_DATOS", 0
    ]]);
    return { status: "error", error: "Sin datos Marine-API" };
  }

  // Pausa relajada de 4 segundos para evitar cualquier ráfaga en Google Cloud
  Utilities.sleep(4000);

  // Paso B: Descarga de Satelite Clima
  // 1. Intentamos primero via Vercel Weather Proxy (ejecutado en AWS Edge, libre de bloqueos 429 de IPs de Google Cloud)
  var vercelProxyUrl = (PropertiesService.getScriptProperties().getProperty("VERCEL_WEATHER_URL") ||
    "https://open-water-forecast.vercel.app/api/weather-proxy") +
    "?lats=" + encodeURIComponent(lats) + "&lons=" + encodeURIComponent(lons) + "&days=4";

  var meteoArr = [];
  var fuenteViento = "VERCEL_PROXY_DWD";
  var estadoSalud = "OK_NOMINAL (Vercel Proxy DWD-ICON)";

  try {
    var resProxy = UrlFetchApp.fetch(vercelProxyUrl, { muteHttpExceptions: true });
    if (resProxy.getResponseCode() === 200) {
      var jsonProxy = JSON.parse(resProxy.getContentText());
      if (jsonProxy.success && jsonProxy.data && jsonProxy.data.length > 0) {
        meteoArr = jsonProxy.data;
        fuenteViento = jsonProxy.modelUsed === "dwd-icon" ? "VERCEL_PROXY_DWD" : "VERCEL_PROXY_GFS";
        estadoSalud = "OK_NOMINAL (Vercel Proxy " + jsonProxy.modelUsed + ")";
        Logger.log("Clima obtenido con exito mediante Vercel Proxy (" + jsonProxy.modelUsed + ")");
      }
    } else {
      Logger.log("Vercel Proxy devolvio HTTP " + resProxy.getResponseCode() + ". Intentando llamada directa...");
    }
  } catch (errProxy) {
    Logger.log("Fallo conectando a Vercel Proxy: " + errProxy.toString() + ". Reintentando llamada directa...");
  }

  // 2. Fallback de contingencia: Llamada directa a DWD-ICON o General si el proxy no estuviera disponible
  if (meteoArr.length === 0) {
    meteoArr = fetchJsonConReintento_(meteoUrl, "Meteo-DWD-ICON") || [];
    if (meteoArr.length > 0) {
      fuenteViento = "METEO_API_NOMINAL";
      estadoSalud = "OK_NOMINAL (Directo DWD-ICON)";
    }
  }
  if (meteoArr.length === 0) {
    Logger.log("DWD-ICON no respondio. Reintentando con endpoint general...");
    var meteoUrlFallback = "https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons +
      "&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&forecast_days=4&timezone=Europe%2FMadrid";
    meteoArr = fetchJsonConReintento_(meteoUrlFallback, "Meteo-General") || [];
    if (meteoArr.length > 0) {
      fuenteViento = "METEO_GENERAL_FALLBACK";
      estadoSalud = "AVISO_RESPALDO_METEO_GENERAL";
    }
  }

  if (meteoArr.length === 0) {
    fuenteViento = "ESTIMADO_VIENTO_OLAS";
    estadoSalud = "RESGUARDO_FISICO_VIENTO_ESTIMADO";
    Logger.log("Plan de Emergencia: Estimando viento segun fisica de oleaje para evitar 0 nudos.");
  }

  // 2. Construcción de filas horarias de las próximas 72 horas (Días +1, +2, +3)
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var msPerDay = 24 * 3600 * 1000;
  var daysToScan = [1, 2, 3].map(function(offset) {
    var d = new Date(now.getTime() + offset * msPerDay);
    var dateStr = Utilities.formatDate(d, "Europe/Madrid", "yyyy-MM-dd");
    var diaNombre = DIAS[d.getDay()];
    var label = offset === 1 ? "mañana (" + diaNombre + ")" : (offset === 2 ? "pasado mañana (" + diaNombre + ")" : "el " + diaNombre);
    return { offset: offset, dateStr: dateStr, label: label, diaNombre: diaNombre };
  });

  var rows = [];

  for (var bIdx = 0; bIdx < beaches.length; bIdx++) {
    var beach = beaches[bIdx];
    var mH = marineArr[bIdx] ? marineArr[bIdx].hourly : null;
    var wH = (meteoArr && meteoArr[bIdx]) ? meteoArr[bIdx].hourly : null;

    if (!mH || !mH.time) continue;

    for (var dayIdx = 0; dayIdx < daysToScan.length; dayIdx++) {
      var day = daysToScan[dayIdx];

      for (var t = 0; t < mH.time.length; t++) {
        var timeIso = String(mH.time[t]);
        if (timeIso.indexOf(day.dateStr) !== 0) continue;

        var hour = parseInt(timeIso.substring(11, 13), 10);
        // Filtramos franja diurna (07:00 a 19:00)
        if (hour < 7 || hour > 19) continue;

        var rawWave = (mH.wave_height && mH.wave_height[t] !== undefined) ? Number(mH.wave_height[t]) : 0;
        var tp = (mH.wave_period && mH.wave_period[t] !== undefined) ? Number(mH.wave_period[t]) : 0;
        var dirOla = (mH.wave_direction && mH.wave_direction[t] !== undefined) ? Number(mH.wave_direction[t]) : 0;
        var tempAgua = (mH.sea_surface_temperature && mH.sea_surface_temperature[t] !== undefined) ? Number(mH.sea_surface_temperature[t]) : 20.0;

        var windKm = 0;
        var dirViento = 0;
        var tempAire = 20.0;

        if (wH && wH.wind_speed_10m && wH.wind_speed_10m[t] !== undefined && wH.wind_speed_10m[t] !== null) {
          windKm = Number(wH.wind_speed_10m[t]);
          dirViento = Number(wH.wind_direction_10m ? wH.wind_direction_10m[t] : 0);
          tempAire = Number(wH.temperature_2m ? wH.temperature_2m[t] : 20.0);
        } else {
          // Salvaguarda: estimaciÃ³n de viento basada en la altura de ola (Hs) para NUNCA guardar 0 nudos
          var hsEstimada = rawWave > 0 ? rawWave : 0.05;
          windKm = Math.max(3.0, Math.round(Math.sqrt((hsEstimada * 9.81) / 0.02) * 1.5));
          dirViento = dirOla > 0 ? dirOla : 120;
          tempAire = 21.0;
        }

        var windKn = Number((windKm * 0.539957).toFixed(1));

        rows.push([
          beach.code,
          beach.displayName,
          timeIso,
          day.dateStr,
          day.offset,
          hour,
          rawWave,
          tp,
          dirOla,
          windKn,
          dirViento,
          tempAgua,
          tempAire,
          fuenteViento
        ]);
      }
    }
  }

  // 3. Volcado limpio a la pestaña CACHE_PREVISIONES_72H
  cacheSheet.clearContents();

  // Fila 1: Sello de Control y Seguridad
  var controlRow = [
    "CONTROL_CACHE",
    todayStr,
    nowStr,
    estadoSalud,
    fuenteViento,
    rows.length
  ];

  // Fila 2: Encabezados de columnas
  var headerRow = [
    "PLAYA_CODE", "PLAYA_NAME", "FECHA_HORA_ISO", "FECHA_STR", "DAY_OFFSET", "HORA",
    "WAVE_HS_RAW", "TP_SEC", "DIR_OLA_DEG", "WIND_KN", "DIR_VIENTO_DEG", "TEMP_AGUA", "TEMP_AIRE", "FUENTE_DATOS"
  ];

    // Fila 1: Sello de Control y Seguridad (A1:F1)
  cacheSheet.getRange(1, 1, 1, controlRow.length).setValues([controlRow]);

  // Fila 2 en adelante: Encabezados y Datos (A2:N...)
  var dataRowsWithHeaders = [headerRow].concat(rows);
  cacheSheet.getRange(2, 1, dataRowsWithHeaders.length, headerRow.length).setValues(dataRowsWithHeaders);

  // Formato visual
  cacheSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#e6f2ff");
  cacheSheet.getRange(2, 1, 1, headerRow.length).setFontWeight("bold").setBackground("#d9ead3");

  Logger.log("✅ Recolección completada: " + rows.length + " filas guardadas en CACHE_PREVISIONES_72H. Estado: " + estadoSalud);
  return { status: "ok", rows: rows.length, estadoSalud: estadoSalud, fuenteViento: fuenteViento };
}

/**
 * ============================================================================
 * MOTOR 2: DESPACHADOR DIARIO DE ALERTAS A 72 HORAS (Hito 46 - Arquitectura Caché B.1)
 * Ejecución programada diaria a las 20:30h (Europe/Madrid)
 * 1. Verifica Sello de Seguridad anti-caducidad en CACHE_PREVISIONES_72H
 * 2. Lee previsiones internas (cero llamadas de red) y calcula factores de sector
 * 3. Despacha notificaciones Web Push y registra estado
 * ============================================================================
 */
function ejecutarRevisionDiariaAlertas72h(forceTest) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var todayStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd");

  var isManualTest = (forceTest === true);

  // 1. Pestaña de Historial de Alertas Push
  var histSheet = ss.getSheetByName("HISTORIAL_ALERTAS_PUSH");
  if (!histSheet) {
    histSheet = ss.insertSheet("HISTORIAL_ALERTAS_PUSH");
    histSheet.appendRow([
      "TIMESTAMP",
      "FECHA_HOY",
      "FECHA_OBJETIVO",
      "TIPO_EVENTO",
      "PLAYA",
      "TITULO",
      "MENSAJE",
      "SUSCRIPTORES_ENVIADOS",
      "ESTADO_DESPACHO"
    ]);
    histSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#cfe2f3");
  }

  // 2. Control Anti-Spam: Solo 1 alerta automática programada al día a las 20:30h
  if (!isManualTest && histSheet.getLastRow() > 1) {
    var histData = histSheet.getDataRange().getValues();
    for (var h = 1; h < histData.length; h++) {
      var rowHoy = histData[h][1];
      var rowEstado = String(histData[h][8] || "");
      if (rowHoy === todayStr && rowEstado.indexOf("ENVIADO_AUTO") !== -1) {
        Logger.log("ℹ️ Alerta automática ya enviada hoy (" + todayStr + "). Omitiendo ejecución duplicada.");
        return { status: "already_sent_today", date: todayStr };
      }
    }
  }

  // 3. Verificación de Seguridad en CACHE_PREVISIONES_72H
  var cacheSheet = ss.getSheetByName("CACHE_PREVISIONES_72H");

  // Si no hay caché o está vacía, y estamos en modo test manual, la recolectamos al momento
  if ((!cacheSheet || cacheSheet.getLastRow() < 3) && isManualTest) {
    Logger.log("Modo Test Manual: No hay caché previa. Ejecutando recolección en vivo...");
    recolectarPrevisiones72h();
    cacheSheet = ss.getSheetByName("CACHE_PREVISIONES_72H");
  }

  if (!cacheSheet || cacheSheet.getLastRow() < 3) {
    Logger.log("🛑 Freno de Seguridad: Pestaña CACHE_PREVISIONES_72H no disponible o vacía.");
    histSheet.appendRow([
      Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
      todayStr,
      todayStr,
      "ERROR_SEGURIDAD",
      "Bahía Málaga",
      "Freno de Seguridad: Sin datos en caché",
      "La pestaña CACHE_PREVISIONES_72H está vacía. No se envía alerta para evitar información nula.",
      0,
      "ABORTADO_CACHE_VACIA"
    ]);
    return { status: "aborted", error: "cache_empty" };
  }

  // Lectura del Sello de Control (Fila 1)
    // Lectura del Sello de Control (Fila 1) - Blindada contra objetos Date
  var controlDisplay = cacheSheet.getRange(1, 1, 1, 6).getDisplayValues()[0];
  var controlRaw = cacheSheet.getRange(1, 1, 1, 6).getValues()[0];

  var rawDate = controlRaw[1];
  var fechaCache = "";
  if (rawDate instanceof Date) {
    fechaCache = Utilities.formatDate(rawDate, "Europe/Madrid", "yyyy-MM-dd");
  } else {
    fechaCache = String(controlDisplay[1] || controlRaw[1] || "").trim();
  }
  if (fechaCache.length >= 10) {
    fechaCache = fechaCache.substring(0, 10);
  }

  var estadoSaludCache = String(controlDisplay[3] || "").trim();
  var fuenteVientoCache = String(controlDisplay[4] || "").trim();

  // REGLA DE SEGURIDAD ESTRICTA: La caché debe ser obligatoriamente de HOY
  if (!isManualTest && fechaCache !== todayStr) {
    Logger.log("🛑 Freno de Seguridad Activado: La caché es de fecha " + fechaCache + ", no coincide con hoy (" + todayStr + "). Abortando envío.");
    histSheet.appendRow([
      Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
      todayStr,
      todayStr,
      "ERROR_SEGURIDAD",
      "Bahía Málaga",
      "Freno de Seguridad: Previsión Caducada",
      "Los datos en caché son del " + fechaCache + ". Se bloquea el envío para no alertar con información desfasada.",
      0,
      "ABORTADO_SEGURIDAD_CACHE_CADUCADA"
    ]);
    return { status: "aborted", error: "stale_cache_detected", date: fechaCache };
  }

  // 4. Cargar configuración dinámica de factores de sectores desde Google Sheets
  var configSectores = readConfigSectoresPlayas(ss);

  // 5. Lectura ultrarrápida de datos de caché (0.05 segundos)
  var rawData = cacheSheet.getRange(3, 1, cacheSheet.getLastRow() - 2, 14).getValues();

  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var msPerDay = 24 * 3600 * 1000;
  var daysToScan = [1, 2, 3].map(function(offset) {
    var d = new Date(now.getTime() + offset * msPerDay);
    var dateStr = Utilities.formatDate(d, "Europe/Madrid", "yyyy-MM-dd");
    var diaNombre = DIAS[d.getDay()];
    var label = offset === 1 ? "mañana (" + diaNombre + ")" : (offset === 2 ? "pasado mañana (" + diaNombre + ")" : "el " + diaNombre);
    return { offset: offset, dateStr: dateStr, label: label, diaNombre: diaNombre };
  });

  var bestSwimmerAlert = null;
  var bestSurferAlert = null;

  for (var dayIdx = 0; dayIdx < daysToScan.length; dayIdx++) {
    var day = daysToScan[dayIdx];

      // Agrupar filas de este día por playa (Blindado por offset numérico y fecha)
    var dayRows = rawData.filter(function(r) {
      if (Number(r[4]) === day.offset) return true;
      var rDate = r[3];
      var rDateStr = (rDate instanceof Date) 
        ? Utilities.formatDate(rDate, "Europe/Madrid", "yyyy-MM-dd") 
        : String(rDate || "").trim().substring(0, 10);
      return rDateStr === day.dateStr;
    });

    var beachesInDay = {};
    for (var r = 0; r < dayRows.length; r++) {
      var row = dayRows[r];
      var bCode = String(row[0]).trim();
      if (!beachesInDay[bCode]) {
        var codeMap = {
          MIS: "misericordia",
          MAL: "malagueta",
          PED: "pedregalejo",
          ALA: "los_alamos",
          BAJ: "bajondillo",
          CAL: "cala_del_moral",
          RIN: "rincon_victoria"
        };
        var bName = codeMap[bCode] || String(row[1]).toLowerCase().replace(/ /g, "_").replace(/^la_/, "").replace(/^el_/, "");
        beachesInDay[bCode] = {
          code: bCode,
          name: bName,
          displayName: String(row[1]),
          hours: []
        };
      }
      beachesInDay[bCode].hours.push({
        hour: Number(row[5]),
        rawWave: Number(row[6]),
        tp: Number(row[7]),
        dirOla: Number(row[8]),
        windKn: Number(row[9]),
        dirViento: Number(row[10]),
        tempAgua: Number(row[11]),
        tempAire: Number(row[12])
      });
    }

    var beachKeys = Object.keys(beachesInDay);
    for (var b = 0; b < beachKeys.length; b++) {
      var bInfo = beachesInDay[beachKeys[b]];
      var consecutiveGoldHours = 0;
      var goldStart = null;
      var goldEnd = null;
      var minWave = 999;
      var maxWave = 0;
      var surfWave = 0;
      var maxTp = 0;

      for (var h = 0; h < bInfo.hours.length; h++) {
        var hourData = bInfo.hours[h];
        var hour = hourData.hour;

        // ALGORITMO CALIBRADO DE LA APP:
        // Multiplica la ola bruta de altamar por el factor del sector costero activo (F_orilla)
        var scaleFactor = getBoyaScaleFactorGas(bInfo.name, hourData.dirOla, hourData.dirViento, hourData.windKn, configSectores);
        var wave = Number((hourData.rawWave * scaleFactor).toFixed(2));

        if (wave < minWave) minWave = wave;
        if (wave > maxWave) maxWave = wave;

        // Ventana de calma matinal para nadador (08h a 13h, ola <= 0.25m, viento <= 8.5kn)
        if (hour >= 8 && hour <= 13 && wave <= 0.25 && hourData.windKn <= 8.5) {
          consecutiveGoldHours++;
          if (!goldStart) goldStart = (hour < 10 ? "0" + hour : hour) + ":00";
          goldEnd = (hour + 1 < 10 ? "0" + (hour + 1) : (hour + 1)) + ":00";
        }

        // Swell de Levante para surfero (ola >= 0.50m, periodo Tp >= 5.0s, dirección E/SE 60º a 140º)
        if (wave >= 0.50 && hourData.tp >= 5.0 && hourData.dirOla >= 60 && hourData.dirOla <= 140) {
          if (wave > surfWave) {
            surfWave = wave;
            maxTp = hourData.tp;
          }
        }
      }

      // Evaluar Alerta Nadador (Ventana de Oro o Mar Balsa)
      if (!bestSwimmerAlert && (consecutiveGoldHours >= 2 || (minWave <= 0.20 && maxWave <= 0.28))) {
        bestSwimmerAlert = {
          dayOffset: day.offset,
          dateStr: day.dateStr,
          dayLabel: day.label,
          diaNombre: day.diaNombre,
          playaCode: bInfo.code,
          playaName: bInfo.displayName,
          minWave: minWave < 999 ? minWave.toFixed(2) : "0.15",
          goldStart: goldStart || "08:30",
          goldEnd: goldEnd || "11:30",
          consecutiveHours: consecutiveGoldHours,
          tipo: consecutiveGoldHours >= 3 ? "VENTANA_ORO" : "MAR_BALSA"
        };
      }

      // Evaluar Alerta Surfero
      if (!bestSurferAlert && surfWave >= 0.50) {
        bestSurferAlert = {
          dayOffset: day.offset,
          dateStr: day.dateStr,
          dayLabel: day.label,
          diaNombre: day.diaNombre,
          playaCode: bInfo.code,
          playaName: bInfo.displayName,
          surfWave: surfWave.toFixed(2),
          maxTp: maxTp.toFixed(1),
          tipo: "SWELL_LEVANTE"
        };
      }
    }

    if (bestSwimmerAlert && bestSwimmerAlert.dayOffset === 1 && bestSurferAlert) {
      break;
    }
  }

  // 6. Construir Textos de Alertas
  var swimmerTitle = "";
  var swimmerBody = "";
  if (bestSwimmerAlert) {
    if (bestSwimmerAlert.dayOffset === 1) {
      swimmerTitle = "✨ ¡Mañana Mar Balsa en Málaga!";
      swimmerBody = "Ola de " + bestSwimmerAlert.minWave + "m y calma en " + bestSwimmerAlert.playaName + 
        ". Ventana ideal: " + bestSwimmerAlert.goldStart + " a " + bestSwimmerAlert.goldEnd + ".";
    } else if (bestSwimmerAlert.dayOffset === 2) {
      swimmerTitle = "📅 ¡Alerta a 48h! Ventana de Oro";
      swimmerBody = "Excelentes condiciones para " + bestSwimmerAlert.dayLabel + " en " + bestSwimmerAlert.playaName + 
        ": ola de " + bestSwimmerAlert.minWave + "m y viento en calma.";
    } else {
      swimmerTitle = "🔭 ¡Anticipación 72h! Calma Prevista";
      swimmerBody = "Previsión favorable para el " + bestSwimmerAlert.diaNombre + " en " + bestSwimmerAlert.playaName + 
        " con ola estimada de " + bestSwimmerAlert.minWave + "m.";
    }
  } else if (isManualTest) {
    swimmerTitle = "🌊 Previsión 72h Málaga (Modo Test)";
    swimmerBody = "Revisión completada: en las próximas 72h se prevé oleaje moderado. Te avisaremos en cuanto entre calma o mar balsa.";
  }

  var surferTitle = "";
  var surferBody = "";
  if (bestSurferAlert) {
    surferTitle = "🏄 ¡Alerta Swell a " + (bestSurferAlert.dayOffset * 24) + "h!";
    surferBody = "Entrada de Levante con ola de " + bestSurferAlert.surfWave + "m y periodo " + bestSurferAlert.maxTp + 
      "s para " + bestSurferAlert.dayLabel + " en " + bestSurferAlert.playaName + ".";
  } else if (isManualTest) {
    surferTitle = "🏄 Previsión Surf 72h (Modo Test)";
    surferBody = "Sin marejada de levante relevante en las próximas 72h en la bahía de Málaga.";
  }

  // 7. Lectura de Suscriptores Activos
  var pushSheet = null;
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var shName = allSheets[s].getName().trim().toUpperCase();
    if (shName === "SUSCRIPTORES_PUSH" || shName === "SUSCRIPTORES PUSH" || shName.indexOf("SUSCRIPTOR") !== -1) {
      pushSheet = allSheets[s];
      break;
    }
  }

  var subscribersSwimmer = [];
  var subscribersSurfer = [];

  if (pushSheet && pushSheet.getLastRow() > 1) {
    var pData = pushSheet.getDataRange().getValues();
    var pHeaders = pData[0].map(function(h) { return String(h).trim().toUpperCase(); });

    var idxEp = pHeaders.indexOf("ENDPOINT");
    var idxPKey = pHeaders.indexOf("P256DH");
    var idxAuth = pHeaders.indexOf("AUTH");
    var idxPerfil = pHeaders.indexOf("PERFIL");
    var idxEstado = pHeaders.indexOf("ESTADO");

    if (idxEp === -1) idxEp = 1;
    if (idxPKey === -1) idxPKey = 2;
    if (idxAuth === -1) idxAuth = 3;
    if (idxPerfil === -1) idxPerfil = 4;
    if (idxEstado === -1) idxEstado = 7;

    for (var p = 1; p < pData.length; p++) {
      var pRow = pData[p];
      var ep = String(pRow[idxEp] || "").trim();
      var pKey = String(pRow[idxPKey] || "").trim();
      var aKey = String(pRow[idxAuth] || "").trim();
      var perfil = String(pRow[idxPerfil] || "nadador").trim().toLowerCase();
      var estado = String(pRow[idxEstado] || "ACTIVO").trim().toUpperCase();

      if (estado === "ACTIVO" && ep.length > 10 && pKey.length > 5 && aKey.length > 5) {
        var subObj = { endpoint: ep, keys: { p256dh: pKey, auth: aKey } };
        if (perfil.indexOf("surf") !== -1) {
          subscribersSurfer.push(subObj);
        } else {
          subscribersSwimmer.push(subObj);
        }
      }
    }
  }

  Logger.log("Suscriptores activos encontrados: Nadadores=" + subscribersSwimmer.length + ", Surferos=" + subscribersSurfer.length);

  // 8. Despacho Vercel Web Push con distintivo de respaldo si aplica
  var totalEnviados = 0;
  var tagDespacho = isManualTest ? "TEST_MANUAL_OK" : "ENVIADO_AUTO_OK";

  // Observación de respaldo de viento trazable
  if (fuenteVientoCache.indexOf("FALLBACK") !== -1 || fuenteVientoCache.indexOf("MARINE") !== -1) {
    tagDespacho += " | ⚠️ [Viento: Respaldo Marine-API]";
  }

  var statusDespacho = "SIN_ALERTAS_OPTIMAS";

  // Despacho a Nadadores
  if (swimmerTitle && subscribersSwimmer.length > 0) {
    var resNad = dispatchPushViaVercel(subscribersSwimmer, {
      title: swimmerTitle,
      body: swimmerBody,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      url: "/?alerta=72h"
    });
    totalEnviados += (resNad && resNad.sent !== undefined) ? resNad.sent : subscribersSwimmer.length;
    statusDespacho = tagDespacho + " (" + totalEnviados + "/" + subscribersSwimmer.length + ")";
  }

  // Despacho a Surferos
  if (surferTitle && subscribersSurfer.length > 0) {
    var resSurf = dispatchPushViaVercel(subscribersSurfer, {
      title: surferTitle,
      body: surferBody,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      url: "/?alerta=72h"
    });
    var surfSent = (resSurf && resSurf.sent !== undefined) ? resSurf.sent : subscribersSurfer.length;
    totalEnviados += surfSent;
    statusDespacho += " | SURF_" + tagDespacho + " (" + surfSent + "/" + subscribersSurfer.length + ")";
  }

  if (swimmerTitle || surferTitle) {
    if (subscribersSwimmer.length === 0 && subscribersSurfer.length === 0) {
      statusDespacho = "ALERTA_GENERADA_SIN_SUSCRIPTORES";
    }
  }

  // 9. Registro en Historial
  var targetPlaya = bestSwimmerAlert ? bestSwimmerAlert.playaName : (bestSurferAlert ? bestSurferAlert.playaName : "Bahía Málaga");
  var targetFecha = bestSwimmerAlert ? bestSwimmerAlert.dateStr : (bestSurferAlert ? bestSurferAlert.dateStr : todayStr);
  var targetTipo = bestSwimmerAlert ? bestSwimmerAlert.tipo : (bestSurferAlert ? bestSurferAlert.tipo : "TEST_PREVIEW");

  histSheet.appendRow([
    Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
    todayStr,
    targetFecha,
    targetTipo,
    targetPlaya,
    swimmerTitle || surferTitle || "Sin alerta",
    swimmerBody || surferBody || "Condiciones normales",
    totalEnviados,
    statusDespacho
  ]);

  var summaryResult = {
    status: "ok",
    forceTest: isManualTest,
    fuenteViento: fuenteVientoCache,
    alertaNadador: bestSwimmerAlert ? { titulo: swimmerTitle, cuerpo: swimmerBody } : null,
    alertaSurfero: bestSurferAlert ? { titulo: surferTitle, cuerpo: surferBody } : null,
    suscriptoresNadador: subscribersSwimmer.length,
    suscriptoresSurfero: subscribersSurfer.length,
    totalEnviados: totalEnviados,
    estadoDespacho: statusDespacho
  };

  Logger.log("Resultado final Despacho: " + JSON.stringify(summaryResult));
  return summaryResult;
}

/**
 * Calcula el Factor de Escala Dinámico de Orilla (F_orilla) idéntico al motor de la App
 * Prioridad 1: Configuración en vivo desde la pestaña CONFIG_SECTORES_FACTORES
 * Prioridad 2: Factores de fábrica calibrados por playa y sector (Matriz Oficial)
 */
function getBoyaScaleFactorGas(beachKey, waveDir, windDir, windKnots, cloudConfigSectores) {
  var bKey = (beachKey || "misericordia").toLowerCase();
  var wSpd = Number(windKnots || 6.5);
  var isFuerte = wSpd >= 12.0;
  var wDir = (waveDir !== undefined && waveDir !== null && waveDir > 0) ? waveDir : (windDir || 110);

  // 1. Google Sheets cloud config (Prioridad #1: Pestaña CONFIG_SECTORES_FACTORES)
  if (cloudConfigSectores && cloudConfigSectores[bKey] && Array.isArray(cloudConfigSectores[bKey].sectors)) {
    var cloudSecs = cloudConfigSectores[bKey].sectors;
    var matched = null;
    for (var s = 0; s < cloudSecs.length; s++) {
      var sec = cloudSecs[s];
      if (sec.min !== null && sec.max !== null && wDir >= sec.min && wDir <= sec.max) {
        matched = sec;
        break;
      }
    }
    if (matched) {
      var cloudFactor = isFuerte ? matched.factor_fuerte : matched.factor_suave;
      if (cloudFactor !== null && cloudFactor !== undefined && cloudFactor !== "") {
        var parsed = Number(String(cloudFactor).replace(",", ".").trim());
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 2. Determinar sector por grados de seguridad
  var sectorKey = "";
  if (wDir >= 1 && wDir <= 49) sectorKey = isFuerte ? "lev_anortado_fuerte" : "lev_anortado_suave";
  else if (wDir >= 50 && wDir <= 170) sectorKey = isFuerte ? "levante_fuerte" : "levante_suave";
  else if (wDir >= 171 && wDir <= 190) sectorKey = isFuerte ? "sur_fuerte" : "sur_suave";
  else if (wDir >= 191 && wDir <= 230) sectorKey = isFuerte ? "poniente_fuerte" : "poniente_suave";
  else sectorKey = isFuerte ? "terral_fuerte" : "terral_suave";

  // 3. Matriz Oficial de Factores de Fábrica (Idéntica a App.jsx)
  var defaultFactoryMap = {
    misericordia: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.45, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.50, poniente_fuerte: 0.65,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    malagueta: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.60, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.45, poniente_fuerte: 0.60,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    pedregalejo: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.60, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.60, poniente_fuerte: 0.70,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    los_alamos: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.70, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.60, poniente_fuerte: 0.70,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    bajondillo: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.70, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.60, poniente_fuerte: 0.70,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    cala_del_moral: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.70, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 0.90, poniente_fuerte: 0.90,
      terral_suave: 0.25, terral_fuerte: 0.20
    },
    rincon_victoria: {
      lev_anortado_suave: 0.40, lev_anortado_fuerte: 0.60,
      levante_suave: 0.70, levante_fuerte: 0.85,
      sur_suave: 0.50, sur_fuerte: 0.70,
      poniente_suave: 1.00, poniente_fuerte: 1.00,
      terral_suave: 0.25, terral_fuerte: 0.20
    }
  };

  var bMap = defaultFactoryMap[bKey] || defaultFactoryMap.misericordia;
  return bMap[sectorKey] !== undefined ? bMap[sectorKey] : 0.50;
}

/**
 * Despachador de notificaciones Web Push mediante Vercel Serverless Endpoint
 */
function dispatchPushViaVercel(subscriptions, payload) {
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, failed: 0 };
  
  var endpointUrl = PropertiesService.getScriptProperties().getProperty("VERCEL_PUSH_URL") ||
    "https://open-water-forecast.vercel.app/api/send-push";

  try {
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        subscriptions: subscriptions,
        payload: payload
      }),
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch(endpointUrl, options);
    var code = res.getResponseCode();
    if (code === 200) {
      var pushResult = JSON.parse(res.getContentText());
      if (pushResult.deadEndpoints && pushResult.deadEndpoints.length > 0) {
        desactivarSuscripcionesMuertas_(pushResult.deadEndpoints);
      }
      return pushResult;
    } else {
      Logger.log("⚠️ Error en respuesta Vercel Push (" + code + "): " + res.getContentText());
      return { sent: 0, failed: subscriptions.length, error: "HTTP " + code };
    }
  } catch (err) {
    Logger.log("❌ Error conectando con Vercel send-push: " + err.toString());
    return { sent: 0, failed: subscriptions.length, error: err.toString() };
  }
}

/**
 * Configura el disparador automático diario a las 20:00h en España
 * Ejecutar esta función una sola vez desde el editor de Google Apps Script.
 */
/**
 * Configura los dos disparadores automáticos diarios:
 * 1. Recolector de Previsiones a las 19:00h (Europe/Madrid)
 * 2. Despachador de Alertas Push a las 20:00h (Europe/Madrid)
 * Ejecutar esta función una sola vez desde el editor de Google Apps Script.
 */
function instalarTriggersSistemaAlertas() {
  var triggers = ScriptApp.getProjectTriggers();
  var eliminados = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "ejecutarRevisionDiariaAlertas72h" || fn === "recolectarPrevisiones72h" || fn === "instalarTriggerDiario20h") {
      ScriptApp.deleteTrigger(triggers[i]);
      eliminados++;
    }
  }

  // Disparador 1: Recolector a las 19:00h (se ejecutará entre 19:00 y 20:00)
  ScriptApp.newTrigger("recolectarPrevisiones72h")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .create();

  // Disparador 2: Despachador a las 20:00h (se ejecutará entre 20:00 y 21:00)
  ScriptApp.newTrigger("ejecutarRevisionDiariaAlertas72h")
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .create();

  Logger.log("✅ Sistema de activadores configurado con éxito. (Triggers anteriores eliminados: " + eliminados + ")");
}

// Alias de compatibilidad hacia atrás
function instalarTriggerDiario20h() {
  return instalarTriggersSistemaAlertas();
}

/**
 * Ejecución manual de prueba completa:
 * 1. Recolecta la previsión en vivo y llena la caché.
 * 2. Ejecuta el despachador en modo test.
 */
function probarEnvioAlertas72hManual() {
  Logger.log("Iniciando prueba manual del sistema de alertas...");
  Logger.log("Paso 1: Recolectando previsiones satelitales en caché...");
  var recRes = recolectarPrevisiones72h();
  Logger.log("Resultado Recolección: " + JSON.stringify(recRes));
  Logger.log("Paso 2: Evaluando condiciones desde caché y despachando alerta...");
  return ejecutarRevisionDiariaAlertas72h(true);
}
/**
 * ============================================================================
 * MÓDULO DE INGESTA HORARIA DE TELEMETRÍA REAL DE PUERTOS DEL ESTADO (MÁLAGA)
 * - Boya de Málaga (Estación 1514): Oleaje (Hm0, Tp, Tm02, MeanDir) y Temp. Agua
 * - Estación Meteo Dique Levante Sur (Estación 4505): Viento (WindSpeed, WindDir)
 * ============================================================================
 */

function fetchPuertosRealData() {
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json"
  };

  // 1. Boya de MÃ¡laga (1514) - Oleaje y Temperatura
  var urlBoya = "https://poem.puertos.es/portus/StationData?code=1514&params=Hm0,Tp,Tm02,MeanDir,WaterTemp";
  var resBoya = UrlFetchApp.fetch(urlBoya, { muteHttpExceptions: true, headers: headers });
  var boya = { altura: null, periodoPico: null, periodoMedio: null, dirOleaje: null, tempAgua: null, fechaUtc: null };

  if (resBoya.getResponseCode() === 200) {
    try {
      var jsonBoya = JSON.parse(resBoya.getContentText());
      if (jsonBoya && jsonBoya.length > 1 && jsonBoya[1].length > 0) {
        var rowsBoya = jsonBoya[1];
        // BÃºsqueda inversa: tomar la lectura mÃ¡s reciente que contenga altura no nula
        for (var bI = rowsBoya.length - 1; bI >= 0; bI--) {
          var candBoya = rowsBoya[bI];
          if (candBoya && candBoya[1] && candBoya[1][0] !== null && candBoya[1][0] !== undefined) {
            boya.fechaUtc = new Date(candBoya[0] * 1000);
            boya.altura = candBoya[1][0];
            boya.periodoPico = candBoya[2] ? candBoya[2][0] : null;
            boya.periodoMedio = candBoya[3] ? candBoya[3][0] : null;
            boya.dirOleaje = candBoya[4] ? candBoya[4][0] : null;
            boya.tempAgua = candBoya[5] ? candBoya[5][0] : null;
            break;
          }
        }
      }
    } catch (e) {
      Logger.log("Error parseando Boya 1514: " + e);
    }
  }

  // 2. EstaciÃ³n Meteo Dique Levante Sur (4505) - Viento
  var urlViento = "https://poem.puertos.es/portus/StationData?code=4505&params=WindSpeed,WindDir";
  var resViento = UrlFetchApp.fetch(urlViento, { muteHttpExceptions: true, headers: headers });
  var meteo = { vientoMs: null, vientoNudos: null, dirViento: null, fechaUtc: null };

  if (resViento.getResponseCode() === 200) {
    try {
      var jsonViento = JSON.parse(resViento.getContentText());
      if (jsonViento && jsonViento.length > 1 && jsonViento[1].length > 0) {
        var rowsViento = jsonViento[1];
        // BÃºsqueda inversa: tomar la lectura meteorolÃ³gica mÃ¡s reciente con velocidad no nula
        for (var vI = rowsViento.length - 1; vI >= 0; vI--) {
          var candViento = rowsViento[vI];
          if (candViento && candViento[1] && candViento[1][0] !== null && candViento[1][0] !== undefined) {
            meteo.fechaUtc = new Date(candViento[0] * 1000);
            meteo.vientoMs = candViento[1][0];
            meteo.vientoNudos = Math.round(meteo.vientoMs * 1.94384 * 10) / 10;
            meteo.dirViento = candViento[2] ? candViento[2][0] : null;
            break;
          }
        }
      }
    } catch (e) {
      Logger.log("Error parseando Meteo 4505: " + e);
    }
  }

  var isOk = (boya.altura !== null && meteo.vientoMs !== null);
  return {
    boya: boya,
    meteo: meteo,
    status: isOk ? "DATOS_COMPLETOS" : (boya.altura !== null ? "SOLO_BOYA" : (meteo.vientoMs !== null ? "SOLO_VIENTO" : "PARCIAL"))
  };
}

function sincronizarBoyaYMeteoRealHorario(forzarTest) {
  var now = new Date();
  var horaMadrid = parseInt(Utilities.formatDate(now, "Europe/Madrid", "H"), 10);

  // Filtro de horario de nado diurno (06:00 a 21:00)
  if (!forzarTest && (horaMadrid < 6 || horaMadrid > 21)) {
    Logger.log("Fuera de ventana de nado (06:00 a 21:00). Hora actual: " + horaMadrid + ":00. Reposo nocturno.");
    return { status: "reposo_nocturno", hora: horaMadrid };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("REGISTRO_BOYA_REAL");

  // CreaciÃ³n y formateo automÃ¡tico de la pestaÃ±a si no existe
  if (!sheet) {
    sheet = ss.insertSheet("REGISTRO_BOYA_REAL");
    sheet.appendRow([
      "ID_REGISTRO",
      "FECHA_HORA_MADRID",
      "FECHA",
      "HORA",
      "ALTURA_OLA_HM0_M",
      "PERIODO_PICO_TP_S",
      "PERIODO_MEDIO_TM02_S",
      "DIRECCION_OLEAJE_DEG",
      "TEMP_AGUA_REAL_C",
      "VIENTO_VELOCIDAD_MS",
      "VIENTO_VELOCIDAD_KTS",
      "VIENTO_DIRECCION_DEG",
      "ESTADO_CALIDAD",
      "FUENTE",
      "TIMESTAMP_SISTEMA"
    ]);

    var headerRange = sheet.getRange(1, 1, 1, 15);
    headerRange.setBackground("#0f172a"); // Azul marino oscuro
    headerRange.setFontColor("#38bdf8"); // Cyan claro
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    sheet.setFrozenRows(1);
    Logger.log("âœ… PestaÃ±a 'REGISTRO_BOYA_REAL' creada con Ã©xito.");
  }

  var idSlot = Utilities.formatDate(now, "Europe/Madrid", "yyyyMMdd-HH") + "00";

  // Descarga de datos reales
  var datos = fetchPuertosRealData();

  var fechaStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd");
  var horaStr = Utilities.formatDate(now, "Europe/Madrid", "HH:mm");
  var fechaHoraStr = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:00");

  var filaData = [
    idSlot,
    fechaHoraStr,
    fechaStr,
    horaStr,
    datos.boya.altura !== null ? datos.boya.altura : "",
    datos.boya.periodoPico !== null ? datos.boya.periodoPico : "",
    datos.boya.periodoMedio !== null ? datos.boya.periodoMedio : "",
    datos.boya.dirOleaje !== null ? datos.boya.dirOleaje : "",
    datos.boya.tempAgua !== null ? datos.boya.tempAgua : "",
    datos.meteo.vientoMs !== null ? datos.meteo.vientoMs : "",
    datos.meteo.vientoNudos !== null ? datos.meteo.vientoNudos : "",
    datos.meteo.dirViento !== null ? datos.meteo.dirViento : "",
    datos.status,
    "Puertos del Estado (Boya 1514 + Dique 4505)",
    new Date()
  ];

  // Control inteligente anti-duplicados y auto-recuperaciÃ³n de PARCIAL
  var lastRowIdx = sheet.getLastRow();
  var isSameSlot = false;
  var isPreviousPartial = false;

  if (lastRowIdx > 1) {
    var lastRowValues = sheet.getRange(lastRowIdx, 1, 1, 13).getValues()[0];
    if (lastRowValues[0] === idSlot) {
      isSameSlot = true;
      var prevStatus = String(lastRowValues[12] || "");
      isPreviousPartial = (prevStatus !== "DATOS_COMPLETOS");
    }
  }

  if (isSameSlot) {
    if (!forzarTest && !isPreviousPartial) {
      Logger.log("â„¹ï¸ La ranura horaria " + idSlot + " ya cuenta con DATOS_COMPLETOS. Omitiendo duplicado.");
      return { status: "ya_registrado", id: idSlot };
    }
    if (isPreviousPartial && datos.boya.altura !== null) {
      // Auto-recuperaciÃ³n: actualizar la fila parcial anterior con los datos completos reciÃ©n llegados
      sheet.getRange(lastRowIdx, 1, 1, 15).setValues([filaData]);
      Logger.log("ðŸ”„ Ranura " + idSlot + " recuperada de PARCIAL a DATOS_COMPLETOS con Ã©xito: Hm0=" + datos.boya.altura + "m");
      return { status: "recuperado_completo", id: idSlot, datos: datos };
    }
    if (!forzarTest) {
      Logger.log("â„¹ï¸ La ranura horaria " + idSlot + " ya estaba registrada y sigue sin datos nuevos de oleaje.");
      return { status: "ya_registrado_parcial", id: idSlot };
    }
  }

  sheet.appendRow(filaData);
  Logger.log("âœ… Fila registrada con Ã©xito en REGISTRO_BOYA_REAL: " + idSlot + " | Ola: " + datos.boya.altura + "m | Viento: " + datos.meteo.vientoNudos + " kts | Estado: " + datos.status);
  return { status: "ok", id: idSlot, datos: datos };
}

/**
 * FunciÃ³n para ejecutar la PRIMERA PRUEBA MANUAL en directo
 */
function probarSincronizacionBoyaRealManual() {
  return sincronizarBoyaYMeteoRealHorario(true);
}

/**
 * Instalador en 1 clic del Activador Horario Automático
 */
function instalarActivadorHorarioBoya() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sincronizarBoyaYMeteoRealHorario") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("sincronizarBoyaYMeteoRealHorario")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("✅ Activador horario instalado correctamente (se ejecutará cada hora).");
}

/**
 * Limpieza automÃ¡tica de suscripciones caducadas o revocadas (HTTP 410 Gone / 404 Not Found)
 */
function desactivarSuscripcionesMuertas_(deadEndpoints) {
  if (!deadEndpoints || deadEndpoints.length === 0) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pushSheet = ss.getSheetByName("SUSCRIPTORES_PUSH");
    if (!pushSheet || pushSheet.getLastRow() <= 1) return;
    
    var rows = pushSheet.getDataRange().getValues();
    var pHeaders = rows[0].map(function(h) { return String(h).trim().toUpperCase(); });
    var idxEp = pHeaders.indexOf("ENDPOINT");
    var idxEstado = pHeaders.indexOf("ESTADO");
    if (idxEp === -1) idxEp = 1;
    if (idxEstado === -1) idxEstado = 7;

    var count = 0;
    for (var r = 1; r < rows.length; r++) {
      var ep = String(rows[r][idxEp] || "").trim();
      if (deadEndpoints.indexOf(ep) !== -1) {
        pushSheet.getRange(r + 1, idxEstado + 1).setValue("BAJA_EXPIRADO");
        count++;
      }
    }
    Logger.log("ðŸ§¹ Limpieza automÃ¡tica: " + count + " suscripciones muertas marcadas como BAJA_EXPIRADO.");
  } catch (err) {
    Logger.log("âš ï¸ Error en desactivarSuscripcionesMuertas_: " + err.toString());
  }
}
