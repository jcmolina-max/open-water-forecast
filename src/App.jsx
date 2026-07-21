import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  MapPin, 
  Bot,
  Loader2,
  AlertTriangle,
  Activity,
  Thermometer,
  Sun,
  Clock,
  Droplets,
  ThumbsUp,
  ThumbsDown,
  CalendarDays,
  AlertCircle,
  Anchor,
  BookOpen, 
  X, 
  Wind, 
  ThermometerSun, 
  ShieldAlert,
  ArrowUpRight,
  Info,
  Compass,
  History,
  TestTubes,
  Zap,
  CloudFog,
  RefreshCw,
  Copy,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Coordenadas reales de las playas y su orientación (grados respecto al Norte mirando al mar)
const BEACHES = {
  misericordia: { name: "La Misericordia, Málaga", lat: 36.696, lon: -4.444, facing: 135 },
  malagueta: { name: "La Malagueta, Málaga", lat: 36.718, lon: -4.407, facing: 180 },
  pedregalejo: { name: "Pedregalejo, Málaga", lat: 36.721, lon: -4.386, facing: 180 },
  // v9.4+ — expansión costera (Open-Meteo: mismos endpoints, lat/lon por playa)
  los_alamos: { name: "Los Álamos, Torremolinos", lat: 36.6398, lon: -4.4815, facing: 188 },
  bajondillo: { name: "El Bajondillo, Torremolinos", lat: 36.6271, lon: -4.4916, facing: 182 },
  rincon_victoria: { name: "Rincón de la Victoria, Málaga", lat: 36.7131, lon: -4.2743, facing: 162 },
  cala_del_moral: { name: "La Cala del Moral, Rincón de la Victoria", lat: 36.7148, lon: -4.31, facing: 148 }
};

// Generador de etiquetas de fecha
const getDateLabel = (offset, prefix) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const day = d.getDate();
  const monthStr = d.toLocaleString('es-ES', { month: 'short' });
  return `${prefix} (${day} ${monthStr})`;
};

/**
 * Coeficiente dinámico de energía de ola (v10.0 motor Kj).
 * Dirección en grados = procedencia del oleaje (convención Open-Meteo, desde el norte en sentido horario).
 * Energía ≈ altura² × periodo × coeficiente.
 * Bases: S+SSE 7.5 | SE 8.5 | SO 9.5 | resto 8.0. Periodo >5s +1.5 | <4s −0.5.
 */
