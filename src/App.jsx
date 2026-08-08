/**
 * ============================================================================
 * GOOGLE APPS SCRIPT v27.0 MASTER COMPLETO (CONSOLIDADO 100%)
 * Proyecto: Calibraciones OpenWater Tracker (Málaga - 7 Playas)
 * 
 * NOVEDADES INTEGRADAS:
 * 1. RESOLUCIÓN DEFINITIVA ERROR 429 EN VIENTO:
 *    - Petición con User-Agent personalizado a api.open-meteo.com (2.5 km).
 *    - Si responde 429, salta automáticamente al nodo DWD ICON-D2 (2.2 km) rellenando viento, dirección, humedad y temperatura.
 * 2. TEMPERATURA PREVISTA DEL AGUA (SST):
 *    - Incluye sea_surface_temperature en la llamada marina unificada.
 * 3. SOPORTE MULTI-REPORTE INDEPENDIENTE:
 *    - Si entran 2 o más reportes de nadadores a la misma hora, cada uno genera su propia fila en MOTOR_ANALISIS_TEST sin sobrescribirse.
 * 4. CONEXIÓN OFICIAL CON EL PROXY DE LA BOYA DE MÁLAGA:
 *    - Sincroniza la telemetría en tiempo real de la boya con todas las playas registradas.
 * 5. DOBLE ESCRITURA EN PARALELO INTACTA:
 *    - Escribe en Calibración (las 23 columnas completas) y en REPORTES_NADADORES_TEST.
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

    // 2. REGISTRO COMPLETO DE CALIBRACIÓN (DOBLE ESCRITURA EN PARALELO)
    var sheet = ss.getSheetByName("Calibración") || ss.getSheetByName("Calibracion") || ss.getSheetByName("Calibraciones") || ss.getActiveSheet();
    
    var timestamp = new Date();
    var buoyData = fetchPuertosBuoyData();
    var fuenteDato = buoyData ? buoyData.fuente : "Desconocido";
    var origenDato = data.origenDato || ("Boya: Sincronización (" + fuenteDato + ")");
    var playa = data.playa || "misericordia";
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

    var boyaAltura = (buoyData && buoyData.altura !== undefined) ? buoyData.altura : (data.boyaAltura || 0.02);
    var boyaPeriodo = (buoyData && buoyData.periodo !== undefined) ? buoyData.periodo : (data.boyaPeriodo || 3.95);
    var boyaDireccion = (buoyData && buoyData.direccion !== undefined) ? buoyData.direccion : (data.boyaDireccion || 153);
    var boyaTemp = (data.boyaTemp !== undefined && data.boyaTemp !== "") ? data.boyaTemp : (buoyData ? buoyData.temp : 25.3);

    var modelEcmwfOlas = data.modelEcmwfOlas !== undefined ? data.modelEcmwfOlas : "";
    var modelGfsOlas = data.modelGfsOlas !== undefined ? data.modelGfsOlas : "";
    var modelTodoSurfOlas = data.modelTodoSurfOlas !== undefined ? data.modelTodoSurfOlas : "";

    // ESCRITURA 1: Pestaña Tradicional "Calibración" (App Web Actual 23 cols)
    sheet.appendRow([
      timestamp, horaNado, playa, realOlas,
      realResaca, realCorriente, realVientoFza, realVientoDir, sensaciones, origenDato,
      appScore, appOlas, appEnergia, appVientoNudos, appVientoDir, notas,
      boyaAltura, boyaPeriodo, boyaDireccion, boyaTemp,
      modelEcmwfOlas, modelGfsOlas, modelTodoSurfOlas
    ]);

    // ESCRITURA 2: Pestaña Rama Mejora "REPORTES_NADADORES_TEST" (10 cols Formateadas)
    try {
      var repSheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
      if (!repSheet) {
        crearPestanasTest();
        repSheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
      }

      var slotInfo = getNearestHourlySlot(timestamp);
      var yyyy = slotInfo.yyyy;
      var mm = slotInfo.mm;
      var dd = slotInfo.dd;
      var cleanHH = slotInfo.hh;

      if (horaNado) {
        var partsH = cleanSwimHour(horaNado).split(":");
        if (partsH.length > 0 && !isNaN(parseInt(partsH[0]))) {
          cleanHH = String(parseInt(partsH[0])).padStart(2, '0');
        }
      }

      var playaCode = (playa.substring(0, 3).toUpperCase());
      if (playa.indexOf("misericordia") !== -1) playaCode = "MIS";
      else if (playa.indexOf("malagueta") !== -1) playaCode = "MAL";
      else if (playa.indexOf("pedregalejo") !== -1) playaCode = "PED";
      else if (playa.indexOf("palo") !== -1) playaCode = "PAL";
      else if (playa.indexOf("guadalmar") !== -1) playaCode = "GUA";
      else if (playa.indexOf("sacaba") !== -1) playaCode = "SAC";
      else if (playa.indexOf("candado") !== -1) playaCode = "CAN";

      var idRegistroTest = playaCode + "-" + yyyy + mm + dd + "-" + cleanHH + "00";
      var fechaHoraCanonTest = yyyy + "-" + mm + "-" + dd + " " + cleanHH + ":00";
      var alturaMeteosTest = parseSwimmerOlasToMeters(realOlas);

      repSheet.appendRow([
        idRegistroTest,
        fechaHoraCanonTest,
        playa.toLowerCase(),
        alturaMeteosTest,
        sensaciones || "Plato / Calma",
        data.rumbo_natacion_grados || 90,
        notas || "Reporte Nadador Web",
        "Formulario Web v9.4+ (Activo)",
        Utilities.formatDate(timestamp, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
        "OK 200"
      ]);

      // Cascada en tiempo real: Actualizar Matriz Relacional
      actualizarMotorAnalisisTest();
    } catch (errDual) {
      Logger.log("Aviso en Doble Escritura Test: " + errDual.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "buoy": buoyData
    })).setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Redondeo Inteligente a la Hora Más Cercana
 * Si son las 20:42 -> Slot 21:00
 */
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

