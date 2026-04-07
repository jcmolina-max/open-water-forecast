import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  MapPin, 
  Bot,
  Loader2,
  AlertTriangle,
  Activity,
  Thermometer,
  ShieldCheck,
  Sun,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
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
  Info
} from 'lucide-react';

// Coordenadas reales de las playas
const BEACHES = {
  misericordia: { name: "La Misericordia, Málaga", lat: 36.696, lon: -4.444 },
  malagueta: { name: "La Malagueta, Málaga", lat: 36.718, lon: -4.407 },
  pedregalejo: { name: "Pedregalejo, Málaga", lat: 36.721, lon: -4.386 }
};

// Generador de etiquetas de fecha
const getDateLabel = (offset, prefix) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const day = d.getDate();
  const monthStr = d.toLocaleString('es-ES', { month: 'short' });
  return `${prefix} (${day} ${monthStr})`;
};

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  const [selectedDay, setSelectedDay] = useState(0); 
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
      setSelectedDay(0); 
      
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

      // 1. INTENTAMOS DESCARGAR EL CLIMA (Silenciosamente)
      try {
        weatherJson = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,uv_index&timezone=Europe%2FMadrid`);
      } catch (e) {
        console.warn("Satélite de clima caído. Activando auto-rescate.", e);
        localClimateDown = true;
        setIsClimateDown(true);
      }

      // 2. INTENTAMOS DESCARGAR EL MAR (Es obligatorio para que funcione)
      try {
        marineJson = await fetchWithTimeout(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period&timezone=Europe%2FMadrid`);
      } catch (e) {
         setErrorDetails({ general: `El satélite marino no responde: ${e.message}` });
         setIsLoading(false);
         return; 
      }

      // 3. PROCESAMOS LOS DATOS
      try {
        const currentHour = new Date().getHours();
        const daysProcessed = []; 

        for (let d = 0; d < 3; d++) {
          let startIndex = d === 0 ? currentHour : (d === 1 ? 32 : 56);

          let translatedHourlyData = [];
          let totalScore = 0;
          let maxScore = -1;
          let minScore = 101;
          let bestHourTime = "";
          let worstHourTime = "";
          
          let eastWindCount = 0;
          let maxEastWind = 0;

          for (let i = startIndex; i < startIndex + 12; i++) {
            if (!marineJson?.hourly?.wave_height || i >= marineJson.hourly.wave_height.length) break;

            const waveHeightStr = marineJson.hourly.wave_height[i];
            const waveHeight = waveHeightStr !== null ? waveHeightStr : 0.1;
            const period = marineJson.hourly?.wave_period?.[i] || 4;
            
            const windKmh = localClimateDown ? 0 : (weatherJson?.hourly?.wind_speed_10m?.[i] || 0);
            const windKnots = Math.round(windKmh / 1.852);
            const gustKnots = localClimateDown ? 0 : Math.round((weatherJson?.hourly?.wind_gusts_10m?.[i] || 0) / 1.852);
            const windDir = localClimateDown ? 0 : (weatherJson?.hourly?.wind_direction_10m?.[i] || 0);
            const displayHour = i % 24;
            
            // --- REGLA 4: EL ESCUDO (Atenuación del Puerto) ---
            let effectiveWaveHeight = waveHeight;
            let localRule = null;
            let ruleColor = "";

            if (selectedBeach === 'malagueta' || selectedBeach === 'pedregalejo') {
                effectiveWaveHeight = waveHeight * 0.7; 
                localRule = "Escudo Activo";
                ruleColor = "text-indigo-500";
            }
            
            // --- DETECCIÓN DE LEVANTE ---
            if (!localClimateDown && windDir > 45 && windDir < 135) {
                eastWindCount++;
                if (windKnots > maxEastWind) maxEastWind = windKnots;
            }

            const waveEnergy = Math.round(Math.pow(effectiveWaveHeight, 2) * period * 6.25);
            
            let ripRisk = "Nulo";
            let ripColor = "text-slate-400";
            if (effectiveWaveHeight >= 1.0 || (effectiveWaveHeight >= 0.8 && period > 6)) {
              ripRisk = "Alto";
              ripColor = "text-red-600 font-bold bg-red-50 px-2 py-1 rounded";
            } else if (effectiveWaveHeight >= 0.6) {
              ripRisk = "Medio";
              ripColor = "text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded";
            } else if (effectiveWaveHeight >= 0.3) {
              ripRisk = "Bajo";
              ripColor = "text-blue-600 font-medium";
            }

            let hourScore = 100;
            
            if (effectiveWaveHeight > 0.2) hourScore -= (effectiveWaveHeight * 20);
            if (effectiveWaveHeight > 0.6) hourScore -= (Math.pow(effectiveWaveHeight, 2) * 25); 
            if (period < 4.5 && effectiveWaveHeight > 0.5) hourScore -= 15;
            if (period < 3.5 && effectiveWaveHeight > 0.6) hourScore -= 25;
            
            if (!localClimateDown) {
                if (windKnots > 8) hourScore -= ((windKnots - 8) * 2);
                
                // REGLA 1: EL MAGÓN
                if (effectiveWaveHeight >= 0.4 && effectiveWaveHeight <= 0.7 && windKnots < 8 && period > 5.5) {
                    hourScore = 100 - (effectiveWaveHeight * 10); 
                    localRule = "Magón";
                    ruleColor = "text-emerald-600";
                }
                // REGLA 2: LA LAVADORA TÉRMICA
                const isPoniente = windDir > 202.5 && windDir <= 292.5;
                if (isPoniente && displayHour >= 12 && displayHour <= 18 && windKnots > 12) {
                    hourScore -= 25;
                    localRule = "Lavadora";
                    ruleColor = "text-amber-600";
                }
                // REGLA 3: EL TERRAL
                const isNorte = windDir > 315 || windDir <= 45;
                if (isNorte && windKnots > 15) {
                    hourScore -= 25;
                    localRule = "Riesgo Deriva";
                    ruleColor = "text-red-600";
                }
            }

            hourScore = Math.max(0, Math.min(100, Math.round(hourScore)));
            totalScore += hourScore;

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

          const avgScore = Math.round(totalScore / 12);
          const dayLabels = [
              getDateLabel(0, "Hoy"), 
              getDateLabel(1, "Mañana"), 
              getDateLabel(2, "Pasado")
          ];
          
          daysProcessed.push({
            dayIndex: d,
            dayLabel: dayLabels[d],
            name: beach.name,
            score: avgScore,
            temps: { 
                air: localClimateDown ? "-" : Math.round(weatherJson?.hourly?.temperature_2m?.[startIndex] || 15), 
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
        
        {/* CABECERA */}
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

        {/* CARTEL DE EMERGENCIA INTELIGENTE */}
        {!isLoading && !errorDetails && isClimateDown && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-amber-800">Modo de Emergencia Activo</h3>
              <p className="text-sm text-amber-700 mt-1">
                El satélite global de clima está temporalmente fuera de servicio. Estamos mostrando <strong>solo las previsiones de oleaje y resaca</strong>. Los datos de viento, temperatura y alertas volverán solos cuando el servidor se restaure.
              </p>
            </div>
          </div>
        )}

        {/* PANEL DE DIAGNÓSTICO DE ERRORES (Solo Mar) */}
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
            {/* SELECTOR DE DÍAS CON FECHAS */}
            <div className="flex flex-wrap gap-2 mb-2">
              {beachData.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDayChange(idx)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    selectedDay === idx 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CalendarDays size={16} />
                  {day.dayLabel}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* PANEL IZQUIERDO */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Tarjeta 1: Score de Seguridad */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
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
                      <p className="text-sm text-slate-500 font-medium">Agua</p>
                      <p className="text-xl font-bold text-slate-800">{currentDayData.temps.water}ºC</p>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-slate-200"></div>
                  <div className="flex items-center gap-3">
                    <div className={isClimateDown ? "bg-slate-50 p-2 rounded-lg text-slate-400" : "bg-orange-50 p-2 rounded-lg text-orange-500"}><Sun size={24}/></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Aire ({currentDayData.dayLabel.split(' ')[0]})</p>
                      <p className={`text-xl font-bold ${isClimateDown ? 'text-slate-400' : 'text-slate-800'}`}>
                        {currentDayData.temps.air === "-" ? "- ºC" : `${currentDayData.temps.air}ºC`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 3: Mejor y Peor Hora */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs mb-2">
                    <Clock size={16} className="text-indigo-500"/> Horas Clave
                  </h3>
                  
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

                {/* Tarjeta 4: Mareas Oficiales */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs mb-3">
                    <Waves size={16} className="text-cyan-500"/> Mareas Oficiales
                  </h3>
                  <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                    Las mareas astronómicas exactas deben consultarse en las tablas oficiales para mayor seguridad.
                  </p>
                  <a 
                    href="https://tablademareas.com/es/malaga/malaga" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-cyan-700 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
                  >
                    Ver tabla de mareas
                  </a>
                </div>

                {/* Tarjeta 5: Riesgo de Medusas */}
                <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isClimateDown ? 'opacity-70' : ''}`}>
                  <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs mb-4">
                    <AlertCircle size={16} className={isClimateDown ? 'text-slate-400' : 'text-purple-500'}/> Riesgo de Medusas
                  </h3>
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${currentDayData.jellyfish.bgColor}`}>
                    <span className={`font-black uppercase text-sm ${currentDayData.jellyfish.color}`}>
                      {currentDayData.jellyfish.risk.includes("Dato") ? currentDayData.jellyfish.risk : `Nivel ${currentDayData.jellyfish.risk}`}
                    </span>
                    {/* ENLACE A OCEANARIA SIEMPRE VISIBLE */}
                    <a href="https://oceanaria.es/" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-700 underline underline-offset-2 text-right">
                      Oceanaria
                    </a>
                  </div>
                  {isClimateDown && (
                    <p className="text-[10px] text-slate-400 mt-3 font-medium leading-tight">
                      *Al estar el satélite de viento desconectado, no podemos predecir el impacto de las medusas por levante. Consulta Oceanaria directamente.
                    </p>
                  )}
                </div>

                {/* Tarjeta 6: Boya Oficial de Puertos del Estado */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs mb-3">
                    <Anchor size={16} className="text-blue-500"/> Boya Oficial (En Directo)
                  </h3>
                  <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                    Consulta la temperatura exacta y el oleaje medido en este instante por Puertos del Estado.
                  </p>
                  <a 
                    href="https://portus.puertos.es/#/" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-blue-700 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
                  >
                    Ver datos en Portus
                  </a>
                </div>

                {/* Tarjeta 7: Socorrista Virtual */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Bot size={80} />
                  </div>
                  <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2 relative z-10">
                    <Bot className="text-blue-600" size={20} />
                    Socorrista Virtual
                  </h3>
                  
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
                  <h3 className="font-bold text-slate-800 text-lg">Evolución del mar</h3>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                    <CalendarDays size={14}/> {currentDayData.dayLabel.split(' ')[0]}
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="px-5 py-4 font-bold">Hora</th>
                        <th className="px-5 py-4 font-bold text-center">Score</th>
                        <th className="px-5 py-4 font-bold">Oleaje (m / s)</th>
                        <th className="px-5 py-4 font-bold text-center">Energía</th>
                        <th className="px-5 py-4 font-bold text-center">Resaca</th>
                        <th className={`px-5 py-4 font-bold ${isClimateDown ? 'text-slate-300' : ''}`}>Viento (Nudos)</th>
                        <th className={`px-5 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Lluvia</th>
                        <th className={`px-5 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>Dir.</th>
                        <th className={`px-5 py-4 font-bold text-center ${isClimateDown ? 'text-slate-300' : ''}`}>UV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {currentDayData.hourly.map((hour, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                          
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-800 text-base">{hour.time}</span>
                          </td>

                          <td className="px-5 py-4 text-center">
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
                          
                          <td className="px-5 py-4">
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

                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`font-black text-base ${hour.waveEnergy > 50 ? 'text-orange-500' : 'text-slate-700'}`}>
                                {hour.waveEnergy}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Kj</span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className={`text-xs ${hour.ripColor}`}>
                              {hour.ripRisk}
                            </span>
                          </td>

                          <td className="px-5 py-4">
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

                          <td className="px-5 py-4 text-center">
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

                          <td className="px-5 py-4 text-center">
                            <span className={`font-bold text-xs ${isClimateDown ? 'text-slate-300' : 'text-slate-700'}`}>
                              {getWindDirection(hour.windDir)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className={`font-black ${isClimateDown ? 'text-slate-300' : (hour.uv > 5 ? 'text-orange-500' : 'text-slate-400')}`}>
                              {hour.uv}
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

        {/* FOOTER LEGAL Y ATRIBUCIÓN */}
        {beachData && (
          <footer className="mt-8 text-center space-y-3 pb-6">
            <p className="text-xs text-slate-500 font-medium px-4 max-w-4xl mx-auto leading-relaxed">
              ⚠️ <strong className="text-slate-700">Aviso Legal:</strong> Los datos mostrados son estimaciones automatizadas generadas por algoritmos y satélites. El nado en aguas abiertas conlleva riesgos inherentes. Esta aplicación no sustituye el juicio personal ni las banderas oficiales. <strong>Evalúa siempre el estado real del mar por ti mismo y bajo tu propia responsabilidad antes de entrar al agua.</strong>
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              Datos meteorológicos proporcionados gratuitamente por <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Open-Meteo.com</a>
            </p>
          </footer>
        )}

      </div>

      {/* LA NUEVA VENTANA MODAL: GUÍA DEL NADADOR + REGLAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Cabecera del Modal */}
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

            {/* Contenido Completo de la Guía */}
            <div className="p-6 overflow-y-auto space-y-8">
              
              {/* INTRODUCCIÓN */}
              <section>
                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                  Hola a todos. Hemos creado esta aplicación web porque todos sabemos una cosa: <strong>las aplicaciones del tiempo normales no tienen ni idea de cómo se nada en Málaga.</strong> Para una app normal, una ola de medio metro es lo mismo en mar abierto que detrás de nuestro Puerto, y sabemos que eso no es verdad. Por eso, hemos cogido los datos en bruto de los satélites y les hemos metido <strong>"nuestra experiencia local"</strong>.
                </p>
              </section>

              {/* SECCIÓN 1: PUNTUACIÓN */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Activity size={20} className="text-blue-500"/> 1. La Nota de Seguridad (De 0 a 100)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  Olvídate de hacer cálculos raros. La aplicación coge la altura de la ola, la fuerza del viento y el periodo, y te da una nota del 0 al 100 para cada hora:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-center">
                     <span className="font-black text-emerald-700 text-lg mb-1">🟢 Verde (>70)</span>
                     <span className="text-sm text-emerald-600">El mar es casi una piscina o el nado va a ser muy cómodo.</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex flex-col justify-center">
                     <span className="font-black text-amber-700 text-lg mb-1">🟠 Naranja (40-70)</span>
                     <span className="text-sm text-amber-600">Mar picado o agitado. Se puede nadar, pero tragarás algo de agua.</span>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col justify-center">
                     <span className="font-black text-red-700 text-lg mb-1">🔴 Rojo (&lt;40)</span>
                     <span className="text-sm text-red-600">Lavadora total o riesgo alto de corrientes. Mejor quedarse en el chiringuito.</span>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 2: REGLAS HEURÍSTICAS */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Bot size={20} className="text-indigo-500"/> 2. El "Cerebro" Malagueño
                </h4>
                <p className="text-sm text-slate-600 mb-5">
                  Esta es la verdadera magia. La aplicación no se fía a ciegas del satélite, sino que aplica nuestras <strong>4 Reglas de Oro</strong> automáticamente. Si ves sus etiquetas en la tabla, es que la app te está protegiendo:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600">
                        <Waves size={24} />
                      </div>
                      <h5 className="font-bold text-slate-800">El "Magón"</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      Ola tendida y limpia (mar de fondo). Aunque el satélite marque 0.5m o más, si no hay viento, la app te dará luz verde porque la ola simplemente te mece sin romper.
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md">Viento Nulo</span>
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">Nado Cómodo</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
                        <ThermometerSun size={24} />
                      </div>
                      <h5 className="font-bold text-slate-800">La "Lavadora" Térmica</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      A mediodía, el calor de la tierra actúa como turbo para el viento de <strong>Poniente</strong>, levantando un mar picado ("choppy") repentino e incómodo.
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md">12:00h - 18:00h</span>
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-1 rounded-md">Incómodo</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-red-50 p-2.5 rounded-xl text-red-600">
                        <Wind size={24} />
                      </div>
                      <h5 className="font-bold text-slate-800">La trampa del Terral</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      El viento fuerte de <strong>Norte (Tierra)</strong> alisa la orilla creando una falsa sensación de calma. Peligro alto de ser arrastrado hacia alta mar si te alejas.
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md">Falsa Calma</span>
                      <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-1 rounded-md flex items-center gap-1">
                        <ArrowUpRight size={12}/> Riesgo Deriva
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                        <ShieldAlert size={24} />
                      </div>
                      <h5 className="font-bold text-slate-800">El Escudo del Puerto</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      Las playas de La Malagueta y Pedregalejo están fuertemente protegidas por el Puerto y los espigones. La app baja automáticamente la fuerza de las olas aquí.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">Malagueta</span>
                      <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">Pedregalejo</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 3: OTRAS HERRAMIENTAS */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 border-b pb-2">🛠️ 3. Otras Herramientas</h4>
                <div className="space-y-4">
                  <div className="flex gap-3 items-start">
                     <AlertCircle className="text-purple-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">El Radar de Medusas:</strong>
                       <p className="text-sm text-slate-600 mt-1">La app cuenta cuántas horas seguidas sopla Levante. Si ve que lleva muchas horas empujando agua hacia la costa, te avisará de que el riesgo de encontrar "amigas" es Alto o Medio.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <Bot className="text-blue-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">El Socorrista Virtual:</strong>
                       <p className="text-sm text-slate-600 mt-1">¿Tienes dudas viendo la tabla? Dale al botón azul para que una IA lea los datos y te dé un consejo de tres líneas en lenguaje de andar por casa.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Modo de Supervivencia:</strong>
                       <p className="text-sm text-slate-600 mt-1">Si los satélites fallan, la app saca un cartel amarillo. Perderemos los datos de viento, pero seguirá mostrando el tamaño de las olas para que no te quedes ciego.</p>
                     </div>
                  </div>
                </div>
              </section>

              {/* AVISO FINAL */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-800 font-medium flex items-start gap-3">
                <Info className="shrink-0 text-amber-600 mt-0.5" size={20} />
                <p>
                  <strong>El sentido común manda:</strong> Esta web es una ayuda genial hecha por y para nosotros, pero son previsiones matemáticas. Si la app dice verde, pero llegas a la playa y ves bandera roja o no lo ves claro, <strong>no te metas</strong>. ¡Tu instinto y tus ojos son el mejor satélite! Nos vemos en el agua 🏊‍♂️
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
