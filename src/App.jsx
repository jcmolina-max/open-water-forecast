import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  MapPin, 
  Navigation,
  Bot,
  Loader2,
  AlertTriangle,
  CloudRain,
  Activity,
  Thermometer,
  ShieldCheck,
  Sun
} from 'lucide-react';

// Coordenadas reales de las playas para pedir los datos al satélite
const BEACHES = {
  misericordia: { name: "La Misericordia, Málaga", lat: 36.696, lon: -4.444 },
  malagueta: { name: "La Malagueta, Málaga", lat: 36.718, lon: -4.407 },
  pedregalejo: { name: "Pedregalejo, Málaga", lat: 36.721, lon: -4.386 }
};

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  const [beachData, setBeachData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [expertAdvice, setExpertAdvice] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const fetchRealData = async () => {
      setIsLoading(true);
      setError(null);
      
      const beach = BEACHES[selectedBeach];

      try {
        const [weatherResponse, marineResponse] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,uv_index&timezone=Europe%2FMadrid`),
          fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period&timezone=Europe%2FMadrid`)
        ]);

        if (!weatherResponse.ok || !marineResponse.ok) {
          throw new Error("Error al conectar con los satélites");
        }

        const weatherJson = await weatherResponse.json();
        const marineJson = await marineResponse.json();

        const currentHour = new Date().getHours();
        let translatedHourlyData = [];
        let totalScore = 0;

        for (let i = currentHour; i < currentHour + 12; i++) {
          const waveHeightStr = marineJson.hourly.wave_height[i];
          const waveHeight = waveHeightStr !== null ? waveHeightStr : 0.1;
          const period = marineJson.hourly.wave_period[i] || 4;
          
          const windKmh = weatherJson.hourly.wind_speed_10m[i] || 0;
          const windKnots = Math.round(windKmh / 1.852);
          const gustKnots = Math.round((weatherJson.hourly.wind_gusts_10m[i] || 0) / 1.852);
          
          // --- CÁLCULOS: ENERGÍA Y RESACA ---
          const waveEnergy = Math.round(Math.pow(waveHeight, 2) * period * 100);
          
          let ripRisk = "Nulo";
          let ripColor = "text-slate-400";
          if (waveHeight >= 1.0 || (waveHeight >= 0.8 && period > 6)) {
            ripRisk = "Alto";
            ripColor = "text-red-600 font-bold bg-red-50 px-2 py-1 rounded";
          } else if (waveHeight >= 0.6) {
            ripRisk = "Medio";
            ripColor = "text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded";
          } else if (waveHeight >= 0.3) {
            ripRisk = "Bajo";
            ripColor = "text-blue-600 font-medium";
          }

          // --- NUEVO ALGORITMO DE SEGURIDAD PARA NADADORES ---
          let hourScore = 100;
          
          // Castigo por altura de ola (Exponencial: a partir de 0.6m penaliza mucho)
          if (waveHeight > 0.2) hourScore -= (waveHeight * 20);
          if (waveHeight > 0.6) hourScore -= (Math.pow(waveHeight, 2) * 25);
          
          // Castigo por viento
          if (windKnots > 8) hourScore -= ((windKnots - 8) * 2);
          
          // Castigo por "Choppy" (Periodo corto + ola)
          if (period < 4.5 && waveHeight > 0.3) hourScore -= 15;
          if (period < 3.5 && waveHeight > 0.4) hourScore -= 25;

          hourScore = Math.max(0, Math.min(100, hourScore));
          
          totalScore += hourScore;

          translatedHourlyData.push({
            time: `${i.toString().padStart(2, '0')}:00`,
            swellH: waveHeight.toFixed(2),
            period: period.toFixed(1),
            windS: windKnots,
            gust: gustKnots,
            windDir: weatherJson.hourly.wind_direction_10m[i] || 0,
            uv: weatherJson.hourly.uv_index[i] || 0,
            rain: weatherJson.hourly.precipitation_probability[i] || 0,
            hourScore: Math.round(hourScore),
            waveEnergy: waveEnergy,
            ripRisk: ripRisk,
            ripColor: ripColor
          });
        }

        const avgScore = Math.round(totalScore / 12);
        
        const unifiedData = {
          name: beach.name,
          score: avgScore,
          temps: { 
            air: Math.round(weatherJson.hourly.temperature_2m[currentHour]), 
            water: 15
          },
          hourly: translatedHourlyData
        };

        setBeachData(unifiedData);
        setIsLoading(false);
        fetchExpertAdvice(unifiedData);

      } catch (err) {
        console.error(err);
        setError("No pudimos conectar con los satélites meteorológicos.");
        setIsLoading(false);
      }
    };

    fetchRealData();
  }, [selectedBeach]);

  const fetchExpertAdvice = async (data) => {
    setIsAiLoading(true);
    
    // El comando correcto para Vite:
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "") {
        setTimeout(() => {
            // Mensaje final. Si ves esto, Vercel no está asociando la variable en el Build.
            setExpertAdvice("Todo subido correctamente. Vercel necesita que hagas un Redeploy para inyectar la variable VITE_GEMINI_API_KEY.");
            setIsAiLoading(false);
        }, 1000);
        return;
    }

    try {
      const prompt = `Eres un experto nadador de aguas abiertas y socorrista en Málaga. 
      Analiza los siguientes datos de hoy para la playa ${data.name}:
      Puntuación de seguridad para nadadores: ${data.score}/100.
      Olas medias: ${data.hourly[0].swellH}m. Viento: ${data.hourly[0].windS} nudos.
      Escribe un consejo corto y directo (máximo 3 frases) dirigido a un nadador de aguas abiertas. 
      Indica claramente si es seguro meterse a nadar hoy y a qué debe prestar atención (corrientes, picado, etc). Usa un tono cercano.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const result = await response.json();
      if (result.candidates && result.candidates[0]) {
        setExpertAdvice(result.candidates[0].content.parts[0].text);
      } else {
        throw new Error("Respuesta inválida de la IA");
      }
    // ... código anterior ...
    } catch (err) {
      setExpertAdvice(`Error de conexión con Google: ${err.message}. Comprueba la consola del navegador para más detalles.`);
      console.error("Detalle completo del error:", err);
    } finally {
// ... código posterior ...
      setIsAiLoading(false);
    }
  };

  const getWindDirection = (degrees) => {
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

          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl w-full md:w-auto border border-slate-200">
            <MapPin className="text-slate-400 ml-2" size={20} />
            <select 
              value={selectedBeach} 
              onChange={(e) => setSelectedBeach(e.target.value)}
              className="bg-transparent font-bold text-slate-700 py-2 pr-8 pl-2 outline-none w-full md:w-64 cursor-pointer"
            >
              <option value="misericordia">La Misericordia</option>
              <option value="malagueta">La Malagueta</option>
              <option value="pedregalejo">Pedregalejo</option>
            </select>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle size={24} />
            <p>{error}</p>
          </div>
        )}

        {isLoading && !error ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl shadow-sm border border-slate-200">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500 font-medium animate-pulse text-lg">Conectando con Open-Meteo y analizando satélites...</p>
          </div>
        ) : beachData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* PANEL IZQUIERDO (Información General) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Tarjeta 1: Score de Seguridad */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                <h2 className="text-slate-500 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                  <Activity size={18} className="text-blue-500"/> Seguridad Media (12h)
                </h2>
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-slate-100" />
                    <circle 
                      cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" 
                      strokeDasharray="439.8" 
                      strokeDashoffset={439.8 - (439.8 * beachData.score) / 100}
                      className={beachData.score > 70 ? 'text-emerald-500' : beachData.score > 40 ? 'text-amber-500' : 'text-red-500'} 
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <span className="text-5xl font-black text-slate-800">{beachData.score}</span>
                    <span className="text-xs font-bold text-slate-400">/ 100</span>
                  </div>
                </div>
                <p className={`mt-5 font-black text-lg ${beachData.score > 70 ? 'text-emerald-600' : beachData.score > 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {beachData.score > 70 ? 'Nado Seguro' : beachData.score > 40 ? 'Precaución: Mar Agitado' : 'No Recomendado Nadar'}
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium">Algoritmo propio: Penaliza oleaje picado y vientos fuertes.</p>
              </div>

              {/* Tarjeta 2: Temperaturas */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Thermometer size={24}/></div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Agua</p>
                    <p className="text-xl font-bold text-slate-800">{beachData.temps.water}ºC</p>
                  </div>
                </div>
                <div className="h-10 w-px bg-slate-200"></div>
                <div className="flex items-center gap-3">
                  <div className="bg-orange-50 p-2 rounded-lg text-orange-500"><Sun size={24}/></div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Aire (Actual)</p>
                    <p className="text-xl font-bold text-slate-800">{beachData.temps.air}ºC</p>
                  </div>
                </div>
              </div>

              {/* Tarjeta 3: Consejo del Socorrista Virtual */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Bot size={80} />
                </div>
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2 relative z-10">
                  <Bot className="text-blue-600" size={20} />
                  Consejo del Socorrista Virtual
                </h3>
                {isAiLoading ? (
                  <div className="flex items-center gap-2 text-blue-600/70">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">El experto está evaluando las condiciones...</span>
                  </div>
                ) : (
                  <p className="text-blue-800 text-sm leading-relaxed relative z-10 font-medium">
                    "{expertAdvice}"
                  </p>
                )}
              </div>

            </div>

            {/* PANEL DERECHO: Tabla de previsiones por hora */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-lg">Evolución del mar (Próximas 12h)</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                  <ShieldCheck size={14}/> Datos en Directo
                </span>
              </div>
              
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                      <th className="px-5 py-4 font-bold">Hora</th>
                      <th className="px-5 py-4 font-bold text-center">Score</th>
                      <th className="px-5 py-4 font-bold">Oleaje (m / s)</th>
                      <th className="px-5 py-4 font-bold text-center">Energía</th>
                      <th className="px-5 py-4 font-bold text-center">Resaca</th>
                      <th className="px-5 py-4 font-bold">Viento (Nudos)</th>
                      <th className="px-5 py-4 font-bold text-center">Dirección</th>
                      <th className="px-5 py-4 font-bold text-center">UV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {beachData.hourly.map((hour, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                        
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-800 text-base">{hour.time}</span>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs
                            ${hour.hourScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                              hour.hourScore > 40 ? 'bg-amber-100 text-amber-700' : 
                              'bg-red-100 text-red-700'}`}>
                            {hour.hourScore}
                          </span>
                        </td>
                        
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className={`font-black text-base ${hour.swellH > 0.8 ? 'text-red-500' : 'text-blue-600'}`}>
                              {hour.swellH}m
                            </span>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                              Periodo: {hour.period}s
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
                          <div className="flex flex-col">
                            <span className={`font-black text-base ${hour.windS > 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                              {hour.windS} kts
                            </span>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                              Ráfagas: {hour.gust}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex items-center justify-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 group-hover:bg-white transition-colors">
                            <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                              {getWindDirection(hour.windDir)}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className={`font-black ${hour.uv > 5 ? 'text-orange-500' : 'text-slate-400'}`}>
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
        )}
      </div>
    </div>
  );
}