const getDynamicWaveEnergyCoefficient = (waveDirDeg, period) => {
  const p = Number(period);
  let base = 8.0;

  if (waveDirDeg !== undefined && waveDirDeg !== null && !Number.isNaN(Number(waveDirDeg))) {
    const d = ((Number(waveDirDeg) % 360) + 360) % 360;
    // Sur (S) + Sur-Sureste (SSE): sectores 16 puntos contiguos (~146°–191°)
    if (d >= 146.25 && d < 191.25) base = 7.5;
    else if (d >= 123.75 && d < 146.25) base = 8.5; // Sureste (SE)
    else if (d >= 202.5 && d < 247.5) base = 9.5; // Suroeste (SO)
    else base = 8.0;
  }

  let coef = base;
  if (!Number.isNaN(p)) {
    if (p > 5) coef += 1.5;
    if (p < 4) coef -= 0.5;
  }
  return Math.round(coef * 100) / 100;
};

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec";

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  // Por defecto seleccionamos "Hoy" (Índice 1, ya que Ayer es 0)
  const [selectedDay, setSelectedDay] = useState(1); 
  const [beachData, setBeachData] = useState(null); 
  const [currentNowData, setCurrentNowData] = useState(null); // Datos del momento exacto actual
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de calibración y administración (Fase 2)
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'comparison'
  const [expandedHourIdx, setExpandedHourIdx] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [isCalHistoryLoading, setIsCalHistoryLoading] = useState(false);
  
  // Formulario del Administrador
  const [adminPlaya, setAdminPlaya] = useState('misericordia');
  const [adminHoraNado, setAdminHoraNado] = useState('11:00');
  const [adminRealOlas, setAdminRealOlas] = useState(3);
  const [adminRealResaca, setAdminRealResaca] = useState(1);
  const [adminRealCorriente, setAdminRealCorriente] = useState(1);
  const [adminRealVientoFza, setAdminRealVientoFza] = useState('Suave');
  const [adminRealVientoDir, setAdminRealVientoDir] = useState('S/SO');
  const [adminSensaciones, setAdminSensaciones] = useState('');
  const [adminNotas, setAdminNotas] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);

  // Estados del selector histórico y diagnóstico (Fase 4)
  const [selectedHistoryLog, setSelectedHistoryLog] = useState(null);
  const [adminBoyaAltura, setAdminBoyaAltura] = useState('');
  const [adminBoyaPeriodo, setAdminBoyaPeriodo] = useState('');
  const [adminBoyaDireccion, setAdminBoyaDireccion] = useState('');
  const [adminBoyaTemp, setAdminBoyaTemp] = useState('');

  // Estados para el reporte público de nadadores (Comunidad)
  const [isSwimmerModalOpen, setIsSwimmerModalOpen] = useState(false);
  const [swimmerPlaya, setSwimmerPlaya] = useState('misericordia');
  const [swimmerHoraNado, setSwimmerHoraNado] = useState('11:00');
  const [swimmerRealOlas, setSwimmerRealOlas] = useState(3);
  const [swimmerRealResaca, setSwimmerRealResaca] = useState(1);
  const [swimmerRealCorriente, setSwimmerRealCorriente] = useState(1);
  const [swimmerSensaciones, setSwimmerSensaciones] = useState('');
  const [isSendingSwimmerReport, setIsSendingSwimmerReport] = useState(false);
  const [swimmerReportStatus, setSwimmerReportStatus] = useState(null);
  const [swimmerMedusas, setSwimmerMedusas] = useState('Ninguna');
  const [swimmerAgua, setSwimmerAgua] = useState('Limpia');

  // Previsiones detalladas (comparador)
  const [comparisonForecast, setComparisonForecast] = useState(null);
  const [isCompLoading, setIsCompLoading] = useState(false);
  
  const [errorDetails, setErrorDetails] = useState(null);
  const [isClimateDown, setIsClimateDown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para el Socorrista IA
  const [expertAdvice, setExpertAdvice] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasRequestedAi, setHasRequestedAi] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  // Dynamic Buoy Scale Factor (Fase 4)
  const getBoyaScaleFactor = (beachKey, currentDirection) => {
    if (calibrationHistory.length < 5) {
      if (beachKey === 'misericordia') return 0.6; // default 40% reduction
      if ((beachKey === 'malagueta' || beachKey === 'pedregalejo') && currentDirection >= 200 && currentDirection <= 300) return 0.7; // default 30% reduction (escudo)
      return 1.0;
    }
    
    const relevantLogs = calibrationHistory.filter(log => {
      if (log.playa !== beachKey) return false;
      if (!log.boyaAltura || Number(log.boyaAltura) === 0) return false;
      
      if (log.boyaDireccion && currentDirection) {
        let diff = Math.abs(Number(log.boyaDireccion) - currentDirection);
        if (diff > 180) diff = 360 - diff;
        if (diff > 35) return false;
      }
      return true;
    });
    
    if (relevantLogs.length === 0) {
      if (beachKey === 'misericordia') return 0.6;
      if ((beachKey === 'malagueta' || beachKey === 'pedregalejo') && currentDirection >= 200 && currentDirection <= 300) return 0.7;
      return 1.0;
    }
    
    const scaleToMeters = (val) => {
      const v = Number(val);
      if (v === 1) return 0.05;
      if (v === 2) return 0.20;
      if (v === 3) return 0.45;
      if (v === 4) return 0.80;
      if (v === 5) return 1.20;
      return 0.3;
    };
    
    let sumRatio = 0;
    relevantLogs.forEach(log => {
      const swimmerM = scaleToMeters(log.realOlas);
      const buoyM = Number(log.boyaAltura);
      sumRatio += swimmerM / buoyM;
    });
    
    const calculatedFactor = sumRatio / relevantLogs.length;
    return Math.max(0.1, Math.min(1.5, calculatedFactor));
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  useEffect(() => {
    const fetchRealData = async () => {
      setIsLoading(true);
      setErrorDetails(null);
      setIsClimateDown(false);
      setHasRequestedAi(false);
      setExpertAdvice("");
      setSelectedDay(1); 
      setCurrentNowData(null);
      
      const beach = BEACHES[selectedBeach];
      
      let marineJson = null;
      let weatherJson = null;
      let localClimateDown = false;

      const fetchWithTimeout = async (url, ms = 10000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
             const errData = await response.json().catch(() => ({}));
             throw new Error(errData.reason || `Error HTTP ${response.status}`);
          }
          return await response.json();
          
        } catch (e) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') throw new Error('Timeout (>10s)');
          if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) throw new Error('Conexión bloqueada.');
          throw e; 
        }
      };

      // 1. SATÉLITE CLIMA (Añadimos visibility para la niebla)
      try {
        weatherJson = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,precipitation,weather_code,uv_index,cloud_cover,visibility&timezone=Europe%2FMadrid&past_days=2`);
      } catch (e) {
        console.warn("Satélite de clima caído. Activando auto-rescate.", e);
        localClimateDown = true;
        setIsClimateDown(true);
      }

      // 2. SATÉLITE MARINO
      try {
        marineJson = await fetchWithTimeout(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature&timezone=Europe%2FMadrid&past_days=2`);
      } catch (e) {
         setErrorDetails({ general: `El satélite marino no responde: ${e.message}` });
         setIsLoading(false);
         return; 
      }

      // 3. PROCESAMOS LOS DATOS
      try {
        const daysProcessed = []; 
        const dayOffsets = [-1, 0, 1, 2];
        const dayPrefixes = ["Ayer", "Hoy", "Mañana", "Pasado"];
        
        let tempCurrentNow = null;
        const currentSystemHour = new Date().getHours();

        for (let d = 0; d < dayOffsets.length; d++) {
          const offset = dayOffsets[d];
          
          const baseIndex = (offset + 2) * 24; 
          const startIndex = baseIndex + 6;
          const endIndex = baseIndex + 21;

          // ----- CÁLCULO DE CALIDAD DEL AGUA (Aguas Sucias) -----
          let rainSum = 0;
          if (!localClimateDown && weatherJson?.hourly?.precipitation) {
              for (let k = baseIndex - 24; k <= baseIndex + 21; k++) {
                  if (k >= 0 && k < weatherJson.hourly.precipitation.length) {
                      rainSum += weatherJson.hourly.precipitation[k] || 0;
                  }
              }
          }
          
          let wqStatus = "Presumiblemente Limpia";
          let wqColor = "text-blue-600";
          let wqBg = "bg-blue-50 border-blue-100";
          let wqDesc = `Sin lluvias fuertes recientes (${rainSum.toFixed(1)}mm).`;

          if (localClimateDown) {
              wqStatus = "Desconocida";
              wqColor = "text-slate-500";
              wqBg = "bg-slate-100 border-slate-200";
              wqDesc = "Satélite desconectado.";
          } else if (rainSum >= 2.0) {
              wqStatus = "Riesgo Alto";
              wqColor = "text-red-600";
              wqBg = "bg-red-50 border-red-200";
              wqDesc = `Aliviaderos activos. Lluvia acum: ${rainSum.toFixed(1)}mm.`;
          } else if (rainSum >= 0.5) {
              wqStatus = "Precaución";
              wqColor = "text-amber-600";
              wqBg = "bg-amber-50 border-amber-200";
              wqDesc = `Posible arrastre. Lluvia acum: ${rainSum.toFixed(1)}mm.`;
          }

          let translatedHourlyData = [];
          let totalScore = 0;
          let maxScore = -1;
          let minScore = 101;
          let bestHourTime = "";
          let worstHourTime = "";
          
          let eastWindCount = 0;
          let maxEastWind = 0;
          let validHoursCount = 0;
          let hasStormRiskToday = false;

          for (let i = startIndex; i <= endIndex; i++) {
            if (!marineJson?.hourly?.wave_height || i >= marineJson.hourly.wave_height.length) break;

            const waveHeightStr = marineJson.hourly.wave_height[i];
            const waveHeight = waveHeightStr !== null ? waveHeightStr : 0.1;
            const period = marineJson.hourly?.wave_period?.[i] || 4;
            const waveDir = marineJson.hourly?.wave_direction?.[i];
            
            const displayHour = i % 24;
            const windKmh = localClimateDown ? 0 : (weatherJson?.hourly?.wind_speed_10m?.[i] || 0);
            let windKnots = Math.round(windKmh / 1.852);
            let gustKnots = localClimateDown ? 0 : Math.round((weatherJson?.hourly?.wind_gusts_10m?.[i] || 0) / 1.852);
            const windDir = localClimateDown ? 0 : (weatherJson?.hourly?.wind_direction_10m?.[i] || 0);
            const cloudCover = localClimateDown ? "-" : (weatherJson?.hourly?.cloud_cover?.[i] || 0);
            const wCode = localClimateDown ? 0 : (weatherJson?.hourly?.weather_code?.[i] || 0);
            const visibility = localClimateDown ? 10000 : (weatherJson?.hourly?.visibility?.[i] || 10000);
            const rainMm = localClimateDown ? 0 : (weatherJson?.hourly?.precipitation?.[i] || 0);
            const rainProb = localClimateDown ? "-" : (weatherJson?.hourly?.precipitation_probability?.[i] || 0);
            
            // Regla: Multiplicador Térmico de Mediodía en Misericordia (v9.5)
            const isMisericordia = selectedBeach === 'misericordia';
            if (isMisericordia && !localClimateDown) {
                const isNoonWindow = displayHour >= 12 && displayHour <= 18;
                const isSouthOrSouthWestWind = windDir >= 157.5 && windDir <= 247.5;
                if (isNoonWindow && isSouthOrSouthWestWind) {
                    windKnots += 10;
                    gustKnots += 10;
                }
            }

            // Detección de tormenta eléctrica
            const isThunderstorm = (wCode === 95 || wCode === 96 || wCode === 99);
            if (isThunderstorm) hasStormRiskToday = true;

            let effectiveWaveHeight = waveHeight;
            let localRule = null;
            let ruleColor = "";

            // Dynamic Buoy Scale Factor (Fase 4)
            const scaleFactor = getBoyaScaleFactor(selectedBeach, waveDir);
            
            // Apply scale factor (Misericordia, Escudo de la Malagueta/Pedregalejo o factor directo de boya)
            if (isMisericordia) {
                const isSouthWestWindStrong = (windDir >= 202.5 && windDir <= 247.5) && windKnots >= 15;
                if (!isSouthWestWindStrong) {
                    effectiveWaveHeight = waveHeight * scaleFactor;
                }
            } else if ((selectedBeach === 'malagueta' || selectedBeach === 'pedregalejo') && waveDir >= 200 && waveDir <= 300) {
                effectiveWaveHeight = waveHeight * scaleFactor;
                localRule = "Escudo Activo";
                ruleColor = "text-indigo-500";
            } else {
                effectiveWaveHeight = waveHeight * scaleFactor;
            }
            
            let driftInfo = { icon: "⏺️", color: "text-slate-400", short: "Nula" };
            const isLevanteMar = waveDir !== undefined && waveDir !== null && waveDir >= 60 && waveDir <= 120;
            const isPedregalejo = selectedBeach === 'pedregalejo';

            if (isPedregalejo && isLevanteMar) {
                driftInfo = { icon: "➡️", color: "text-red-600 font-bold bg-red-50 border-red-200", short: "Embudo: Fuengirola" };
                localRule = "Efecto Embudo: Alta resistencia";
                ruleColor = "text-red-700 font-bold bg-red-100 border border-red-300 shadow-sm";
            } else if (waveDir !== undefined && waveDir !== null && effectiveWaveHeight >= 0.2) {
                let diff = waveDir - beach.facing;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                if (Math.abs(diff) < 85) { 
                    if (diff > 15) {
                        driftInfo = { icon: "⬅️", color: "text-indigo-600", short: "Nerja" };
                    } else if (diff < -15) {
                        driftInfo = { icon: "➡️", color: "text-indigo-600", short: "Fuengirola" };
                    }
                }
            }
            
            if (!localClimateDown && windDir > 45 && windDir < 135) {
                eastWindCount++;
                if (windKnots > maxEastWind) maxEastWind = windKnots;
            }

            // Traductor visual de nubosidad
            let skyIcon = "-";
            if (!localClimateDown) {
              if (cloudCover <= 25) skyIcon = "☀️";
              else if (cloudCover <= 65) skyIcon = "⛅";
              else skyIcon = "☁️";
            }

            const energyCoef = getDynamicWaveEnergyCoefficient(waveDir, period);
            const waveEnergy = Math.round(Math.pow(effectiveWaveHeight, 2) * period * energyCoef);
            
            let ripRisk = "Nulo";
            let ripColor = "text-slate-400 font-medium";
            if (effectiveWaveHeight >= 1.0 || (effectiveWaveHeight >= 0.8 && period > 6)) {
              ripRisk = "Alta";
              ripColor = "text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded";
            } else if (effectiveWaveHeight >= 0.6) {
              ripRisk = "Media";
              ripColor = "text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded";
            } else if (effectiveWaveHeight >= 0.3) {
              ripRisk = "Baja";
              ripColor = "text-blue-600 font-medium";
            }

            let hourScore = 100;
            
            if (effectiveWaveHeight > 0.2) hourScore -= (effectiveWaveHeight * 20);
            if (effectiveWaveHeight > 0.6) hourScore -= (Math.pow(effectiveWaveHeight, 2) * 25); 
            if (period < 4.5 && effectiveWaveHeight > 0.5) hourScore -= 15;
            if (period < 3.5 && effectiveWaveHeight > 0.6) hourScore -= 25;

            // Regla: La Trampa del Levante (v10.x)
            const isLevanteComponent = (waveDir >= 60 && waveDir <= 120) || (!localClimateDown && windDir >= 60 && windDir <= 120);
            if (isLevanteComponent && effectiveWaveHeight < 0.4) {
                hourScore = Math.max(0, hourScore - 10);
                if (!localRule || localRule === "Escudo Activo" || localRule === "Magón") {
                    localRule = "Falsa Calma: Corriente de Fondo";
                    ruleColor = "text-amber-600 bg-amber-50 border border-amber-200 shadow-sm";
                }
            }
            
            if (!localClimateDown) {
                // Viento genérico
                if (windKnots > 8) hourScore -= ((windKnots - 8) * 2);
                
                // Rachas penalizan extra
                if (gustKnots > 15) {
                    hourScore -= ((gustKnots - 15) * 2);
                }
                
                // MAGÓN (Ahora estrictamente limitado a olas de 0.5m o menos)
                if (effectiveWaveHeight >= 0.4 && effectiveWaveHeight <= 0.5 && windKnots < 8 && period > 5.5) {
                    hourScore = 100 - (effectiveWaveHeight * 10); 
                    localRule = "Magón";
                    ruleColor = "text-emerald-600";
                }

                // Lavadora
                const isPoniente = windDir > 202.5 && windDir <= 292.5;
                if (isPoniente && displayHour >= 12 && displayHour <= 18 && windKnots > 12) {
                    hourScore -= 25;
                    localRule = "Lavadora";
                    ruleColor = "text-amber-600";
                }

                // Riesgo Deriva Terral
                const isNorte = windDir > 315 || windDir <= 45;
                if (isNorte && windKnots > 15) {
                    hourScore -= 25;
                    localRule = "Riesgo Deriva";
                    ruleColor = "text-red-600";
                }

                // Regla: Batalla Térmica en Misericordia (v9.5)
                const isWestOrNorthWestWind = windDir >= 247.5 && windDir <= 337.5;
                const isNoonWindow = displayHour >= 12 && displayHour <= 18;
                if (isMisericordia && isNoonWindow && isWestOrNorthWestWind && windKnots < 15) {
                    if (!localRule || localRule === "Escudo Activo" || localRule === "Magón") {
                        localRule = "Batalla Térmica ⚔️";
                        ruleColor = "text-yellow-800 bg-yellow-100 border border-yellow-300 shadow-sm";
                    }
                }

                // Regla: Desacople de Incomodidad vs Altura (Mar Picado / Incómodo) en Misericordia (v9.5)
                if (isMisericordia && windKnots > 10) {
                    if (hourScore > 60) hourScore = 60;
                    if (!localRule || localRule === "Escudo Activo" || localRule === "Magón" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo") {
                        localRule = "Mar Picado / Incómodo";
                        ruleColor = "text-amber-700 bg-amber-50 border border-amber-200 shadow-sm";
                    }
                }
            }

            // EL MURO DE LA ROMPIENTE (Olas > 0.5m son muy incómodas/peligrosas para entrar al agua)
            if (effectiveWaveHeight > 0.5) {
                hourScore -= 15; // Castigo directo por incomodidad en la orilla
                if (hourScore > 50) hourScore = 50; // Muro estricto: nunca pasa de 50
                
                // Etiquetamos si no hay una regla previa importante
                if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo") {
                    localRule = "Rompiente Dura";
                    ruleColor = "text-orange-700 font-bold bg-orange-100 border border-orange-300 shadow-sm";
                }
            }

            // HACHAZO POR RESACA ALTA (Freno de Emergencia vital)
            if (ripRisk === "Alta") {
                hourScore -= 30; // Castigo severo
                if (hourScore > 50) hourScore = 50; // Cap estricto a 50 (Peligro)
                
                // Etiquetamos visualmente la alerta si no hay otra regla más crítica (como Niebla/Tormenta)
                if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo" || localRule === "Rompiente Dura" || localRule === "Efecto Embudo: Alta resistencia") {
                    localRule = "Resaca Fuerte";
                    ruleColor = "text-red-600 font-bold bg-red-50 border border-red-200 shadow-sm";
                }
            }

            // SOBRESCRITURAS POR PELIGRO MÁXIMO (Rayos y Niebla)
            if (isThunderstorm) {
                hourScore = 0;
                localRule = "Tormenta ⚡";
                ruleColor = "text-yellow-700 bg-yellow-300 border-yellow-500 shadow-sm";
            } else if (!localClimateDown && visibility < 2000) {
                hourScore = Math.max(0, hourScore - 40); // Castigo severo por pérdida de visibilidad
                localRule = "Niebla 🌫️";
                ruleColor = "text-slate-600 bg-slate-200 border-slate-300 shadow-sm";
            }

            hourScore = Math.max(0, Math.min(100, Math.round(hourScore)));
            totalScore += hourScore;
            validHoursCount++;

            const formattedTime = `${displayHour.toString().padStart(2, '0')}:00`;

            // CAPTURAR EL "AHORA MISMO"
            if (offset === 0 && displayHour === currentSystemHour) {
               tempCurrentNow = {
                  wave: effectiveWaveHeight.toFixed(2),
                  wind: windKnots,
                  temp: localClimateDown ? "-" : Math.round(weatherJson?.hourly?.temperature_2m?.[i]),
                  dirStr: getWindDirection(windDir)
               };
            }

            if (hourScore > maxScore) { maxScore = hourScore; bestHourTime = formattedTime; }
            if (hourScore < minScore) { minScore = hourScore; worstHourTime = formattedTime; }

            const uvVal = localClimateDown ? "-" : (weatherJson?.hourly?.uv_index?.[i]);

            translatedHourlyData.push({
              time: formattedTime,
              swellH: effectiveWaveHeight.toFixed(2),
              rawSwellH: waveHeight.toFixed(2),
              period: period.toFixed(1),
              windS: localClimateDown ? "-" : windKnots,
              gust: localClimateDown ? "-" : gustKnots,
              windDir: localClimateDown ? "-" : windDir,
              cloudCover: cloudCover,
              skyIcon: skyIcon,
              uv: uvVal === undefined || uvVal === null ? "-" : uvVal,
              rainProb: rainProb,
              rainMm: rainMm,
              hourScore: hourScore,
              waveEnergy: waveEnergy,
              energyCoef: energyCoef,
              swellDir: waveDir === undefined || waveDir === null ? null : waveDir,
              ripRisk: ripRisk,
              ripColor: ripColor,
              drift: driftInfo,
              localRule: localRule,
              ruleColor: ruleColor
            });
          }

          let jRisk = "Bajo";
          let jColor = "text-emerald-600";
          let jBg = "bg-emerald-50 border-emerald-100";

          if (localClimateDown) {
              jRisk = "Dato no disp.";
              jColor = "text-slate-500";
              jBg = "bg-slate-100 border-slate-200";
          } else if (eastWindCount >= 4) {
              if (maxEastWind >= 10) {
                  jRisk = "Alto";
                  jColor = "text-red-600";
                  jBg = "bg-red-50 border-red-100";
              } else {
                  jRisk = "Medio";
                  jColor = "text-amber-600";
                  jBg = "bg-amber-50 border-amber-100";
              }
          }

          const avgScore = validHoursCount > 0 ? Math.round(totalScore / validHoursCount) : 0;
          
          const noonIndex = baseIndex + 12;
          const sstNoon = marineJson?.hourly?.sea_surface_temperature?.[noonIndex];
          const waterTemp =
            sstNoon !== undefined && sstNoon !== null && !Number.isNaN(Number(sstNoon))
              ? Math.round(Number(sstNoon) * 10) / 10
              : 15;

          daysProcessed.push({
            dayIndex: d,
            dayLabel: getDateLabel(offset, dayPrefixes[d]),
            name: beach.name,
            score: avgScore,
            temps: { 
                air: localClimateDown ? "-" : Math.round(weatherJson?.hourly?.temperature_2m?.[noonIndex] || 15), 
                water: waterTemp
            },
            hourly: translatedHourlyData,
            best: { time: bestHourTime, score: maxScore },
            worst: { time: worstHourTime, score: minScore },
            jellyfish: { risk: jRisk, color: jColor, bgColor: jBg },
            waterQuality: { status: wqStatus, color: wqColor, bgColor: wqBg, desc: wqDesc },
            hasStormRisk: hasStormRiskToday
          });
        }

        setBeachData(daysProcessed);
        setCurrentNowData(tempCurrentNow);
        setLastUpdatedAt(new Date());
        setIsLoading(false);

      } catch (err) {
        console.error(err);
        setErrorDetails({ general: err.message });
        setIsLoading(false);
      }
    };

    fetchRealData();
    
  }, [selectedBeach, dataRefreshKey]);

  const handleDayChange = (index) => {
    setSelectedDay(index);
    setHasRequestedAi(false);
    setExpertAdvice("");
  };

  const handleAskExpert = async () => {
    setHasRequestedAi(true);
    setIsAiLoading(true);
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const currentDayData = beachData[selectedDay];
    
    if (!apiKey || apiKey === "") {
        setExpertAdvice("Falta la API Key de Gemini en Vercel.");
        setIsAiLoading(false);
        return;
    }

    try {
      const stormWarning = currentDayData.hasStormRisk ? " ¡HAY RIESGO DE TORMENTA ELÉCTRICA (RAYOS) HOY!" : "";
      const windText = isClimateDown ? "(Ignora el viento porque satélite está caído)" : `Viento: ${currentDayData.hourly[0].windS} nudos. Cielo: ${currentDayData.hourly[0].cloudCover}% nublado. Calidad del agua: ${currentDayData.waterQuality.status}.`;
      const extraMarine = `Medusas (heurístico): ${currentDayData.jellyfish.risk}. Temperatura agua (modelo): ${currentDayData.temps.water}ºC.`;
      
      // Alerta de termoclina para la IA (v10.x)
      let termoclinaAlert = "";
      const isLevante = currentDayData.hourly[0].swellDir >= 60 && currentDayData.hourly[0].swellDir <= 120;
      if ((selectedBeach === 'malagueta' || selectedBeach === 'pedregalejo') && isLevante) {
          termoclinaAlert = " ADVERTENCIA ADICIONAL PARA LA IA: Advierte al nadador de que puede encontrar bloques de agua fría repentinos (termoclinas) y sensación de agua 'pesada' al cruzar la zona del Morlaco debido al relieve del fondo marino.";
      }

      const prompt = `Eres un experto nadador de aguas abiertas y socorrista en Málaga. 
      Analiza los siguientes datos MARINOS de ${currentDayData.dayLabel.toLowerCase()} para la playa ${currentDayData.name}:
      Puntuación media de seguridad: ${currentDayData.score}/100.
      Olas medias: ${currentDayData.hourly[0].swellH}m. ${windText} ${extraMarine}${stormWarning}${termoclinaAlert}
      Mejor hora para nadar: ${currentDayData.best.time}. Peor hora: ${currentDayData.worst.time}.
      IMPORTANTE: Si la puntuación media es menor a 70 o hay rachas que superen los 12 nudos, DEBES empezar tu consejo obligatoriamente con una advertencia seria de peligro en MAYÚSCULAS.
      Escribe un consejo corto y directo (máximo 3 frases) dirigido a un nadador de aguas abiertas. Usa un tono cercano.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const result = await response.json();

      if (!response.ok) {
         throw new Error(result.error?.message || `Error ${response.status} de la API de Google`);
      }

      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        setExpertAdvice(result.candidates[0].content.parts[0].text);
      } else {
        throw new Error("La IA no devolvió el formato esperado.");
      }
    } catch (err) {
      setExpertAdvice(`Error de Google: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getWindDirection = (degrees) => {
    if (degrees === undefined || degrees === null || (typeof degrees === "number" && Number.isNaN(degrees))) return "—";
    if (degrees === "-") return "-";
    const d = Number(degrees);
    if (Number.isNaN(d)) return "—";
    if (d > 337.5 || d <= 22.5) return '⬇️ N';
    if (d > 22.5 && d <= 67.5) return '↙️ NE';
    if (d > 67.5 && d <= 112.5) return '⬅️ E';
    if (d > 112.5 && d <= 157.5) return '↖️ SE';
    if (d > 157.5 && d <= 202.5) return '⬆️ S';
    if (d > 202.5 && d <= 247.5) return '↗️ SO';
    if (d > 247.5 && d <= 292.5) return '➡️ O';
    if (d > 292.5 && d <= 337.5) return '↘️ NO';
    return '-';
  };

  const getWindDirectionFullName = (degrees) => {
    const dirStr = getWindDirection(degrees);
    if (dirStr === "—" || dirStr === "-" || !dirStr) return dirStr;
    const cleanDir = dirStr.replace(/[^A-Z]/g, '').trim();
    const names = {
      'N': 'Norte',
      'NE': 'Nordeste',
      'E': 'Levante',
      'SE': 'Sureste',
      'S': 'Sur',
      'SO': 'Suroeste',
      'O': 'Poniente',
      'NO': 'Noroeste'
    };
    return names[cleanDir] ? `${dirStr} (${names[cleanDir]})` : dirStr;
  };

  const parseSwimmerSensaciones = (text) => {
    if (!text) return { medusas: 'Ninguna', agua: 'Limpia', comentario: '' };
    const match = text.match(/^\[Medusas:\s*([^|]+)\s*\|\s*Agua:\s*([^\]]+)\]\s*(.*)/i);
    if (match) {
      return {
        medusas: match[1].trim(),
        agua: match[2].trim(),
        comentario: match[3].trim()
      };
    }
    return { medusas: 'Ninguna', agua: 'Limpia', comentario: text };
  };

  const fetchCalibrationHistory = async () => {
    setIsCalHistoryLoading(true);
    try {
      const response = await fetch(WEBHOOK_URL);
      const text = await response.text();
      const json = JSON.parse(text);
      if (json.status === 'success' || json.status === 'empty') {
        setCalibrationHistory(json.data || []);
      } else {
        console.error("Error reading sheets history:", json.message);
      }
    } catch (err) {
      console.error("Connection error to sheets webhook:", err);
    } finally {
      setIsCalHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchCalibrationHistory();
  }, [dataRefreshKey]);

  useEffect(() => {
    if (activeTab !== 'comparison') return;
    
    const fetchComparisonData = async () => {
      setIsCompLoading(true);
      const beach = BEACHES[selectedBeach];
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wind_speed_10m,wind_direction_10m&models=gfs_seamless,ecmwf_ifs&timezone=Europe%2FMadrid`;
        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period,wave_direction&models=best_match,ncep_gfswave016&timezone=Europe%2FMadrid`;
        
        const [wRes, mRes] = await Promise.all([
          fetch(weatherUrl).then(r => r.json()),
          fetch(marineUrl).then(r => r.json())
        ]);
        
        const hourlyList = [];
        const times = wRes.hourly.time.slice(0, 24); // Hoy
        for (let i = 0; i < 24; i++) {
          const timeStr = times[i].split('T')[1];
          hourlyList.push({
            time: timeStr,
            windGfs: Math.round((wRes.hourly.wind_speed_10m_gfs_seamless[i] || 0) / 1.852),
            windDirGfs: wRes.hourly.wind_direction_10m_gfs_seamless[i],
            windEcmwf: Math.round((wRes.hourly.wind_speed_10m_ecmwf_ifs[i] || 0) / 1.852),
            windDirEcmwf: wRes.hourly.wind_direction_10m_ecmwf_ifs[i],
            waveEcmwf: mRes.hourly.wave_height_marine_best_match[i],
            periodEcmwf: mRes.hourly.wave_period_marine_best_match[i],
            waveGfs: mRes.hourly.wave_height_ncep_gfswave016[i],
            periodGfs: mRes.hourly.wave_period_ncep_gfswave016[i]
          });
        }
        setComparisonForecast(hourlyList);
      } catch (err) {
        console.error("Error loading comparison data:", err);
      } finally {
        setIsCompLoading(false);
      }
    };
    
    fetchComparisonData();
  }, [activeTab, selectedBeach]);

  const handleVerifyPin = (e) => {
    e.preventDefault();
    if (adminPin === "1234") {
      setIsAdminAuthorized(true);
      setReportStatus(null);
    } else {
      setReportStatus({ type: 'error', text: 'Código PIN de administrador incorrecto.' });
    }
  };

  const handleSendReport = async (e) => {
    e.preventDefault();
    setIsSendingReport(true);
    setReportStatus(null);
    
    const currentHourIndex = new Date().getHours();
    const todayForecast = beachData ? beachData[1] : null;
    const hourForecast = todayForecast ? todayForecast.hourly.find(h => h.time === `${currentHourIndex.toString().padStart(2, '0')}:00`) : null;
    
    // Buscar previsiones de modelos brutos para esa hora en el comparador
    let ecmwfVal = "";
    let gfsVal = "";
    let todoSurfVal = "";
    
    let foundInMemory = false;
    if (comparisonForecast) {
      const searchHour = (adminHoraNado || "").split(':')[0].trim().padStart(2, '0');
      const matchedHour = comparisonForecast.find(h => h.time.startsWith(searchHour));
      if (matchedHour) {
        ecmwfVal = matchedHour.waveEcmwf;
        gfsVal = matchedHour.waveGfs;
        todoSurfVal = matchedHour.waveEcmwf; // Copernicus/ECMWF
        foundInMemory = true;
      }
    }

    if (!foundInMemory) {
      try {
        const beach = BEACHES[adminPlaya];
        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height&models=best_match,ncep_gfswave016&timezone=Europe%2FMadrid`;
        const res = await fetch(marineUrl).then(r => r.json());
        const searchHour = (adminHoraNado || "").split(':')[0].trim().padStart(2, '0');
        const matchedIdx = res.hourly.time.findIndex(t => t.split('T')[1].startsWith(searchHour));
        if (matchedIdx !== -1) {
          ecmwfVal = res.hourly.wave_height_marine_best_match[matchedIdx] || "";
          gfsVal = res.hourly.wave_height_ncep_gfswave016[matchedIdx] || "";
          todoSurfVal = ecmwfVal;
        }
      } catch (err) {
        console.error("Error al rescatar previsiones satélite para Admin:", err);
      }
    }

    const payload = {
      horaNado: adminHoraNado,
      playa: adminPlaya,
      realOlas: adminRealOlas,
      realResaca: adminRealResaca,
      realCorriente: adminRealCorriente,
      realVientoFza: adminRealVientoFza,
      realVientoDir: adminRealVientoDir,
      sensaciones: adminSensaciones,
      origenDato: "Web Admin",
      appScore: hourForecast ? hourForecast.hourScore : "",
      appOlas: hourForecast ? hourForecast.swellH : "",
      appEnergia: hourForecast ? hourForecast.waveEnergy : "",
      appVientoNudos: hourForecast ? hourForecast.windS : "",
      appVientoDir: hourForecast ? hourForecast.windDir : "",
      notasCalibracion: adminNotas,
      boyaAltura: adminBoyaAltura, 
      boyaPeriodo: adminBoyaPeriodo,
      boyaDireccion: adminBoyaDireccion,
      boyaTemp: adminBoyaTemp || (todayForecast ? todayForecast.temps.water : ""),
      modelEcmwfOlas: ecmwfVal,
      modelGfsOlas: gfsVal,
      modelTodoSurfOlas: todoSurfVal
    };

    try {
      // Con mode: 'no-cors' evitamos la validación estricta de CORS en la redirección 302 de Google
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      setReportStatus({ type: 'success', text: '¡Calibración enviada con éxito a Google Sheets!' });
      setAdminSensaciones('');
      setAdminNotas('');
      setAdminBoyaAltura('');
      setAdminBoyaPeriodo('');
      setAdminBoyaDireccion('');
      setAdminBoyaTemp('');
      
      // Esperar 2.5 segundos para dar tiempo a que Google Sheets inserte la fila antes de refrescar el historial
      setTimeout(() => {
        fetchCalibrationHistory();
        setIsAdminModalOpen(false);
        setReportStatus(null);
      }, 2500);
    } catch (err) {
      setReportStatus({ type: 'error', text: `Error de conexión: ${err.message}` });
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleSendSwimmerReport = async (e) => {
    e.preventDefault();
    setIsSendingSwimmerReport(true);
    setSwimmerReportStatus(null);
    
    const swimHour = parseInt((swimmerHoraNado || "").split(':')[0]) || 12;
    const todayForecast = beachData ? beachData[1] : null;
    const hourForecast = todayForecast ? todayForecast.hourly.find(h => h.time === `${swimHour.toString().padStart(2, '0')}:00`) : null;
    
    // Buscar previsiones de modelos brutos para esa hora en el comparador
    let ecmwfVal = "";
    let gfsVal = "";
    let todoSurfVal = "";
    
    let foundInMemory = false;
    if (comparisonForecast) {
      const searchHour = (swimmerHoraNado || "").split(':')[0].trim().padStart(2, '0');
      const matchedHour = comparisonForecast.find(h => h.time.startsWith(searchHour));
      if (matchedHour) {
        ecmwfVal = matchedHour.waveEcmwf;
        gfsVal = matchedHour.waveGfs;
        todoSurfVal = matchedHour.waveEcmwf; // Copernicus/ECMWF
        foundInMemory = true;
      }
    }

    if (!foundInMemory) {
      try {
        const beach = BEACHES[swimmerPlaya];
        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height&models=best_match,ncep_gfswave016&timezone=Europe%2FMadrid`;
        const res = await fetch(marineUrl).then(r => r.json());
        const searchHour = (swimmerHoraNado || "").split(':')[0].trim().padStart(2, '0');
        const matchedIdx = res.hourly.time.findIndex(t => t.split('T')[1].startsWith(searchHour));
        if (matchedIdx !== -1) {
          ecmwfVal = res.hourly.wave_height_marine_best_match[matchedIdx] || "";
          gfsVal = res.hourly.wave_height_ncep_gfswave016[matchedIdx] || "";
          todoSurfVal = ecmwfVal;
        }
      } catch (err) {
        console.error("Error al rescatar previsiones satélite para Nadador:", err);
      }
    }

    const payload = {
      horaNado: swimmerHoraNado,
      playa: swimmerPlaya,
      realOlas: swimmerRealOlas,
      realResaca: swimmerRealResaca,
      realCorriente: swimmerRealCorriente,
      realVientoFza: "",
      realVientoDir: "",
      sensaciones: `[Medusas: ${swimmerMedusas} | Agua: ${swimmerAgua}] ${swimmerSensaciones}`,
      origenDato: "Nadador",
      appScore: hourForecast ? hourForecast.hourScore : "",
      appOlas: hourForecast ? hourForecast.swellH : "",
      appEnergia: hourForecast ? hourForecast.waveEnergy : "",
      appVientoNudos: hourForecast ? hourForecast.windS : "",
      appVientoDir: hourForecast ? hourForecast.windDir : "",
      notasCalibracion: "Reporte público de nadador",
      boyaAltura: "", 
      boyaPeriodo: "",
      boyaDireccion: "",
      boyaTemp: todayForecast ? todayForecast.temps.water : "",
      modelEcmwfOlas: ecmwfVal,
      modelGfsOlas: gfsVal,
      modelTodoSurfOlas: todoSurfVal
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      setSwimmerReportStatus({ type: 'success', text: '¡Tu reporte ha sido enviado con éxito! Muchas gracias.' });
      setSwimmerSensaciones('');
      
      setTimeout(() => {
        fetchCalibrationHistory();
        setIsSwimmerModalOpen(false);
        setSwimmerReportStatus(null);
      }, 2500);
    } catch (err) {
      setSwimmerReportStatus({ type: 'error', text: `Error de conexión: ${err.message}` });
    } finally {
      setIsSendingSwimmerReport(false);
    }
  };

  const currentDayData = beachData ? beachData[selectedDay] : null;

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col">
      
      {/* BANNER BETA */}
      <div className="bg-slate-900 text-amber-400 text-xs text-center py-2 px-4 font-medium flex items-center justify-center gap-2">
        <AlertTriangle size={14} />
        <span>🚧 <strong>App en Fase Beta:</strong> Datos experimentales. Por favor, danos feedback tras tus nados usando el formulario de abajo.</span>
      </div>

      <div className="p-4 md:p-8 flex-grow w-full max-w-6xl mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md">
              <Waves size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">OpenWater Tracker</h1>
              <p className="text-slate-500 text-sm font-medium">Pronóstico en tiempo real para nadadores</p>
              {lastUpdatedAt && (
                <p className="text-[11px] text-slate-400 mt-1 font-medium" title="Última lectura correcta de satélites">
                  Actualizado: {lastUpdatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 md:gap-3 w-full md:w-auto">
            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-3 md:px-4 rounded-xl transition-colors border border-indigo-100 flex items-center justify-center gap-2"
              title="Guía Local del Mar"
            >
              <BookOpen size={18} />
              <span className="hidden sm:inline">Guía Local</span>
            </button>

            <button
              type="button"
              onClick={() => setDataRefreshKey((k) => k + 1)}
              disabled={isLoading}
              className="shrink-0 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-3 rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 disabled:opacity-50"
              title="Volver a pedir datos a los satélites"
              aria-label="Actualizar datos del satélite"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl w-full md:w-auto border border-slate-200 flex-1 md:flex-none overflow-hidden">
              <MapPin className="text-slate-400 ml-1 md:ml-2 shrink-0" size={20} />
              <select 
                value={selectedBeach} 
                onChange={(e) => setSelectedBeach(e.target.value)}
                className="bg-transparent font-bold text-slate-700 py-1.5 pr-4 pl-1 md:pl-2 outline-none w-full md:min-w-[14rem] md:max-w-[22rem] cursor-pointer text-ellipsis overflow-hidden"
              >
                <option value="misericordia">La Misericordia</option>
                <option value="malagueta">La Malagueta</option>
                <option value="pedregalejo">Pedregalejo</option>
                <option value="los_alamos">Los Álamos (Torremolinos)</option>
                <option value="bajondillo">El Bajondillo (Torremolinos)</option>
                <option value="rincon_victoria">Rincón de la Victoria</option>
                <option value="cala_del_moral">La Cala del Moral</option>
              </select>
            </div>
          </div>
        </header>

        {/* BARRA DE ESTADO ACTUAL (AHORA MISMO) */}
        {!isLoading && currentNowData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8 text-sm animate-in fade-in zoom-in duration-300">
            <span className="font-bold text-slate-500 uppercase tracking-wide text-xs">🔴 En este instante:</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Waves size={16} className="text-blue-500"/> Olas {currentNowData.wave}m
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Wind size={16} className="text-slate-400"/> Viento {currentNowData.wind} kts <span className="text-xs text-slate-400 font-medium">({currentNowData.dirStr})</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Thermometer size={16} className="text-orange-500"/> Aire {currentNowData.temp}ºC
            </div>
          </div>
        )}

        {/* ALERTA DE TORMENTA GENERAL */}
        {!isLoading && !errorDetails && currentDayData?.hasStormRisk && (
          <div className="bg-yellow-400 border border-yellow-500 p-4 rounded-2xl shadow-md flex items-start gap-3 animate-pulse">
            <Zap className="text-yellow-900 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-black text-yellow-900 uppercase">Peligro: Tormenta Eléctrica</h3>
              <p className="text-sm text-yellow-800 font-medium mt-1">
                El satélite detecta riesgo de caída de rayos en la costa durante el día de hoy. El agua es un conductor eléctrico letal. Se prohíbe terminantemente el baño en horas de tormenta.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !errorDetails && isClimateDown && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-amber-800">Modo de Emergencia Activo</h3>
              <p className="text-sm text-amber-700 mt-1">
                El satélite global de clima está temporalmente fuera de servicio. Estamos mostrando <strong>solo las previsiones de oleaje y corrientes</strong>. Los datos de viento, temperatura y alertas volverán solos cuando el servidor se restaure.
              </p>
            </div>
          </div>
        )}

        {errorDetails && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-red-200 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600 border-b border-red-100 pb-4">
              <AlertTriangle size={28} className="shrink-0" />
              <div>
                <h2 className="font-bold text-lg">Error Crítico de Conexión</h2>
                <p className="text-sm text-red-500 font-medium">Ni siquiera el satélite de olas está respondiendo en este momento.</p>
              </div>
            </div>
            {errorDetails.general && (
              <p className="text-xs text-slate-500 font-mono mt-2 text-center border-t pt-4">
                Detalles: {errorDetails.general}
              </p>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-xl transition-colors"
            >
              Reintentar Conexión
            </button>
          </div>
        )}

        {isLoading && !errorDetails ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl shadow-sm border border-slate-200">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500 font-medium animate-pulse text-lg">Conectando con satélites...</p>
          </div>
        ) : currentDayData && !errorDetails && (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {beachData.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTab('forecast');
                    handleDayChange(idx);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    activeTab === 'forecast' && selectedDay === idx 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : idx === 0 
                        ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-300' 
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {idx === 0 ? <History size={16} /> : <CalendarDays size={16} />}
                  {day.dayLabel}
                </button>
              ))}

              <button
                onClick={() => setActiveTab('comparison')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                  activeTab === 'comparison'
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Anchor size={16} />
                Boya vs Previsiones
              </button>
            </div>

            {activeTab === 'forecast' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-4 space-y-6">
                
                {/* Tarjeta 1: Score de Seguridad */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center relative">
                  <div className="absolute top-3 left-3 text-[8px] text-slate-300 font-semibold uppercase tracking-widest opacity-70">
                    Algoritmo Propio
                  </div>
                  <h2 className="text-slate-500 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                    <Activity size={18} className="text-blue-500"/> Seguridad Media {isClimateDown && "(Solo Olas)"}
                  </h2>
                  <div className="relative">
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-slate-100" />
                      <circle 
                        cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" 
                        strokeDasharray="439.8" 
                        strokeDashoffset={439.8 - (439.8 * currentDayData.score) / 100}
                        className={currentDayData.score > 70 ? 'text-emerald-500' : currentDayData.score > 40 ? 'text-amber-500' : 'text-red-500'} 
                      />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <span className="text-5xl font-black text-slate-800">{currentDayData.score}</span>
                      <span className="text-xs font-bold text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <p className={`mt-5 font-black text-lg ${currentDayData.score > 70 ? 'text-emerald-600' : currentDayData.score > 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {currentDayData.score > 70 ? 'Nado Seguro' : currentDayData.score > 40 ? 'Precaución: Mar Agitado' : 'No Recomendado Nadar'}
                  </p>
                </div>

                {/* Tarjeta 2: Temperaturas */}
                <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center ${isClimateDown ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Thermometer size={24}/></div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm text-slate-500 font-medium">Agua</p>
                      </div>
                      <p className="text-xl font-bold text-slate-800">{currentDayData.temps.water}ºC</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Modelo marino (mediodía)</p>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-slate-200"></div>
                  <div className="flex items-center gap-3">
                    <div className={isClimateDown ? "bg-slate-50 p-2 rounded-lg text-slate-400" : "bg-orange-50 p-2 rounded-lg text-orange-500"}><Sun size={24}/></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Aire <span className="text-xs">({currentDayData.dayLabel.split(' ')[0]})</span></p>
                      <p className={`text-xl font-bold ${isClimateDown ? 'text-slate-400' : 'text-slate-800'}`}>
                        {currentDayData.temps.air === "-" ? "- ºC" : `${currentDayData.temps.air}ºC`}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Predicción Modelo</p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 3: Mejor y Peor Hora */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                      <Clock size={16} className="text-indigo-500"/> Horas Clave
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Cálculo Propio</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="text-emerald-500" size={20} />
                      <span className="font-bold text-emerald-800">Mejor Hora</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-700">{currentDayData.best.time}</p>
                      <p className="text-xs font-bold text-emerald-600/70">Score: {currentDayData.best.score}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="text-red-500" size={20} />
                      <span className="font-bold text-red-800">Peor Hora</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-700">{currentDayData.worst.time}</p>
                      <p className="text-xs font-bold text-red-600/70">Score: {currentDayData.worst.score}</p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 4: Enlaces Oficiales (Boya y Mareas) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                      <Anchor size={16} className="text-blue-500"/> Estado Real
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Lectura Física</span>
                  </div>
                  
                  <div className="space-y-3">
                    <a 
                      href="https://portus.puertos.es/#/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="font-bold text-slate-700 text-sm group-hover:text-blue-700">Boya de Málaga</span>
                      </div>
                      <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-500" />
                    </a>

                    <a 
                      href="https://tablademareas.com/es/malaga/malaga" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <Droplets size={16} className="text-blue-400" />
                        <span className="font-bold text-slate-700 text-sm group-hover:text-blue-700">Tabla de Mareas</span>
                      </div>
                      <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-500" />
                    </a>
                  </div>
                </div>

                {/* Tarjeta 5: Calidad del Agua y Medusas (Grid dual) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                  {/* Calidad del Agua */}
                  <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isClimateDown ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                        <TestTubes size={16} className={isClimateDown ? 'text-slate-400' : 'text-emerald-500'}/> Calidad del Agua
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium">Satélite + Deriva</span>
                    </div>
                    
                    <div className={`flex flex-col p-3 rounded-xl border ${currentDayData.waterQuality.bgColor}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-black uppercase text-sm ${currentDayData.waterQuality.color}`}>
                          {currentDayData.waterQuality.status}
                        </span>
                        {currentDayData.waterQuality.status === "Riesgo Alto" && <AlertTriangle size={16} className="text-red-500" />}
                      </div>
                      <span className="text-xs font-medium text-slate-600 leading-tight">
                        {currentDayData.waterQuality.desc}
                      </span>
                    </div>
                  </div>

                  {/* Medusas */}
                  <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isClimateDown ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                        <AlertCircle size={16} className={isClimateDown ? 'text-slate-400' : 'text-purple-500'}/> Medusas
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium">Algoritmo</span>
                    </div>
                    
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${currentDayData.jellyfish.bgColor}`}>
                      <span className={`font-black uppercase text-sm ${currentDayData.jellyfish.color}`}>
                        {currentDayData.jellyfish.risk.includes("Dato") ? currentDayData.jellyfish.risk : `Nivel ${currentDayData.jellyfish.risk}`}
                      </span>
                      <a href="https://oceanaria.es/" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-700 underline underline-offset-2 text-right">
                        Oceanaria
                      </a>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 6: Socorrista Virtual */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Bot size={80} />
                  </div>
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                      <Bot className="text-blue-600" size={20} />
                      Socorrista Virtual
                    </h3>
                    <span className="text-[10px] text-blue-400/80 font-medium bg-blue-100/50 px-2 py-1 rounded-md">IA Generativa</span>
                  </div>
                  
                  <div className="relative z-10">
                    {!hasRequestedAi ? (
                      <button 
                        onClick={handleAskExpert}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <Bot size={18} /> Consultar previsión 
                      </button>
                    ) : isAiLoading ? (
                      <div className="flex items-center gap-2 text-blue-600/70 p-2">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm font-bold">El experto está evaluando la playa...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-blue-900 text-sm leading-relaxed font-medium bg-white/60 p-4 rounded-xl border border-blue-100/50 shadow-sm">
                          "{expertAdvice}"
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (expertAdvice) navigator.clipboard?.writeText(expertAdvice).catch(() => {});
                          }}
                          className="w-full sm:w-auto text-xs font-bold text-blue-700 bg-white/80 hover:bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Copy size={14} /> Copiar consejo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* PANEL DERECHO: Tabla de previsiones */}
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-fit">
                
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-800 text-lg">
                      {selectedDay === 0 ? "Registro de ayer" : "Evolución del mar"}
                    </h3>
                    <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium border border-slate-200 bg-white px-2 py-0.5 rounded-full">
                      Predicción Matemática
                    </span>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm ${selectedDay === 0 ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <CalendarDays size={14}/> {currentDayData.dayLabel.split(' ')[0]}
                  </span>
                </div>

                {/* BANNER TRAMPA PARA "AYER" */}
                {selectedDay === 0 && (
                  <div className="bg-indigo-50 border-b border-indigo-100 p-4 animate-in fade-in slide-in-from-top-4 duration-500">
                     <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                         <div className="flex items-center gap-3">
                           <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                             <Activity className="text-indigo-600" size={20} />
                           </div>
                           <div className="text-left">
                             <p className="font-bold text-indigo-900 text-sm">💡 ¿Estuviste en el agua ayer?</p>
                             <p className="text-xs text-indigo-700 font-medium mt-0.5">Comprueba esta tabla y ayúdanos a calibrar el algoritmo.</p>
                           </div>
                         </div>
                         <a
                           href="https://docs.google.com/forms/d/e/1FAIpQLSdTjdiGOAEtBYo6wjNRtMK1KpdAijJajxhp-_uUBpMhG0Y8YQ/viewform?usp=sharing&ouid=114554177440629903097"
                           target="_blank"
                           rel="noreferrer"
                           className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-xs w-full sm:w-auto"
                         >
                           📝 Rellenar Diario
                         </a>
                     </div>
                     <p className="text-[11px] font-bold text-indigo-500 mt-3 text-center sm:text-left w-full">
                       O si lo prefieres, cuéntanoslo directamente por el grupo de WhatsApp del club.
                     </p>
                  </div>
                )}
                
                <div className="hidden lg:block overflow-x-auto max-h-[800px] overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[840px] relative">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="px-3 py-4 font-bold">Hora</th>
                        <th className="px-2 py-4 font-bold text-center">Score</th>
                        <th className="px-2.5 py-4 font-bold">Oleaje</th>
                        <th className="px-2 py-4 font-bold text-center">
                          <span className="block">Energía</span>
                          <span className="block text-[9px] font-semibold text-slate-400 normal-case tracking-normal mt-0.5">Oleaje (procedencia)</span>
                        </th>
                        <th className="px-2.5 py-4 font-bold">Corrientes</th>
                        <th className={`px-2 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Cielo</th>
                        <th className={`px-2 py-4 font-bold ${isClimateDown ? 'text-slate-300' : ''}`}>Viento</th>
                        <th className={`px-2 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>UV</th>
                        <th className={`px-2 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Lluvia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {currentDayData.hourly.map((hour, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50/50 transition-colors group ${selectedDay === 0 ? 'opacity-80' : ''}`}>
                          
                          <td className="px-3 py-4">
                            <span className="font-bold text-slate-800 text-base">{hour.time}</span>
                          </td>

                          <td className="px-2 py-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs
                                ${hour.hourScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                                  hour.hourScore > 40 ? 'bg-amber-100 text-amber-700' : 
                                  hour.localRule === "Tormenta ⚡" ? 'bg-yellow-100 text-yellow-700 border border-yellow-400' :
                                  hour.localRule === "Niebla 🌫️" ? 'bg-slate-200 text-slate-600 border border-slate-300' :
                                  'bg-red-100 text-red-700'}`}>
                                {hour.hourScore}
                              </span>
                              {hour.localRule && (
                                <span className={`text-[8px] font-black uppercase tracking-normal bg-white shadow-sm px-1.5 py-0.5 rounded border border-slate-100 leading-tight max-w-[90px] text-center ${hour.ruleColor}`}>
                                  {hour.localRule}
                                </span>
                              )}
                            </div>
                          </td>
                          
                          <td className="px-2.5 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className={`font-black text-base ${hour.swellH > 0.8 ? 'text-red-500' : 'text-blue-600'}`}>
                                  {hour.swellH}m
                                </span>
                                {hour.localRule === "Escudo Activo" && (
                                  <ShieldAlert size={14} className="text-indigo-400" title={`Atenuado. Ola original satélite: ${hour.rawSwellH}m`} />
                                )}
                              </div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                P: {hour.period}s
                              </span>
                            </div>
                          </td>

                          <td className="px-2 py-4 text-center">
                            <div
                              className="flex flex-col items-center justify-center gap-0.5"
                              title={`Energía ≈ altura² × T × coef. (${hour.energyCoef}). Dirección: procedencia del oleaje (modelo Open-Meteo, desde el norte).`}
                            >
                              <span className={`font-black text-base ${hour.waveEnergy > 50 ? 'text-orange-500' : 'text-slate-700'}`}>
                                {hour.waveEnergy}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Kj</span>
                              <span className="text-[9px] font-semibold text-slate-400">×{hour.energyCoef}</span>
                              <span className="text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                                {hour.swellDir != null && !Number.isNaN(Number(hour.swellDir)) ? (
                                  <>
                                    <span className="block">{getWindDirection(Number(hour.swellDir))}</span>
                                    <span className="block text-[9px] font-semibold text-slate-400">{Math.round(Number(hour.swellDir))}°</span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 font-semibold">—</span>
                                )}
                              </span>
                            </div>
                          </td>

                          <td className="px-2.5 py-4">
                            <div className="flex flex-col gap-1.5 justify-center items-start">
                              <span className={`text-xs whitespace-nowrap ${hour.ripColor}`} title="Riesgo de resaca (Arrastre hacia adentro)">
                                Resaca: {hour.ripRisk}
                              </span>
                              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 whitespace-nowrap ${hour.drift.color}`} title="Deriva lateral (Empuje paralelo a la orilla)">
                                <span>{hour.drift.icon}</span> <span>{hour.drift.short}</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-2 py-4 text-center">
                            {isClimateDown ? (
                                <span className="font-bold text-slate-300">-</span>
                            ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-xl" title={`Nubosidad: ${hour.cloudCover}%`}>{hour.skyIcon}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{hour.cloudCover}%</span>
                                </div>
                            )}
                          </td>

                          <td className="px-2 py-4">
                            {isClimateDown ? (
                                <span className="font-bold text-slate-300 text-base">-</span>
                            ) : (
                                <div className="flex flex-col">
                                  <span className={`font-black text-sm whitespace-nowrap ${hour.windS > 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                                    {hour.windS} kts {getWindDirectionFullName(hour.windDir)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    Rachas: {hour.gust}
                                  </span>
                                </div>
                            )}
                          </td>

                          <td className="px-2 py-4 text-center">
                            {isClimateDown ? (
                              <span className="font-bold text-slate-300">-</span>
                            ) : (
                              <span
                                className={`font-bold text-sm ${typeof hour.uv === 'number' && hour.uv >= 6 ? 'text-amber-600' : 'text-slate-600'}`}
                                title="Índice UV horario (protección solar en superficie)"
                              >
                                {hour.uv === '-' || hour.uv === undefined || hour.uv === null ? '-' : Number(hour.uv).toFixed(1)}
                              </span>
                            )}
                          </td>

                          <td className="px-2 py-4 text-center">
                             {isClimateDown ? (
                                <span className="font-bold text-slate-300">-</span>
                             ) : (
                                <div className="flex flex-col items-center justify-center">
                                  {hour.rainProb > 10 && <Droplets size={14} className="text-blue-400 mb-0.5" />}
                                  <span className={`font-bold text-sm ${hour.rainProb > 10 ? 'text-blue-600' : 'text-slate-500'}`}>
                                    {hour.rainProb}%
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    {hour.rainMm > 0 ? `(${hour.rainMm}mm)` : '(0mm)'}
                                  </span>
                                </div>
                             )}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>

                  {/* Cabecera del acordeón móvil */}
                  <div className="block lg:hidden flex px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50 rounded-t-2xl mb-1.5">
                    <span className="w-[45px]">Hora</span>
                    <span className="flex-grow pl-4">Score</span>
                    <span className="w-[60px] text-right">Oleaje</span>
                    <span className="w-[75px] text-right pr-6">Viento</span>
                  </div>

                  {/* Vista en acordeón móvil (oculta en pantallas grandes) */}
                  <div className="block lg:hidden space-y-3 max-h-[800px] overflow-y-auto pr-1">
                    {currentDayData.hourly.map((hour, idx) => {
                      const isExpanded = expandedHourIdx === idx;
                      return (
                        <div 
                          key={idx} 
                          className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                            isExpanded ? 'border-indigo-400 ring-1 ring-indigo-400/30' : 'border-slate-200 hover:border-slate-300'
                          } ${selectedDay === 0 ? 'opacity-80' : ''}`}
                        >
                          {/* Cabecera del Acordeón (Siempre visible) */}
                          <button
                            type="button"
                            onClick={() => setExpandedHourIdx(isExpanded ? null : idx)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Hora */}
                              <span className="font-bold text-slate-800 text-base min-w-[45px]">{hour.time}</span>
                              
                              {/* Score y alerta local */}
                              <div className="flex flex-col items-start gap-0.5">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-bold text-[10px]
                                  ${hour.hourScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                                    hour.hourScore > 40 ? 'bg-amber-100 text-amber-700' : 
                                    hour.localRule === "Tormenta ⚡" ? 'bg-yellow-100 text-yellow-700' :
                                    hour.localRule === "Niebla 🌫️" ? 'bg-slate-200 text-slate-600' :
                                    'bg-red-100 text-red-700'}`}>
                                  Score: {hour.hourScore}
                                </span>
                                {hour.localRule && (
                                  <span className={`text-[8px] font-black uppercase tracking-wide px-1 rounded ${hour.ruleColor}`}>
                                    {hour.localRule}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Olas */}
                              <div className="text-right">
                                <span className={`font-black text-sm block ${hour.swellH > 0.8 ? 'text-red-500' : 'text-blue-600'}`}>
                                  {hour.swellH}m
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wide">
                                  P: {hour.period}s
                                </span>
                              </div>

                              {/* Viento */}
                              {!isClimateDown && (
                                <div className="text-right min-w-[50px]">
                                  <span className={`font-black text-xs block ${hour.windS > 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                                    {hour.windS} kts
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400 block">
                                    {getWindDirection(hour.windDir)}
                                  </span>
                                </div>
                              )}

                              {/* Icono de estado */}
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </button>

                          {/* Detalles desplegables */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 text-xs text-slate-600 space-y-3 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 gap-3">
                                {/* Tarjeta de Olas & Energía */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Energía y Oleaje</span>
                                  <div className="mt-1 font-semibold text-slate-700">
                                    <span className="font-black text-slate-800 text-sm block">{hour.waveEnergy} Kj</span>
                                    <span className="text-[9px] text-slate-400 block">Coeficiente: ×{hour.energyCoef}</span>
                                    {hour.swellDir != null && !Number.isNaN(Number(hour.swellDir)) && (
                                      <span className="text-[9px] text-slate-500 block mt-0.5">
                                        Dirección: {getWindDirection(Number(hour.swellDir))} ({Math.round(Number(hour.swellDir))}°)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tarjeta de Resaca y Corriente */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Corrientes y Resaca</span>
                                  <div className="mt-1 space-y-1">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${hour.ripColor}`}>
                                      Resaca: {hour.ripRisk}
                                    </span>
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${hour.drift.color}`}>
                                      <span>{hour.drift.icon}</span> <span>{hour.drift.short}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Tarjeta de Viento y Rachas */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Viento</span>
                                  <div className="mt-1 font-semibold text-slate-700">
                                    {isClimateDown ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <>
                                        <span className="font-black text-slate-800 text-sm block">{hour.windS} kts</span>
                                        <span className="text-[9px] text-slate-400 block">Rachas: {hour.gust} kts</span>
                                        <span className="text-[9px] text-slate-500 block">Procedencia: {getWindDirection(hour.windDir)} ({hour.windDir}°)</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Tarjeta de Cielo y Clima */}
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Cielo y Lluvia</span>
                                  <div className="mt-1 font-semibold text-slate-700 flex items-center gap-2">
                                    {isClimateDown ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <>
                                        <span className="text-2xl" title={`Nubosidad: ${hour.cloudCover}%`}>{hour.skyIcon}</span>
                                        <div>
                                          <span className="text-[10px] block">Nubes: {hour.cloudCover}%</span>
                                          <span className="text-[10px] text-blue-600 block">
                                            Lluvia: {hour.rainProb}% {hour.rainMm > 0 ? `(${hour.rainMm}mm)` : ''}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Tarjeta inferior para UV y Visibilidad */}
                              {!isClimateDown && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Índice UV</span>
                                    <span className={`font-black text-sm ${hour.uv >= 6 ? 'text-amber-600' : 'text-slate-700'}`}>
                                      {hour.uv === '-' || hour.uv === undefined || hour.uv === null ? '-' : Number(hour.uv).toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Visibilidad</span>
                                    <span className="font-bold text-slate-700 text-xs">
                                      {hour.visibility ? `${(hour.visibility / 1000).toFixed(1)} km` : 'Excelente'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
              </div>

              </div>
            ) : (
              <div className="space-y-6 text-left w-full">
                
                {/* Selector de Nado Histórico y Ficha de Análisis */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                        <Search size={16} className="text-indigo-600" />
                        Análisis Retrospectivo (A Toro Pasado)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Selecciona una sesión real para auditar qué falló o acertó en los modelos satelitales.</p>
                    </div>
                    <select
                      value={selectedHistoryLog ? calibrationHistory.indexOf(selectedHistoryLog) : ''}
                      onChange={(e) => {
                        const idx = e.target.value;
                        setSelectedHistoryLog(idx !== '' ? calibrationHistory[idx] : null);
                      }}
                      className="border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 bg-white shadow-sm focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- Seleccionar Sesión Guardada --</option>
                      {calibrationHistory.map((item, idx) => (
                        <option key={idx} value={idx}>
                          {new Date(item.fechaRegistro).toLocaleDateString('es-ES')} ({item.horaNado}) - {BEACHES[item.playa]?.name.split(',')[0]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHistoryLog ? (() => {
                    const parsedDetails = parseSwimmerSensaciones(selectedHistoryLog.sensaciones);
                    const isSwimmer = selectedHistoryLog.origenDato === 'Nadador';
                    
                    const appOlas = parseFloat((selectedHistoryLog.appOlas || "0").toString().replace(",", "."));
                    const swimmerScaleToMeters = (v) => {
                      const val = parseFloat((v || "0").toString().replace(",", "."));
                      if (val === 1) return 0.05;
                      if (val === 2) return 0.20;
                      if (val === 3) return 0.45;
                      if (val === 4) return 0.80;
                      if (val === 5) return 1.20;
                      return 0.3;
                    };
                    const swimmerRealM = swimmerScaleToMeters(selectedHistoryLog.realOlas);
                    
                    let diffPercent = 0;
                    if (swimmerRealM > 0) {
                      diffPercent = Math.round((Math.abs(appOlas - swimmerRealM) / swimmerRealM) * 100);
                    }
                    
                    let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    let badgeText = `Calibración Óptima (Desvío ${diffPercent}%)`;
                    let suggestion = "El factor de escala dinámica de la boya se está adaptando correctamente a la orilla.";
                    
                    if (diffPercent > 35) {
                      badgeColor = "bg-red-50 text-red-700 border-red-200";
                      badgeText = `Desviación Alta (Desvío ${diffPercent}%)`;
                      suggestion = appOlas > swimmerRealM 
                        ? "Nuestra App estimó olas demasiado altas. Considera reducir manualmente el factor de escala." 
                        : "Nuestra App estimó olas demasiado bajas. Considera elevar el factor de escala.";
                    } else if (diffPercent > 15) {
                      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                      badgeText = `Ajuste Ligero (Desvío ${diffPercent}%)`;
                      suggestion = "La estimación local es aceptable, dentro del umbral de precisión ordinario.";
                    }

                    return (
                      <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-2xl p-5 mt-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/60 pb-4 mb-4 gap-4">
                          <div>
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                              🏖️ {BEACHES[selectedHistoryLog.playa]?.name} ({selectedHistoryLog.horaNado})
                            </h4>
                            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Sesión registrada el {new Date(selectedHistoryLog.fechaRegistro).toLocaleString('es-ES')}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${badgeColor}`}>
                              {badgeText}
                            </span>
                            <p className="text-[10px] text-slate-500 font-medium italic max-w-sm text-right mt-1">
                              💡 {suggestion}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Windy (ECMWF)</span>
                            <span className="text-sm font-black text-indigo-600 mt-1">
                              {selectedHistoryLog.modelEcmwfOlas ? `${parseFloat(selectedHistoryLog.modelEcmwfOlas.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-1">Modelo Satélite Bruto</span>
                          </div>
                          
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Windy (GFS)</span>
                            <span className="text-sm font-black text-sky-600 mt-1">
                              {selectedHistoryLog.modelGfsOlas ? `${parseFloat(selectedHistoryLog.modelGfsOlas.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-1">Modelo Satélite Bruto</span>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">TodoSurf</span>
                            <span className="text-sm font-black text-emerald-600 mt-1">
                              {selectedHistoryLog.modelTodoSurfOlas ? `${parseFloat(selectedHistoryLog.modelTodoSurfOlas.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-1">Copernicus/NOAA</span>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/10 text-center flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-indigo-600 uppercase">Nuestra App (Orilla)</span>
                            <span className="text-sm font-black text-blue-600 mt-1">
                              {selectedHistoryLog.appOlas ? `${parseFloat(selectedHistoryLog.appOlas.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                            </span>
                            <span className="text-[9px] font-black text-slate-600 mt-1">Score: {selectedHistoryLog.appScore}/100</span>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center col-span-2 md:col-span-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Boya Real</span>
                            <span className="text-sm font-black text-slate-800 mt-1">
                              {selectedHistoryLog.boyaAltura ? `${parseFloat(selectedHistoryLog.boyaAltura.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                            </span>
                            <span className="text-[9px] text-slate-500 font-semibold mt-1">
                              {selectedHistoryLog.boyaDireccion ? `${getWindDirection(selectedHistoryLog.boyaDireccion)}` : ''}
                              {selectedHistoryLog.boyaPeriodo ? ` (${selectedHistoryLog.boyaPeriodo}s)` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/60 rounded-xl p-4 mt-3.5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm">
                          <div className="flex-grow text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sensaciones del Nadador</span>
                            <p className="text-xs text-slate-700 italic font-medium mt-1">
                              "{isSwimmer ? parsedDetails.comentario : (selectedHistoryLog.sensaciones || 'Sin comentarios registrados.')}"
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0 text-center text-xs w-full md:w-auto justify-between md:justify-end">
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 min-w-[70px] flex flex-col justify-between">
                              <span className="block text-[8px] font-bold text-slate-400 uppercase">Ola</span>
                              <span className="font-black text-blue-600">{selectedHistoryLog.realOlas}/5</span>
                              <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                                {Number(selectedHistoryLog.realOlas) === 1 && "0.05m"}
                                {Number(selectedHistoryLog.realOlas) === 2 && "0.20m"}
                                {Number(selectedHistoryLog.realOlas) === 3 && "0.45m"}
                                {Number(selectedHistoryLog.realOlas) === 4 && "0.80m"}
                                {Number(selectedHistoryLog.realOlas) === 5 && "1.20m"}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 min-w-[70px] flex flex-col justify-between">
                              <span className="block text-[8px] font-bold text-slate-400 uppercase">Resaca</span>
                              <span className="font-black text-red-500">{selectedHistoryLog.realResaca}/5</span>
                              <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                                {Number(selectedHistoryLog.realResaca) === 1 && "Ninguna"}
                                {Number(selectedHistoryLog.realResaca) === 2 && "Leve"}
                                {Number(selectedHistoryLog.realResaca) === 3 && "Moderada"}
                                {Number(selectedHistoryLog.realResaca) === 4 && "Fuerte"}
                                {Number(selectedHistoryLog.realResaca) === 5 && "Extrema"}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 min-w-[70px] flex flex-col justify-between">
                              <span className="block text-[8px] font-bold text-slate-400 uppercase">Deriva</span>
                              <span className="font-black text-indigo-600">{selectedHistoryLog.realCorriente}/5</span>
                              <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                                {Number(selectedHistoryLog.realCorriente) === 1 && "Ninguna"}
                                {Number(selectedHistoryLog.realCorriente) === 2 && "Leve"}
                                {Number(selectedHistoryLog.realCorriente) === 3 && "Moderada"}
                                {Number(selectedHistoryLog.realCorriente) === 4 && "Fuerte"}
                                {Number(selectedHistoryLog.realCorriente) === 5 && "Extrema"}
                              </span>
                            </div>

                            {isSwimmer && (
                              <>
                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 min-w-[70px] flex flex-col justify-between">
                                  <span className="block text-[8px] font-bold text-slate-400 uppercase font-semibold">Medusas</span>
                                  <span className="font-black text-rose-500 font-semibold">
                                    {parsedDetails.medusas}
                                  </span>
                                  <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">Reportado</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 min-w-[70px] flex flex-col justify-between">
                                  <span className="block text-[8px] font-bold text-slate-400 uppercase font-semibold">Agua</span>
                                  <span className="font-black text-emerald-600 font-semibold">
                                    {parsedDetails.agua}
                                  </span>
                                  <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">Reportado</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <p className="text-xs text-slate-400 font-medium text-center py-6">Selecciona uno de los nados históricos arriba para ver la comparativa de desvíos.</p>
                  )}
                </div>

                {/* Dos columnas del Comparador de Hoy */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
                  {/* Columna Izquierda: Historial de Calibraciones de Google Sheets */}
                  <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-fit gap-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <History size={16} className="text-indigo-600" />
                        Historial Real (Sheets)
                      </h3>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Google Sheets
                      </span>
                    </div>
                    
                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                      {isCalHistoryLoading ? (
                        <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                          <Loader2 className="animate-spin" size={16} />
                          <span className="text-xs font-semibold">Cargando base de datos...</span>
                        </div>
                      ) : calibrationHistory.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-10">No hay registros de nado en la base de datos.</p>
                      ) : (
                        calibrationHistory.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-xl border border-slate-200/60 shadow-sm transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                                🏖️ {BEACHES[item.playa]?.name.split(',')[0] || item.playa}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                {item.horaNado}
                              </span>
                            </div>
                            
                            {item.origenDato === 'Nadador' ? (
                              <div className="grid grid-cols-3 gap-2 border-y border-slate-200/60 py-2 my-2 text-center text-xs">
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase font-semibold">Ola</span>
                                  <span className="font-black text-blue-600">{item.realOlas}/5</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase font-semibold">Medusas</span>
                                  <span className="font-black text-red-600">
                                    {item.realResaca === '1' || item.realResaca === 1 ? 'No' : item.realResaca === '3' || item.realResaca === 3 ? 'Pocas' : 'Muchas'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase font-semibold">Agua</span>
                                  <span className="font-black text-indigo-600">
                                    {item.realCorriente === '1' || item.realCorriente === 1 ? 'Limpia' : item.realCorriente === '3' || item.realCorriente === 3 ? 'Turbia' : 'Sucia'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2 border-y border-slate-200/60 py-2 my-2 text-center text-xs">
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Ola</span>
                                  <span className="font-black text-blue-600">{item.realOlas}/5</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Viento</span>
                                  <span className="font-black text-slate-600">{item.realVientoFza}</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Deriva</span>
                                  <span className="font-black text-indigo-600">{item.realCorriente}/5</span>
                                </div>
                              </div>
                            )}
                            
                            {item.sensaciones && (
                              <p className="text-xs text-slate-600 italic leading-tight mb-2">
                                "{item.sensaciones}"
                              </p>
                            )}
                            
                            {item.boyaAltura && (
                              <div className="mt-2 pt-2 border-t border-slate-200/40 text-[9px] font-semibold text-slate-400 flex justify-between">
                                <span>⚓ Boya Real: {item.boyaAltura}m</span>
                                <span>🌡️ Agua: {item.boyaTemp}ºC</span>
                              </div>
                            )}
                            
                            <div className="mt-1.5 flex justify-between items-center text-[9px] text-slate-400 font-medium">
                              <span>Origen: <strong className="text-indigo-500 font-semibold">{item.origenDato}</strong></span>
                              <span>{new Date(item.fechaRegistro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha: Comparador de Modelos (GFS vs ECMWF vs Boya) */}
                  <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-fit">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-800 text-lg">Comparador de Previsiones</h3>
                        <span className="text-[10px] text-indigo-600 font-semibold border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded-full">
                          GFS vs ECMWF
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                        <Anchor size={14} className="text-blue-500" /> Hoy ({new Date().getDate()} {new Date().toLocaleString('es-ES', { month: 'short' })})
                      </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 bg-slate-50/30">
                            <th className="px-5 py-4 font-bold border-r border-slate-100">Hora</th>
                            <th className="px-4 py-4 font-bold text-center border-r border-slate-100 bg-indigo-50/30" colSpan="2">Windy (ECMWF)</th>
                            <th className="px-4 py-4 font-bold text-center border-r border-slate-100 bg-sky-50/30" colSpan="2">Windy (GFS)</th>
                            <th className="px-4 py-4 font-bold text-center bg-emerald-50/30" colSpan="2">TodoSurf (NOAA/Cope)</th>
                          </tr>
                          <tr className="text-slate-400 text-[10px] uppercase border-b border-slate-100 bg-slate-50/10">
                            <th className="px-5 py-2 border-r border-slate-100"></th>
                            <th className="px-4 py-2 text-center bg-indigo-50/10">Ola</th>
                            <th className="px-4 py-2 text-center border-r border-slate-100 bg-indigo-50/10">Viento</th>
                            <th className="px-4 py-2 text-center bg-sky-50/10">Ola</th>
                            <th className="px-4 py-2 text-center border-r border-slate-100 bg-sky-50/10">Viento</th>
                            <th className="px-4 py-2 text-center bg-emerald-50/10">Ola (m)</th>
                            <th className="px-4 py-2 text-center bg-emerald-50/10">Periodo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {isCompLoading ? (
                            <tr>
                              <td colSpan="7" className="py-20 text-center">
                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                  <Loader2 className="animate-spin" size={24} />
                                  <span className="font-bold">Calculando desvíos de satélites...</span>
                                </div>
                              </td>
                            </tr>
                          ) : comparisonForecast ? (
                            comparisonForecast.map((hour, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/55 transition-colors">
                                <td className="px-5 py-3 font-bold text-slate-700 border-r border-slate-100">{hour.time}</td>
                                
                                {/* ECMWF */}
                                <td className="px-4 py-3 text-center font-black text-blue-600 bg-indigo-50/5">{hour.waveEcmwf.toFixed(2)}m</td>
                                <td className="px-4 py-3 text-center border-r border-slate-100 bg-indigo-50/5 font-semibold text-slate-700">
                                  {hour.windEcmwf} kts <span className="text-[10px] text-slate-400">({getWindDirection(hour.windDirEcmwf)})</span>
                                </td>
                                
                                {/* GFS */}
                                <td className="px-4 py-3 text-center font-black text-blue-600 bg-sky-50/5">{hour.waveGfs.toFixed(2)}m</td>
                                <td className="px-4 py-3 text-center border-r border-slate-100 bg-sky-50/5 font-semibold text-slate-700">
                                  {hour.windGfs} kts <span className="text-[10px] text-slate-400">({getWindDirection(hour.windDirGfs)})</span>
                                </td>
                                
                                {/* TodoSurf (Representado por Copernicus/NOAA) */}
                                <td className="px-4 py-3 text-center font-black text-emerald-600 bg-emerald-50/5">{hour.waveEcmwf.toFixed(2)}m</td>
                                <td className="px-4 py-3 text-center bg-emerald-50/5 font-semibold text-slate-700">{hour.periodEcmwf}s</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="py-10 text-center text-slate-400">Error al cargar el comparador.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* COMUNIDAD OPENWATER: FEED DE REPORTES Y ACCIÓN DE COLABORACIÓN */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Waves className="text-blue-600 animate-pulse" size={22} />
                Comunidad OpenWater: ¿Cómo está el mar hoy?
              </h2>
              <p className="text-slate-500 text-xs font-semibold mt-1">
                Reportes en tiempo real y sensaciones de los propios nadadores en la orilla.
              </p>
            </div>
            <button
              onClick={() => {
                setSwimmerPlaya(selectedBeach);
                const currentHour = new Date().getHours();
                setSwimmerHoraNado(`${currentHour.toString().padStart(2, '0')}:00`);
                setSwimmerRealOlas(3);
                setSwimmerRealResaca(1);
                setSwimmerRealCorriente(1);
                setSwimmerSensaciones('');
                setSwimmerReportStatus(null);
                setIsSwimmerModalOpen(true);
              }}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl transition-all shadow-md hover:shadow-lg text-xs flex items-center justify-center gap-2 shrink-0"
            >
              <Bot size={16} />
              ¿Has nadado hoy? Reportar estado
            </button>
          </div>

          {/* Feed de reportes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isCalHistoryLoading ? (
              <div className="col-span-full flex items-center justify-center py-10 gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-xs font-bold">Cargando reportes de la comunidad...</span>
              </div>
            ) : calibrationHistory.filter(item => item.playa === selectedBeach).length === 0 ? (
              <div className="col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold">No hay reportes de nadadores hoy para esta playa.</p>
                <p className="text-[11px] text-slate-400 mt-1">Sé el primero en informar a la comunidad sobre el estado del agua.</p>
              </div>
            ) : (
              calibrationHistory
                .filter(item => item.playa === selectedBeach)
                .slice(0, 3) // Mostrar los últimos 3 de esta playa
                .map((item, idx) => {
                  const parsed = parseSwimmerSensaciones(item.sensaciones);
                  const isSwimmer = item.origenDato === 'Nadador';
                  return (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <span className="text-sm">👤</span>
                            <span>
                              {item.origenDato === 'Web Admin' ? 'Admin' : 'Nadador Anónimo'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            {item.horaNado}
                          </span>
                        </div>

                        {/* Ratings rápidos en píldoras */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700 rounded-md">
                            🌊 Olas: {item.realOlas}/5
                          </span>
                          <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-[10px] font-bold text-red-700 rounded-md">
                            🔄 Resaca: {item.realResaca}/5
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 rounded-md">
                            🧭 Deriva: {item.realCorriente}/5
                          </span>
                          {isSwimmer && (
                            <>
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-[10px] font-bold text-rose-700 rounded-md">
                                🪼 Medusas: {parsed.medusas}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 rounded-md">
                                🧼 Agua: {parsed.agua}
                              </span>
                            </>
                          )}
                        </div>

                        {(isSwimmer ? parsed.comentario : item.sensaciones) && (
                          <p className="text-xs text-slate-600 font-medium leading-relaxed italic border-l-2 border-blue-200 pl-2">
                            "{isSwimmer ? parsed.comentario : item.sensaciones}"
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200/40 flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                        <span>Origen: <strong className="text-indigo-500 font-semibold">{item.origenDato}</strong></span>
                        <span>
                          {(() => {
                            try {
                              const regDate = new Date(item.fechaRegistro);
                              const today = new Date();
                              const yesterday = new Date();
                              yesterday.setDate(today.getDate() - 1);
                              if (regDate.toDateString() === today.toDateString()) {
                                return `Hoy, ${regDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
                              } else if (regDate.toDateString() === yesterday.toDateString()) {
                                return `Ayer`;
                              } else {
                                return regDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                              }
                            } catch (e) {
                              return 'Hace poco';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
        
        {/* FOOTER LEGAL */}
        <footer className="mt-8 border-t border-slate-200 pt-6 pb-2 text-center w-full space-y-4">
          <div className="flex justify-center">
            <button
              onClick={() => {
                setIsAdminAuthorized(false);
                setAdminPin('');
                setIsAdminModalOpen(true);
                setReportStatus(null);
              }}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              <ShieldAlert size={12} />
              Acceso Administrador (PIN)
            </button>
          </div>
          <div className="bg-slate-200/50 rounded-xl p-4 inline-block max-w-4xl text-left">
            <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="shrink-0 text-slate-400 mt-0.5" size={14} />
              <span>
                <strong className="text-slate-700">Aviso Legal y Descargo de Responsabilidad:</strong> OpenWater Tracker proporciona estimaciones matemáticas basadas en modelos meteorológicos satelitales globales y algoritmos heurísticos locales. Los datos mostrados son puramente informativos y <strong>no garantizan la seguridad real</strong> en el agua. Las condiciones oceánicas pueden cambiar repentinamente. El uso de esta aplicación para planificar actividades acuáticas se realiza bajo la exclusiva responsabilidad del usuario. Ante cualquier duda, bandera roja o mala apariencia del mar en la orilla, no entre al agua.
              </span>
            </p>
          </div>
        </footer>

      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guia-nadadores-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 id="guia-nadadores-titulo" className="text-lg font-bold text-slate-800 tracking-tight">Guía Fácil para Nadadores</h3>
                  <p className="text-xs text-slate-500 font-medium">Cómo leer OpenWater Tracker</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                aria-label="Cerrar guía"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8">
              
              <section>
                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                  Hemos cogido los datos en bruto de los satélites y les hemos metido <strong>"nuestra experiencia local"</strong> para crear el primer predictor de aguas abiertas pensado exclusivamente para la costa de Málaga.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 border-b pb-2">🛠️ 1. Alertas de Salud y Riesgo</h4>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-3 items-start">
                     <Zap className="text-yellow-600 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Corte por Tormenta (Rayos):</strong>
                       <p className="text-sm text-slate-600 mt-1">Si el satélite detecta riesgo eléctrico, la nota caerá a 0 puntos y aparecerá en amarillo. En el agua eres el punto más alto, un pararrayos natural. Sal inmediatamente.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <CloudFog className="text-slate-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Pérdida de Visibilidad (Niebla):</strong>
                       <p className="text-sm text-slate-600 mt-1">Si la visibilidad cae por debajo de 2 kilómetros, aplicamos un castigo de 40 puntos. Perder de vista la costa nadando es extremadamente peligroso.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <TestTubes className="text-emerald-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Calidad del Agua (Arrastres):</strong>
                       <p className="text-sm text-slate-600 mt-1">La app suma la lluvia desde ayer hasta hoy. Si llueve fuerte, los aliviaderos de Málaga y el río Guadalhorce escupirán suciedad que la deriva traerá a la costa. La tarjeta pasará a estado de "Precaución" (0.5mm) o "Riesgo Alto" (2mm).</p>
                     </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Compass size={20} className="text-indigo-500"/> 2. Las Corrientes (El Radar)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  En la tabla, cruzamos los datos de las olas para vigilar los dos tipos de arrastres:
                </p>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-3 items-start">
                     <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Resaca (Hacia adentro):</strong>
                       <p className="text-sm text-slate-600 mt-1">Si entra mucha agua a la playa, tiene que salir, creando embudos que tiran hacia alta mar. Se marca como Baja, Media o Alta.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <Compass className="text-indigo-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Deriva Lateral (Flechitas):</strong>
                       <p className="text-sm text-slate-600 mt-1">Cruzando la inclinación de la playa con el ángulo de la ola, sabemos si el agua "resbala" empujándote hacia el este (⬅️ etiqueta <strong>Nerja</strong>) o hacia el oeste (➡️ etiqueta <strong>Fuengirola</strong>) a lo largo de la costa.</p>
                     </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Activity size={20} className="text-orange-500"/> 3. La Energía (La Regla de Oro)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  La columna <strong>Energía (Kj)</strong> usa <code className="bg-slate-100 px-1 rounded text-xs">altura² × periodo × coeficiente dinámico</code>. El coeficiente depende de la <strong>dirección del oleaje</strong> (Sur/SSE más noble, Sureste intermedio, Suroeste más agresivo) y del <strong>periodo</strong> (más de 5 s suma empuje; menos de 4 s resta, mar más caótico). Debajo del valor verás la <strong>procedencia del oleaje</strong> (brújula + grados, convención del modelo).
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  Basado en los informes de oceanografía física, la fuerza de una ola no crece en línea recta, sino de forma <strong>exponencial</strong> (al cuadrado en la altura).
                </p>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-sm text-orange-800 font-medium flex items-start gap-3">
                  <Info className="shrink-0 text-orange-600 mt-0.5" size={20} />
                  <p>
                    Una ola de 0.8m no tiene el doble de fuerza que una de 0.4m... <strong>¡Tiene 4 veces más energía!</strong> Por eso, a partir de 0.6m notarás que el mar golpea con mucha dureza. Fíjate en la columna de <strong>Energía (Kj)</strong> para conocer el impacto real de las olas en tu pecho.
                  </p>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Bot size={20} className="text-indigo-500"/> 4. El "Cerebro" Malagueño
                </h4>
                <p className="text-sm text-slate-600 mb-5">
                  La aplicación no se fía a ciegas del satélite, sino que aplica nuestras <strong>4 Reglas de Oro</strong> automáticamente:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600"><Waves size={24} /></div>
                      <h5 className="font-bold text-slate-800">El "Magón"</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Ola tendida sin viento. Aunque sea grande (0.5m), la app no castiga la seguridad en exceso porque es mar de fondo cómodo.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600"><ThermometerSun size={24} /></div>
                      <h5 className="font-bold text-slate-800">La "Lavadora" Térmica</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">A mediodía, el Poniente superior a 12 nudos levanta un mar picado insoportable para respirar.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><Wind size={24} /></div>
                      <h5 className="font-bold text-slate-800">La trampa del Terral</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Viento fuerte de Tierra (Norte) alisa la orilla pero empuja hacia adentro. Riesgo muy alto de deriva.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600"><ShieldAlert size={24} /></div>
                      <h5 className="font-bold text-slate-800">El Escudo del Puerto</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">La Malagueta y Pedregalejo están fuertemente protegidas contra las olas de Poniente o Suroeste. El satélite llega aquí muy atenuado.</p>
                  </div>
                </div>
              </section>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-800 font-medium flex items-start gap-3">
                <Info className="shrink-0 text-amber-600 mt-0.5" size={20} />
                <p>
                  <strong>El sentido común manda:</strong> Estas previsiones son matemáticas y cálculos. Si la app dice verde pero al llegar ves bandera roja o tienes un mal presentimiento, <strong>no te metas</strong>. Tu instinto es el mejor satélite.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
      {isAdminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          role="presentation"
          onClick={() => setIsAdminModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-indigo-600" size={20} />
                <h3 className="text-base font-bold text-slate-800">Panel de Calibración Rápida</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {!isAdminAuthorized ? (
                /* FORMULARIO DE PIN */
                <form onSubmit={handleVerifyPin} className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium">Introduce el código PIN de administración para registrar tu sesión de nado.</p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">PIN Administrador</label>
                    <input 
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="****"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center font-bold tracking-widest text-lg outline-none focus:border-indigo-500"
                    />
                  </div>
                  {reportStatus && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold text-center border border-red-100">
                      {reportStatus.text}
                    </div>
                  )}
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-sm"
                  >
                    Verificar Acceso
                  </button>
                </form>
              ) : (
                /* FORMULARIO DE REPORTE */
                <form onSubmit={handleSendReport} className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Playa</label>
                      <select 
                        value={adminPlaya}
                        onChange={(e) => setAdminPlaya(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white"
                      >
                        <option value="misericordia">La Misericordia</option>
                        <option value="malagueta">La Malagueta</option>
                        <option value="pedregalejo">Pedregalejo</option>
                        <option value="los_alamos">Los Álamos</option>
                        <option value="bajondillo">El Bajondillo</option>
                        <option value="rincon_victoria">Rincón de la Victoria</option>
                        <option value="cala_del_moral">La Cala del Moral</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Hora Nado</label>
                      <input 
                        type="text" 
                        value={adminHoraNado}
                        onChange={(e) => setAdminHoraNado(e.target.value)}
                        placeholder="11:00"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Observación Real (1 al 5)</span>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Olas:</span>
                        <div className="flex gap-1.5">
                          {[1,2,3,4,5].map(v => (
                            <button 
                              type="button" key={v}
                              onClick={() => setAdminRealOlas(v)}
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${adminRealOlas === v ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      {adminRealOlas && (
                        <div className="text-[10px] text-right font-bold text-blue-600 italic">
                          {adminRealOlas === 1 && "1/5 = 0.05m (Mar plano / Sin olas)"}
                          {adminRealOlas === 2 && "2/5 = 0.20m (Olas muy pequeñas)"}
                          {adminRealOlas === 3 && "3/5 = 0.45m (Olas medianas)"}
                          {adminRealOlas === 4 && "4/5 = 0.80m (Olas grandes)"}
                          {adminRealOlas === 5 && "5/5 = 1.20m (Olas muy grandes / Resaca)"}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Resaca:</span>
                        <div className="flex gap-1.5">
                          {[1,2,3,4,5].map(v => (
                            <button 
                              type="button" key={v}
                              onClick={() => setAdminRealResaca(v)}
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${adminRealResaca === v ? 'bg-red-500 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      {adminRealResaca && (
                        <div className="text-[10px] text-right font-bold text-red-500 italic">
                          {adminRealResaca === 1 && "1/5 = Sin resaca"}
                          {adminRealResaca === 2 && "2/5 = Resaca leve"}
                          {adminRealResaca === 3 && "3/5 = Resaca moderada"}
                          {adminRealResaca === 4 && "4/5 = Resaca fuerte"}
                          {adminRealResaca === 5 && "5/5 = Resaca extrema"}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Corriente (Deriva):</span>
                        <div className="flex gap-1.5">
                          {[1,2,3,4,5].map(v => (
                            <button 
                              type="button" key={v}
                              onClick={() => setAdminRealCorriente(v)}
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${adminRealCorriente === v ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      {adminRealCorriente && (
                        <div className="text-[10px] text-right font-bold text-indigo-600 italic">
                          {adminRealCorriente === 1 && "1/5 = Sin deriva / corriente"}
                          {adminRealCorriente === 2 && "2/5 = Deriva leve"}
                          {adminRealCorriente === 3 && "3/5 = Deriva moderada"}
                          {adminRealCorriente === 4 && "4/5 = Deriva fuerte"}
                          {adminRealCorriente === 5 && "5/5 = Deriva extrema"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/60 space-y-2 text-left">
                    <span className="block text-[10px] font-black text-blue-700 uppercase tracking-wider mb-1">⚓ Datos de la Boya Real (Málaga) - Opcional</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Altura Boya (m)</label>
                        <input 
                          type="text" 
                          value={adminBoyaAltura}
                          onChange={(e) => setAdminBoyaAltura(e.target.value)}
                          placeholder="Ej: 0.45"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Periodo Boya (s)</label>
                        <input 
                          type="text" 
                          value={adminBoyaPeriodo}
                          onChange={(e) => setAdminBoyaPeriodo(e.target.value)}
                          placeholder="Ej: 4.2"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Dirección Boya (º)</label>
                        <input 
                          type="text" 
                          value={adminBoyaDireccion}
                          onChange={(e) => setAdminBoyaDireccion(e.target.value)}
                          placeholder="Ej: 110"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Temp Agua (ºC)</label>
                        <input 
                          type="text" 
                          value={adminBoyaTemp}
                          onChange={(e) => setAdminBoyaTemp(e.target.value)}
                          placeholder="Ej: 21.5"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Viento Fza (Fuerza)</label>
                      <input 
                        type="text" 
                        value={adminRealVientoFza}
                        onChange={(e) => setAdminRealVientoFza(e.target.value)}
                        placeholder="Suave / Fuerte / Medio"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Viento Dir (Dirección)</label>
                      <input 
                        type="text" 
                        value={adminRealVientoDir}
                        onChange={(e) => setAdminRealVientoDir(e.target.value)}
                        placeholder="S/SO, Levante, Poniente..."
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Comentario del nadador / WhatsApp</label>
                    <textarea 
                      value={adminSensaciones}
                      onChange={(e) => setAdminSensaciones(e.target.value)}
                      placeholder="Ej. 'Agua muy limpia pero refrescando bastante, deriva fuerte hacia Fuengirola...'"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 h-16 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Notas Internas Calibración</label>
                    <input 
                      type="text" 
                      value={adminNotas}
                      onChange={(e) => setAdminNotas(e.target.value)}
                      placeholder="Ej. 'Windy falló por 3 nudos, TodoSurf clavado.'"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700"
                    />
                  </div>

                  {reportStatus && (
                    <div className={`p-3 rounded-xl text-xs font-bold text-center border ${reportStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {reportStatus.text}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isSendingReport}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingReport && <Loader2 size={14} className="animate-spin" />}
                    Guardar en Google Sheets 🚀
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {isSwimmerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          role="presentation"
          onClick={() => setIsSwimmerModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-slate-800">Reportar Estado de la Playa</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsSwimmerModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSendSwimmerReport} className="space-y-4 text-left">
                <p className="text-xs text-slate-500 font-medium">Ayuda a otros nadadores compartiendo las condiciones actuales del agua en esta playa.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Playa</label>
                    <select 
                      value={swimmerPlaya}
                      onChange={(e) => setSwimmerPlaya(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white"
                    >
                      <option value="misericordia">La Misericordia</option>
                      <option value="malagueta">La Malagueta</option>
                      <option value="pedregalejo">Pedregalejo</option>
                      <option value="los_alamos">Los Álamos</option>
                      <option value="bajondillo">El Bajondillo</option>
                      <option value="rincon_victoria">Rincón de la Victoria</option>
                      <option value="cala_del_moral">La Cala del Moral</option>
                    </select>
                  </div>
                   <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Hora de Nado</label>
                    <select 
                      value={swimmerHoraNado}
                      onChange={(e) => setSwimmerHoraNado(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white"
                    >
                      {Array.from({ length: 16 }, (_, i) => i + 6).map(h => {
                        const timeStr = `${h.toString().padStart(2, '0')}:00`;
                        return <option key={h} value={timeStr}>{timeStr}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs">
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Evaluación de la playa</span>
                  
                  {/* Olas */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">🌊 Ola en la Orilla:</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(v => (
                          <button 
                            type="button" key={v}
                            onClick={() => setSwimmerRealOlas(v)}
                            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${swimmerRealOlas === v ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {swimmerRealOlas && (
                      <div className="text-[9px] text-right font-bold text-blue-600 italic">
                        {swimmerRealOlas === 1 && "1/5 = Mar plato"}
                        {swimmerRealOlas === 2 && "2/5 = Olas muy pequeñas"}
                        {swimmerRealOlas === 3 && "3/5 = Olas medianas / picado"}
                        {swimmerRealOlas === 4 && "4/5 = Rompiente fuerte"}
                        {swimmerRealOlas === 5 && "5/5 = Muy fuerte / Resaca"}
                      </div>
                    )}
                  </div>

                  {/* Resaca */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">🔄 Resaca (Arrastre):</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(v => (
                          <button 
                            type="button" key={v}
                            onClick={() => setSwimmerRealResaca(v)}
                            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${swimmerRealResaca === v ? 'bg-red-500 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {swimmerRealResaca && (
                      <div className="text-[9px] text-right font-bold text-red-500 italic">
                        {swimmerRealResaca === 1 && "1/5 = Sin arrastre"}
                        {swimmerRealResaca === 2 && "2/5 = Arrastre leve"}
                        {swimmerRealResaca === 3 && "3/5 = Arrastre moderado"}
                        {swimmerRealResaca === 4 && "4/5 = Arrastre fuerte"}
                        {swimmerRealResaca === 5 && "5/5 = Arrastre extremo"}
                      </div>
                    )}
                  </div>

                  {/* Corriente */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">🧭 Deriva (Corriente):</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(v => (
                          <button 
                            type="button" key={v}
                            onClick={() => setSwimmerRealCorriente(v)}
                            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${swimmerRealCorriente === v ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {swimmerRealCorriente && (
                      <div className="text-[9px] text-right font-bold text-indigo-600 italic">
                        {swimmerRealCorriente === 1 && "1/5 = Sin corriente"}
                        {swimmerRealCorriente === 2 && "2/5 = Corriente leve"}
                        {swimmerRealCorriente === 3 && "3/5 = Corriente moderada"}
                        {swimmerRealCorriente === 4 && "4/5 = Corriente fuerte"}
                        {swimmerRealCorriente === 5 && "5/5 = Corriente extrema"}
                      </div>
                    )}
                  </div>

                  {/* Medusas */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/50">
                    <span className="font-bold text-slate-700 flex items-center gap-1">🪼 Medusas:</span>
                    <div className="flex gap-1">
                      {['Ninguna', 'Pocas', 'Muchas'].map(v => (
                        <button 
                          type="button" key={v}
                          onClick={() => setSwimmerMedusas(v)}
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center justify-center transition-colors ${swimmerMedusas === v ? 'bg-rose-500 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          {v === 'Muchas' ? 'Muchas 🚩' : v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Limpieza */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/50">
                    <span className="font-bold text-slate-700 flex items-center gap-1">🧼 Agua:</span>
                    <div className="flex gap-1">
                      {['Limpia', 'Turbia', 'Sucia'].map(v => (
                        <button 
                          type="button" key={v}
                          onClick={() => setSwimmerAgua(v)}
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center justify-center transition-colors ${swimmerAgua === v ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          {v === 'Sucia' ? 'Sucia ⚠️' : v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Comentario o sensaciones (Opcional)</label>
                  <textarea 
                    value={swimmerSensaciones}
                    onChange={(e) => setSwimmerSensaciones(e.target.value)}
                    placeholder="Ej. 'El agua estaba plato pero fría, no hay medusas hoy...'"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 h-16 outline-none focus:border-blue-500"
                    maxLength={150}
                  />
                </div>

                {swimmerReportStatus && (
                  <div className={`p-3 rounded-xl text-xs font-bold text-center border ${swimmerReportStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {swimmerReportStatus.text}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSendingSwimmerReport}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingSwimmerReport && <Loader2 size={14} className="animate-spin" />}
                  Enviar Reporte Anónimo 🚀
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
}