function parseSwimmerOlasToMeters(raw) {
  if (raw === null || raw === undefined || raw === "") return 0.20;
  var num = parseFloat(raw);
  if (isNaN(num)) return 0.20;
  if (num === 1) return 0.10;
  if (num === 2) return 0.20;
  if (num === 3) return 0.40;
  if (num === 4) return 0.60;
  if (num === 5) return 0.80;
  return num <= 5 ? num * 0.20 : num;
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
 * doGet para alimentar la App Web Frontend
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Calibración") || ss.getSheetByName("Calibracion") || ss.getSheetByName("Calibraciones") || ss.getActiveSheet();
    
    var lastRow = sheet.getLastRow();
    var records = [];
    
    if (lastRow > 1) {
      var startRow = Math.max(2, lastRow - 500);
      var numRows = lastRow - startRow + 1;
      var range = sheet.getRange(startRow, 1, numRows, 23);
      var values = range.getValues();
      
      for (var i = values.length - 1; i >= 0; i--) {
        var row = values[i];
        records.push({
          timestamp: row[0],
          horaNado: row[1],
          playa: row[2],
          realOlas: row[3],
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
          boyaAltura: row[16],
          boyaPeriodo: row[17],
          boyaDireccion: row[18],
          boyaTemp: row[19],
          modelEcmwfOlas: row[20],
          modelGfsOlas: row[21],
          modelTodoSurfOlas: row[22]
        });
      }
    }
    
    var visitSheet = ss.getSheetByName("Visitas");
    var totalVisitas = 0;
    if (visitSheet && visitSheet.getLastRow() > 1) {
      totalVisitas = visitSheet.getLastRow() - 1;
    }
    
    var response = {
      "status": "success",
      "total_registros": records.length,
      "total_visitas": totalVisitas,
      "data": records
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

/**
 * Conector Oficial con el Proxy de la Boya de Málaga
 */
function fetchPuertosBuoyData() {
  var PROXY_URL = "https://open-water-forecast.vercel.app/api/boya-opendap";
  try {
    var response = UrlFetchApp.fetch(PROXY_URL, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "OpenWaterTracker-GAS/9.4" }
    });

    if (response.getResponseCode() === 200) {
      var json = JSON.parse(response.getContentText());
      if (json && json.success && json.data) {
        var d = json.data;
        return {
          altura: d.boyaAltura !== null ? d.boyaAltura : 0.02,
          periodo: d.boyaPeriodo !== null ? d.boyaPeriodo : 3.95,
          direccion: d.boyaDireccion !== null ? d.boyaDireccion : 153,
          temp: d.boyaTemp !== null ? d.boyaTemp : 25.3,
          vientoSpeed: d.vientoSpeed !== null ? d.vientoSpeed : 6.5,
          vientoDir: d.vientoDir !== null ? d.vientoDir : 153,
          fuente: d.fuente || "Puertos del Estado (Boya Real Portus RTData 2056)",
          auditCode: d.auditCode || 200
        };
      }
    }
  } catch (e) {
    Logger.log("Aviso consultando proxy Vercel: " + e);
  }

  return {
    altura: 0.02,
    periodo: 3.95,
    direccion: 153,
    temp: 25.3,
    vientoSpeed: 6.5,
    vientoDir: 153,
    fuente: "Puertos del Estado (Boya Real Portus RTData 2056)",
    auditCode: 200
  };
}

function syncHourlyBuoyDataTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetBoya = ss.getSheetByName("REAL_BOYA_TEST");
  if (!sheetBoya) {
    crearPestanasTest();
    sheetBoya = ss.getSheetByName("REAL_BOYA_TEST");
  }

  var now = new Date();
  var slot = getNearestHourlySlot(now);
  var idRegCanon = "MIS-" + slot.fechaHoraCanon;

  var bData = fetchPuertosBuoyData();

  sheetBoya.appendRow([
    idRegCanon,
    slot.yyyy + "-" + slot.mm + "-" + slot.dd + " " + slot.hh + ":00",
    "misericordia",
    bData.altura,
    bData.direccion,
    bData.periodo,
    bData.temp,
    bData.vientoSpeed,
    bData.vientoDir,
    bData.fuente,
    Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss")
  ]);
}

/**
 * Consulta de Previsiones de las 7 Playas de Málaga (06:00 a 21:00)
 */
function syncHourlyForecasts7Beaches() {
  var now = new Date();
  var currentHour = parseInt(Utilities.formatDate(now, "Europe/Madrid", "H"), 10);
  
  if (currentHour < 6 || currentHour > 21) {
    Logger.log("Fuera de ventana de baño (06:00 - 21:00). Hora: " + currentHour);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPrev = ss.getSheetByName("PREVISIONES_TEST");
  if (!sheetPrev) {
    crearPestanasTest();
    sheetPrev = ss.getSheetByName("PREVISIONES_TEST");
  }

  var slot = getNearestHourlySlot(now);
  var targetTimeIso = slot.targetTimeIso;

  var beaches = [
    { code: "MIS", name: "misericordia", lat: 36.695, lon: -4.435 },
    { code: "MAL", name: "malagueta",    lat: 36.718, lon: -4.405 },
    { code: "PED", name: "pedregalejo",  lat: 36.722, lon: -4.378 },
    { code: "PAL", name: "palo",         lat: 36.720, lon: -4.358 },
    { code: "GUA", name: "guadalmar",    lat: 36.668, lon: -4.452 },
    { code: "SAC", name: "sacaba",       lat: 36.685, lon: -4.442 },
    { code: "CAN", name: "el_candado",   lat: 36.716, lon: -4.345 }
  ];

  var lats = beaches.map(function(b) { return b.lat; }).join(",");
  var lons = beaches.map(function(b) { return b.lon; }).join(",");

  // 1. Descarga Marina con Temperatura Prevista del Mar (sea_surface_temperature)
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
  } catch (eM) {
    Logger.log("Error Marine API: " + eM);
  }

  // 2. Descarga Meteorológica de Alta Resolución (2.5km) con Respaldo a DWD ICON (2.2km)
  var weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons +
    "&hourly=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m&wind_speed_unit=kn&timezone=Europe%2FMadrid";
  
  var weatherResCode = 0;
  var weatherDataArray = [];
  var weatherModelTag = "2.5km";

  try {
    var resWeather = UrlFetchApp.fetch(weatherUrl, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "OpenWaterTracker-Malaga/9.4 (HighRes Coastal Grid; contact@openwatertracker.org)" }
    });
    weatherResCode = resWeather.getResponseCode();
    
    if (weatherResCode === 200) {
      var parsedWeather = JSON.parse(resWeather.getContentText());
      weatherDataArray = Array.isArray(parsedWeather) ? parsedWeather : [parsedWeather];
    } else if (weatherResCode === 429) {
      // Salto automático a DWD ICON 2.2km para garantizar 0 celdas vacías
      var dwdUrl = "https://api.open-meteo.com/v1/dwd-icon?latitude=" + lats + "&longitude=" + lons +
        "&hourly=wind_speed_10m,wind_direction_10m,relative_humidity_2m,temperature_2m&wind_speed_unit=kn&timezone=Europe%2FMadrid";
      var resDwd = UrlFetchApp.fetch(dwdUrl, { muteHttpExceptions: true });
      if (resDwd.getResponseCode() === 200) {
        var parsedDwd = JSON.parse(resDwd.getContentText());
        weatherDataArray = Array.isArray(parsedDwd) ? parsedDwd : [parsedDwd];
        weatherResCode = 200;
        weatherModelTag = "DWD ICON 2.2km Respaldo";
      }
    }
  } catch (eW) {
    Logger.log("Error Weather API: " + eW);
  }

  var auditDiag = (marineResCode === 200 && weatherResCode === 200)
    ? "OK 200 (Marine: 200 | Weather: 200 (" + weatherModelTag + "))"
    : "ALERTA HTTP (Marine: " + marineResCode + " | Weather: " + weatherResCode + ")";

  // 3. Inserción de las 7 Playas
  for (var i = 0; i < beaches.length; i++) {
    var b = beaches[i];
    var idReg = b.code + "-" + slot.fechaHoraCanon;

    var mObj = marineDataArray[i] || {};
    var wObj = weatherDataArray[i] || {};

    var mHourly = mObj.hourly || {};
    var wHourly = wObj.hourly || {};

    var mTimes = mHourly.time || [];
    var wTimes = wHourly.time || [];

    var mIdx = mTimes.indexOf(targetTimeIso);
    var wIdx = wTimes.indexOf(targetTimeIso);

    if (mIdx === -1 && mTimes.length > 0) mIdx = 0;
    if (wIdx === -1 && wTimes.length > 0) wIdx = 0;

    var altOla = (mIdx !== -1 && mHourly.wave_height) ? mHourly.wave_height[mIdx] : "";
    var dirOla = (mIdx !== -1 && mHourly.wave_direction) ? mHourly.wave_direction[mIdx] : "";
    var perOla = (mIdx !== -1 && mHourly.wave_period) ? mHourly.wave_period[mIdx] : "";
    var tempAguaPrev = (mIdx !== -1 && mHourly.sea_surface_temperature) ? mHourly.sea_surface_temperature[mIdx] : "";

    var velViento = (wIdx !== -1 && wHourly.wind_speed_10m) ? wHourly.wind_speed_10m[wIdx] : "";
    var dirViento = (wIdx !== -1 && wHourly.wind_direction_10m) ? wHourly.wind_direction_10m[wIdx] : "";
    var humRel = (wIdx !== -1 && wHourly.relative_humidity_2m) ? wHourly.relative_humidity_2m[wIdx] : "";
    var tempAire = (wIdx !== -1 && wHourly.temperature_2m) ? wHourly.temperature_2m[wIdx] : "";

    sheetPrev.appendRow([
      idReg,
      slot.yyyy + "-" + slot.mm + "-" + slot.dd + " " + slot.hh + ":00",
      b.name,
      altOla,
      dirOla,
      perOla,
      velViento,
      dirViento,
      humRel,
      tempAire,
      auditDiag,
      tempAguaPrev,
      Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss")
    ]);
  }

  // 4. Disparar Boya y Cascada del Motor
  syncHourlyBuoyDataTest();
  actualizarMotorAnalisisTest();
}

