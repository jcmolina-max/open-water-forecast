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
  History
} from 'lucide-react';

// Coordenadas reales de las playas y su orientación (grados respecto al Norte mirando al mar)
const BEACHES = {
  misericordia: { name: "La Misericordia, Málaga", lat: 36.696, lon: -4.444, facing: 135 },
  malagueta: { name: "La Malagueta, Málaga", lat: 36.718, lon: -4.407, facing: 180 },
  pedregalejo: { name: "Pedregalejo, Málaga", lat: 36.721, lon: -4.386, facing: 180 }
};

// Generador de etiquetas de fecha (Ahora soporta días pasados, ej: offset -1)
const getDateLabel = (offset, prefix) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const day = d.getDate();
  const monthStr = d.toLocaleString('es-ES', { month: 'short' });
  return `${prefix} (${day} ${monthStr})`;
};

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  // Por defecto seleccionamos el índice 1 (que corresponde a "Hoy", ya que el 0 es "Ayer")
  const [selectedDay, setSelectedDay] = useState(1); 
  const [beachData, setBeachData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [errorDetails, setErrorDetails] = useState(null);
  const [isClimateDown, setIsClimateDown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para el Socorrista IA
  const [expertAdvice, setExpertAdvice] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasRequestedAi, setHasRequestedAi] = useState(false);

  useEffect(() => {
    const fetchRealData = async () => {
      setIsLoading(true);
      setErrorDetails(null);
      setIsClimateDown(false);
      setHasRequestedAi(false);
      setExpertAdvice("");
      setSelectedDay(1); // Reseteamos siempre a "Hoy" al cambiar de playa
      
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

      // 1. SATÉLITE CLIMA (Con past_days=1 para el retrovisor)
      try {
        weatherJson = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,uv_index&timezone=Europe%2FMadrid&past_days=1`);
      } catch (e) {
        console.warn("Satélite de clima caído. Activando auto-rescate.", e);
        localClimateDown = true;
        setIsClimateDown(true);
      }

      // 2. SATÉLITE MARINO (Con past_days=1 para el retrovisor)
      try {
        marineJson = await fetchWithTimeout(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period,wave_direction&timezone=Europe%2FMadrid&past_days=1`);
      } catch (e) {
         setErrorDetails({ general: `El satélite marino no responde: ${e.message}` });
         setIsLoading(false);
         return; 
      }

      // 3. PROCESAMOS LOS DATOS (Ayer, Hoy, Mañana, Pasado)
      try {
        const daysProcessed = []; 
        const dayOffsets = [-1, 0, 1, 2];
        const dayPrefixes = ["Ayer", "Hoy", "Mañana", "Pasado"];

        for (let d = 0; d < dayOffsets.length; d++) {
          const offset = dayOffsets[d];
          
          // Al pedir past_days=1, el día de ayer empieza en el índice 0 de la matriz.
          const baseIndex = (offset + 1) * 24; 
          
          // Mostramos desde las 06:00 hasta las 21:00 (16 horas de datos útiles para nadar)
          const startIndex = baseIndex + 6;
          const endIndex = baseIndex + 21;

          let translatedHourlyData = [];
          let totalScore = 0;
          let maxScore = -1;
          let minScore = 101;
          let bestHourTime = "";
          let worstHourTime = "";
          
          let eastWindCount = 0;
          let maxEastWind = 0;
          let validHoursCount = 0;

          for (let i = startIndex; i <= endIndex; i++) {
            if (!marineJson?.hourly?.wave_height || i >= marineJson.hourly.wave_height.length) break;

            const waveHeightStr = marineJson.hourly.wave_height[i];
            const waveHeight = waveHeightStr !== null ? waveHeightStr : 0.1;
            const period = marineJson.hourly?.wave_period?.[i] || 4;
            const waveDir = marineJson.hourly?.wave_direction?.[i];
            
            const windKmh = localClimateDown ? 0 : (weatherJson?.hourly?.wind_speed_10m?.[i] || 0);
            const windKnots = Math.round(windKmh / 1.852);
            const gustKnots = localClimateDown ? 0 : Math.round((weatherJson?.hourly?.wind_gusts_10m?.[i] || 0) / 1.852);
            const windDir = localClimateDown ? 0 : (weatherJson?.hourly?.wind_direction_10m?.[i] || 0);
            const displayHour = i % 24;
            
            let effectiveWaveHeight = waveHeight;
            let localRule = null;
            let ruleColor = "";

            if (selectedBeach === 'malagueta' || selectedBeach === 'pedregalejo') {
                effectiveWaveHeight = waveHeight * 0.7; 
                localRule = "Escudo Activo";
                ruleColor = "text-indigo-500";
            }
            
            let driftInfo = { icon: "⏺️", color: "text-slate-400", short: "Nula" };
            if (waveDir !== undefined && waveDir !== null && effectiveWaveHeight >= 0.2) {
                let diff = waveDir - beach.facing;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                if (Math.abs(diff) < 85) { 
                    if (diff > 15) {
                        driftInfo = { icon: "⬅️", color: "text-indigo-600", short: "Rincón" };
                    } else if (diff < -15) {
                        driftInfo = { icon: "➡️", color: "text-indigo-600", short: "Torrem." };
                    }
                }
            }
            
            if (!localClimateDown && windDir > 45 && windDir < 135) {
                eastWindCount++;
                if (windKnots > maxEastWind) maxEastWind = windKnots;
            }

            const waveEnergy = Math.round(Math.pow(effectiveWaveHeight, 2) * period * 6.25);
            
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
            
            if (!localClimateDown) {
                if (windKnots > 8) hourScore -= ((windKnots - 8) * 2);
                
                if (effectiveWaveHeight >= 0.4 && effectiveWaveHeight <= 0.7 && windKnots < 8 && period > 5.5) {
                    hourScore = 100 - (effectiveWaveHeight * 10); 
                    localRule = "Magón";
                    ruleColor = "text-emerald-600";
                }
                const isPoniente = windDir > 202.5 && windDir <= 292.5;
                if (isPoniente && displayHour >= 12 && displayHour <= 18 && windKnots > 12) {
                    hourScore -= 25;
                    localRule = "Lavadora";
                    ruleColor = "text-amber-600";
                }
                const isNorte = windDir > 315 || windDir <= 45;
                if (isNorte && windKnots > 15) {
                    hourScore -= 25;
                    localRule = "Riesgo Deriva";
                    ruleColor = "text-red-600";
                }
            }

            hourScore = Math.max(0, Math.min(100, Math.round(hourScore)));
            totalScore += hourScore;
            validHoursCount++;

            const formattedTime = `${displayHour.toString().padStart(2, '0')}:00`;

            if (hourScore > maxScore) { maxScore = hourScore; bestHourTime = formattedTime; }
            if (hourScore < minScore) { minScore = hourScore; worstHourTime = formattedTime; }

            translatedHourlyData.push({
              time: formattedTime,
              swellH: effectiveWaveHeight.toFixed(2),
              rawSwellH: waveHeight.toFixed(2),
              period: period.toFixed(1),
              windS: localClimateDown ? "-" : windKnots,
              gust: localClimateDown ? "-" : gustKnots,
              windDir: localClimateDown ? "-" : windDir,
              uv: localClimateDown ? "-" : (weatherJson?.hourly?.uv_index?.[i] || "-"),
              rain: localClimateDown ? "-" : (weatherJson?.hourly?.precipitation_probability?.[i] || 0),
              hourScore: hourScore,
              waveEnergy: waveEnergy,
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
          
          // Cogemos la temperatura de las 12:00 del mediodía de ese día como referencia para la tarjeta
          const noonIndex = baseIndex + 12;
          
          daysProcessed.push({
            dayIndex: d,
            dayLabel: getDateLabel(offset, dayPrefixes[d]),
            name: beach.name,
            score: avgScore,
            temps: { 
                air: localClimateDown ? "-" : Math.round(weatherJson?.hourly?.temperature_2m?.[noonIndex] || 15), 
                water: 15 
            },
            hourly: translatedHourlyData,
            best: { time: bestHourTime, score: maxScore },
            worst: { time: worstHourTime, score: minScore },
            jellyfish: { risk: jRisk, color: jColor, bgColor: jBg }
          });
        }

        setBeachData(daysProcessed);
        setIsLoading(false);

      } catch (err) {
        console.error(err);
        setErrorDetails({ general: err.message });
        setIsLoading(false);
      }
    };

    fetchRealData();
    
  }, [selectedBeach]);

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
      const windText = isClimateDown ? "(Ignora el viento porque el satélite está caído)" : `Viento: ${currentDayData.hourly[0].windS} nudos.`;
      const prompt = `Eres un experto nadador de aguas abiertas y socorrista en Málaga. 
      Analiza los siguientes datos MARINOS de ${currentDayData.dayLabel.toLowerCase()} para la playa ${currentDayData.name}:
      Puntuación media de seguridad: ${currentDayData.score}/100.
      Olas medias: ${currentDayData.hourly[0].swellH}m. ${windText}
      Mejor hora para nadar: ${currentDayData.best.time}. Peor hora: ${currentDayData.worst.time}.
      Escribe un consejo corto y directo (máximo 3 frases) dirigido a un nadador de aguas abiertas. 
      Indica claramente si es seguro meterse a nadar. Usa un tono cercano.`;

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
    if (degrees === "-") return "-";
    if (degrees > 337.5 || degrees <= 22.5) return '⬇️ N';
    if (degrees > 22.5 && degrees <= 67.5) return '↙️ NE';
    if (degrees > 67.5 && degrees <= 112.5) return '⬅️ E';
    if (degrees > 112.5 && degrees <= 157.5) return '↖️ SE';
    if (degrees > 157.5 && degrees <= 202.5) return '⬆️ S';
    if (degrees > 202.5 && degrees <= 247.5) return '↗️ SO';
    if (degrees > 247.5 && degrees <= 292.5) return '➡️ O';
    if (degrees > 292.5 && degrees <= 337.5) return '↘️ NO';
    return '-';
  };

  const currentDayData = beachData ? beachData[selectedDay] : null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="bg-blue-600 p-3 rounded-xl text-white">
              <Waves size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">OpenWater Tracker</h1>
              <p className="text-slate-500 text-sm font-medium">Pronóstico en tiempo real para nadadores</p>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 md:gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-3 md:px-4 rounded-xl transition-colors border border-indigo-100 flex items-center justify-center gap-2"
              title="Guía Local del Mar"
            >
              <BookOpen size={18} />
              <span className="hidden sm:inline">Guía Local</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl w-full md:w-auto border border-slate-200 flex-1 md:flex-none overflow-hidden">
              <MapPin className="text-slate-400 ml-1 md:ml-2 shrink-0" size={20} />
              <select 
                value={selectedBeach} 
                onChange={(e) => setSelectedBeach(e.target.value)}
                className="bg-transparent font-bold text-slate-700 py-1.5 pr-4 pl-1 md:pl-2 outline-none w-full md:w-56 cursor-pointer text-ellipsis overflow-hidden"
              >
                <option value="misericordia">La Misericordia</option>
                <option value="malagueta">La Malagueta</option>
                <option value="pedregalejo">Pedregalejo</option>
              </select>
            </div>
          </div>
        </header>

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
                  onClick={() => handleDayChange(idx)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    selectedDay === idx 
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-4 space-y-6">
                
                {/* Tarjeta 1: Score de Seguridad */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center relative">
                  <div className="absolute top-4 right-4 text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
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
                      <p className="text-[10px] text-slate-400 mt-0.5">Satélite - Superficie</p>
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
                      href="https://bancodedatos.puertos.es/BD/informes/INT_1.php?inst=2842&t=1&c=1" 
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

                {/* Tarjeta 5: Riesgo de Medusas */}
                <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isClimateDown ? 'opacity-70' : ''}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                      <AlertCircle size={16} className={isClimateDown ? 'text-slate-400' : 'text-purple-500'}/> Riesgo de Medusas
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Cálculo Heurístico</span>
                  </div>
                  
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${currentDayData.jellyfish.bgColor}`}>
                    <span className={`font-black uppercase text-sm ${currentDayData.jellyfish.color}`}>
                      {currentDayData.jellyfish.risk.includes("Dato") ? currentDayData.jellyfish.risk : `Nivel ${currentDayData.jellyfish.risk}`}
                    </span>
                    <a href="https://oceanaria.es/" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-700 underline underline-offset-2 text-right">
                      Oceanaria
                    </a>
                  </div>
                  {isClimateDown && (
                    <p className="text-[10px] text-slate-400 mt-3 font-medium leading-tight">
                      *Al estar el satélite desconectado, no podemos predecir el impacto de las medusas por levante. Consulta Oceanaria directamente.
                    </p>
                  )}
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
                      <p className="text-blue-900 text-sm leading-relaxed font-medium bg-white/60 p-4 rounded-xl border border-blue-100/50 shadow-sm">
                        "{expertAdvice}"
                      </p>
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
                
                <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[750px] relative">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="px-5 py-4 font-bold">Hora</th>
                        <th className="px-4 py-4 font-bold text-center">Score</th>
                        <th className="px-4 py-4 font-bold">Oleaje</th>
                        <th className="px-4 py-4 font-bold text-center">Energía</th>
                        <th className="px-4 py-4 font-bold">Corrientes</th>
                        <th className={`px-4 py-4 font-bold ${isClimateDown ? 'text-slate-300' : ''}`}>Viento (kts)</th>
                        <th className={`px-4 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Lluvia</th>
                        <th className={`px-4 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Dir.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {currentDayData.hourly.map((hour, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50/50 transition-colors group ${selectedDay === 0 ? 'opacity-80' : ''}`}>
                          
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-800 text-base">{hour.time}</span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs
                                ${hour.hourScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                                  hour.hourScore > 40 ? 'bg-amber-100 text-amber-700' : 
                                  'bg-red-100 text-red-700'}`}>
                                {hour.hourScore}
                              </span>
                              {hour.localRule && (
                                <span className={`text-[9px] font-bold uppercase tracking-wide bg-white shadow-sm px-1.5 py-0.5 rounded border border-slate-100 ${hour.ruleColor}`}>
                                  {hour.localRule}
                                </span>
                              )}
                            </div>
                          </td>
                          
                          <td className="px-4 py-4">
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

                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`font-black text-base ${hour.waveEnergy > 50 ? 'text-orange-500' : 'text-slate-700'}`}>
                                {hour.waveEnergy}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Kj</span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1.5 justify-center items-start">
                              <span className={`text-xs whitespace-nowrap ${hour.ripColor}`} title="Riesgo de resaca (Arrastre hacia adentro)">
                                Resaca: {hour.ripRisk}
                              </span>
                              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 whitespace-nowrap ${hour.drift.color}`} title="Deriva lateral (Empuje paralelo a la orilla)">
                                <span>{hour.drift.icon}</span> <span>{hour.drift.short}</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            {isClimateDown ? (
                                <span className="font-bold text-slate-300 text-base">-</span>
                            ) : (
                                <div className="flex flex-col">
                                  <span className={`font-black text-base ${hour.windS > 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                                    {hour.windS} kts
                                  </span>
                                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    Rachas: {hour.gust}
                                  </span>
                                </div>
                            )}
                          </td>

                          <td className="px-4 py-4 text-center">
                             {isClimateDown ? (
                                <span className="font-bold text-slate-300">-</span>
                             ) : (
                                <div className="flex flex-col items-center justify-center">
                                  {hour.rain > 10 && <Droplets size={14} className="text-blue-400 mb-1" />}
                                  <span className={`font-bold ${hour.rain > 10 ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {hour.rain}%
                                  </span>
                                </div>
                             )}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className={`font-bold text-xs ${isClimateDown ? 'text-slate-300' : 'text-slate-700'}`}>
                              {getWindDirection(hour.windDir)}
                            </span>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </>
        )}

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Guía Fácil para Nadadores</h3>
                  <p className="text-xs text-slate-500 font-medium">Cómo leer OpenWater Tracker</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
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
                <h4 className="font-bold text-slate-800 text-lg mb-4 border-b pb-2">🛠️ 1. Las Corrientes (El Nuevo Radar)</h4>
                <p className="text-sm text-slate-600 mb-4">
                  En la columna "Corrientes" de la tabla, cruzamos los datos de las olas para vigilar los dos tipos de arrastres que pueden fastidiarte el nado:
                </p>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-3 items-start">
                     <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Resaca (Hacia adentro):</strong>
                       <p className="text-sm text-slate-600 mt-1">Depende de la altura de la ola y de su periodo. Si entra mucha agua a la playa, tiene que salir, creando embudos peligrosos que tiran hacia alta mar. Se marca como Baja, Media o Alta.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <Compass className="text-indigo-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Deriva Lateral (Flechitas):</strong>
                       <p className="text-sm text-slate-600 mt-1">La app cruza la inclinación de tu playa con el ángulo de la ola. Si la ola entra en diagonal, el agua "resbala" por la arena empujándote.<br/>
                       <strong>⬅️ Rincón:</strong> Si nadas hacia la zona Este irás más rápido; si vas a Torremolinos irás a contracorriente.<br/>
                       <strong>➡️ Torrem:</strong> La cinta transportadora del mar te empuja hacia el Oeste (Torremolinos).</p>
                     </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Bot size={20} className="text-indigo-500"/> 2. El "Cerebro" Malagueño
                </h4>
                <p className="text-sm text-slate-600 mb-5">
                  La aplicación no se fía a ciegas del satélite, sino que aplica nuestras <strong>4 Reglas de Oro</strong> automáticamente. Si ves sus etiquetas en la tabla, es que la app te está protegiendo:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600"><Waves size={24} /></div>
                      <h5 className="font-bold text-slate-800">El "Magón"</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Ola tendida sin viento. Aunque sea grande (0.5m), la app no castiga la seguridad porque es mar de fondo cómodo.</p>
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
                    <p className="text-sm text-slate-600 mb-3">La Malagueta y Pedregalejo rebajan automáticamente un 30% la fuerza de la ola gracias a los espigones.</p>
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

    </div>
  );
}