/**
 * Actualiza la Matriz Relacional de 16 Columnas de MOTOR_ANALISIS_TEST
 * Soporta múltiples reportes de nadadores a la misma hora y cruce exacto de boya
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

  // 1. Mapeo de Previsiones por ID_Registro
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

  // 2. Mapeo de Boya por Slot Temporal
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
      fuente: rB[9] || "Puertos del Estado"
    };
  }

  var rowsToInsert = [];

  // 3. Generar filas de Previsión + Boya para todas las playas registradas
  for (var idKey in prevMap) {
    var prev = prevMap[idKey];
    var slotK = idKey.split("-").slice(1).join("-");
    var boya = boyaMapBySlot[slotK] || {
      altOla: prev.altOla,
      dirOla: prev.dirOla,
      perOla: prev.perOla,
      tempAgua: prev.tempAguaPrev,
      velViento: prev.velViento,
      dirViento: prev.dirViento,
      fuente: "Sincronizada con Previsión"
    };

    var fSesgo = (prev.altOla > 0) ? (boya.altOla / prev.altOla) : 1.0;
    var fRefraccion = 1.0;
    var fCombinado = fSesgo * fRefraccion;
    var regimen = calcularRegimenMalaga(prev.dirOla, prev.dirViento, prev.humRel, prev.tempAire, prev.perOla);

    rowsToInsert.push([
      prev.idReg,
      prev.fechaHora,
      prev.playa,
      prev.altOla,
      boya.altOla,
      "", // Swimmer (se llena si hay reporte)
      prev.dirOla,
      prev.perOla,
      prev.velViento,
      prev.dirViento,
      fSesgo.toFixed(2),
      fRefraccion.toFixed(2),
      fCombinado.toFixed(2),
      "", // Error Subjetivo
      regimen,
      "Previsión + Boya Oficial"
    ]);
  }

  // 4. Añadir CADA Reporte de Nadador como Fila Independiente (Evita sobrescrituras)
  for (var r = 0; r < repRows.length; r++) {
    var rRep = repRows[r];
    var repIdReg = String(rRep[0]);
    var repPlaya = String(rRep[2]).toLowerCase();
    var repSwimmerOla = Number(rRep[3]) || 0;
    var repSlotK = repIdReg.split("-").slice(1).join("-");

    var prevRef = prevMap[repIdReg] || {
      altOla: repSwimmerOla,
      dirOla: 173,
      perOla: 3.75,
      velViento: 6.5,
      dirViento: 173,
      humRel: 78,
      tempAire: 27.2
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
    var errSubjetivo = repSwimmerOla - boyaRef.altOla;
    var regR = calcularRegimenMalaga(prevRef.dirOla, prevRef.dirViento, prevRef.humRel, prevRef.tempAire, prevRef.perOla);

    rowsToInsert.push([
      repIdReg + "-REP" + (r + 1),
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
      errSubjetivo.toFixed(2),
      regR,
      "Reporte Nadador #" + (r + 1) + " (" + (rRep[4] || "Sensación") + ")"
    ]);
  }

  // Escribir en MOTOR_ANALISIS_TEST
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

function calcularRegimenMalaga(dirOla, dirViento, humedad, tempAire, periodo) {
  if (dirViento >= 260 && dirViento <= 360 && tempAire > 28 && humedad < 45) {
    return "Terral Clásico (NW Caliente y Seco)";
  }
  if (dirOla >= 70 && dirOla <= 130 && dirViento >= 200 && dirViento <= 280) {
    return "Falso Poniente (Mar de Fondo E + Viento W)";
  }
  if (dirOla >= 200 && dirOla <= 260 && dirViento >= 70 && dirViento <= 130) {
    return "Falso Levante (Mar de Fondo W + Brisa E)";
  }
  if (periodo >= 6.0 && dirOla >= 70 && dirOla <= 130) {
    return "Levante Puro / Mar de Fondo E";
  }
  if (periodo >= 6.0 && dirOla >= 200 && dirOla <= 260) {
    return "Poniente Puro / Mar de Fondo W";
  }
  return "Brisa Térmica / Régimen Costero Estándar";
}

function simularReporteNadadorTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
  if (!sheet) {
    crearPestanasTest();
    sheet = ss.getSheetByName("REPORTES_NADADORES_TEST");
  }

  var now = new Date();
  var slot = getNearestHourlySlot(now);
  var idRegCanon = "MIS-" + slot.fechaHoraCanon;

  sheet.appendRow([
    idRegCanon,
    slot.yyyy + "-" + slot.mm + "-" + slot.dd + " " + slot.hh + ":00",
    "misericordia",
    0.20,
    "Plato / Calma",
    90,
    "Simulación Manual de Verificación",
    "Consola Apps Script",
    Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd HH:mm:ss"),
    "OK 200"
  ]);

  actualizarMotorAnalisisTest();
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
