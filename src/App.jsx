import React, { useState, useEffect } from 'react';
import { 
  Wind, 
  Waves, 
  Sun, 
  CloudRain, 
  Cloud, 
  Thermometer, 
  Droplets, 
  ArrowUp, 
  MapPin, 
  Calendar, 
  Activity, 
  Clock,
  AlertTriangle,
  Umbrella,
  Sparkles,
  Bot,
  Loader2,
  Zap,
  ShieldCheck,
  Dumbbell,
  Briefcase
} from 'lucide-react';

// --- 1. SIMULACIÓN DE DATOS (MOCK DATA) ---
// Datos actualizados con previsiones reales (Abril)
const MOCK_DATA = {
  zarautz: {
    name: "Zarautz, País Vasco",
    days: [
      {
        date: "Hoy (Temporal)", score: 10, // Peligro extremo por fuerte marejada
        bestTime: "19:00", worstTime: "10:00",
        tides: { high: "16:20 (4.0m)", low: "10:05 (0.5m)", coef: 70 }, temps: { air: 13, water: 13 },
        hourly: [
          { time: "07:00", swellH: 2.4, period: 14, waveEnergy: 450, currents: { speed: 1.8, ripRisk: "Alto" }, windS: 15, gust: 24, windDir: 315, uv: 1, rain: 80, weather: 'rainy' },
          { time: "10:00", swellH: 2.5, period: 14, waveEnergy: 480, currents: { speed: 2.0, ripRisk: "Alto" }, windS: 18, gust: 26, windDir: 315, uv: 3, rain: 90, weather: 'rainy' },
          { time: "13:00", swellH: 2.4, period: 13, waveEnergy: 420, currents: { speed: 1.9, ripRisk: "Alto" }, windS: 16, gust: 25, windDir: 320, uv: 5, rain: 60, weather: 'cloudy' },
          { time: "16:00", swellH: 2.3, period: 13, waveEnergy: 390, currents: { speed: 1.7, ripRisk: "Alto" }, windS: 14, gust: 22, windDir: 320, uv: 3, rain: 40, weather: 'rainy' },
          { time: "19:00", swellH: 2.1, period: 12, waveEnergy: 320, currents: { speed: 1.5, ripRisk: "Alto" }, windS: 12, gust: 18, windDir: 315, uv: 1, rain: 20, weather: 'cloudy' },
        ]
      },
      {
        date: "Mañana", score: 25, bestTime: "19:00", worstTime: "07:00",
        tides: { high: "17:00 (3.8m)", low: "10:45 (0.6m)", coef: 65 }, temps: { air: 14, water: 13 },
        hourly: [
          { time: "07:00", swellH: 2.0, period: 12, waveEnergy: 300, currents: { speed: 1.4, ripRisk: "Alto" }, windS: 12, gust: 18, windDir: 310, uv: 1, rain: 30, weather: 'rainy' },
          { time: "10:00", swellH: 1.8, period: 11, waveEnergy: 250, currents: { speed: 1.2, ripRisk: "Alto" }, windS: 14, gust: 20, windDir: 310, uv: 4, rain: 10, weather: 'cloudy' },
          { time: "13:00", swellH: 1.6, period: 11, waveEnergy: 210, currents: { speed: 1.0, ripRisk: "Medio" }, windS: 15, gust: 22, windDir: 315, uv: 6, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 1.5, period: 10, waveEnergy: 180, currents: { speed: 0.9, ripRisk: "Medio" }, windS: 12, gust: 18, windDir: 315, uv: 4, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 1.4, period: 10, waveEnergy: 150, currents: { speed: 0.8, ripRisk: "Medio" }, windS: 10, gust: 15, windDir: 320, uv: 1, rain: 0, weather: 'cloudy' },
        ]
      },
      {
        date: "Pasado Mañana", score: 40, bestTime: "13:00", worstTime: "07:00",
        tides: { high: "17:40 (3.6m)", low: "11:20 (0.8m)", coef: 60 }, temps: { air: 15, water: 14 },
        hourly: [
          { time: "07:00", swellH: 1.3, period: 9, waveEnergy: 130, currents: { speed: 0.8, ripRisk: "Medio" }, windS: 8, gust: 12, windDir: 300, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 1.2, period: 9, waveEnergy: 110, currents: { speed: 0.7, ripRisk: "Medio" }, windS: 10, gust: 14, windDir: 300, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 1.1, period: 8, waveEnergy: 90, currents: { speed: 0.6, ripRisk: "Bajo" }, windS: 12, gust: 16, windDir: 310, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 1.1, period: 8, waveEnergy: 90, currents: { speed: 0.6, ripRisk: "Bajo" }, windS: 10, gust: 15, windDir: 310, uv: 5, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 1.0, period: 8, waveEnergy: 80, currents: { speed: 0.5, ripRisk: "Bajo" }, windS: 8, gust: 12, windDir: 300, uv: 1, rain: 0, weather: 'cloudy' },
        ]
      }
    ]
  },
  tarifa: {
    name: "Tarifa, Andalucía",
    days: [
      {
        date: "Hoy", score: 65, bestTime: "08:00", worstTime: "16:00",
        tides: { high: "14:20 (1.5m)", low: "08:10 (0.5m)", coef: 50 }, temps: { air: 18, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.6, period: 6, waveEnergy: 35, currents: { speed: 0.8, ripRisk: "Medio" }, windS: 8, gust: 12, windDir: 270, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.6, period: 6, waveEnergy: 35, currents: { speed: 0.9, ripRisk: "Medio" }, windS: 10, gust: 14, windDir: 270, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.7, period: 7, waveEnergy: 45, currents: { speed: 1.2, ripRisk: "Medio" }, windS: 12, gust: 16, windDir: 275, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.8, period: 7, waveEnergy: 55, currents: { speed: 1.4, ripRisk: "Alto" }, windS: 14, gust: 18, windDir: 275, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.7, period: 6, waveEnergy: 45, currents: { speed: 1.1, ripRisk: "Medio" }, windS: 10, gust: 15, windDir: 270, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Mañana", score: 60, bestTime: "07:00", worstTime: "16:00",
        tides: { high: "15:00", low: "09:00", coef: 55 }, temps: { air: 19, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.7, period: 6, waveEnergy: 45, currents: { speed: 1.0, ripRisk: "Medio" }, windS: 10, gust: 14, windDir: 275, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.8, period: 7, waveEnergy: 55, currents: { speed: 1.2, ripRisk: "Medio" }, windS: 12, gust: 16, windDir: 275, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.9, period: 7, waveEnergy: 65, currents: { speed: 1.4, ripRisk: "Alto" }, windS: 15, gust: 20, windDir: 280, uv: 9, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 1.0, period: 8, waveEnergy: 80, currents: { speed: 1.5, ripRisk: "Alto" }, windS: 18, gust: 24, windDir: 280, uv: 7, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.9, period: 7, waveEnergy: 65, currents: { speed: 1.3, ripRisk: "Alto" }, windS: 14, gust: 18, windDir: 275, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Pasado Mañana", score: 55, bestTime: "07:00", worstTime: "16:00",
        tides: { high: "15:45", low: "09:45", coef: 60 }, temps: { air: 19, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.9, period: 7, waveEnergy: 65, currents: { speed: 1.2, ripRisk: "Medio" }, windS: 12, gust: 16, windDir: 280, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 1.0, period: 8, waveEnergy: 80, currents: { speed: 1.4, ripRisk: "Alto" }, windS: 15, gust: 20, windDir: 280, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 1.1, period: 8, waveEnergy: 95, currents: { speed: 1.6, ripRisk: "Alto" }, windS: 18, gust: 24, windDir: 285, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 1.2, period: 8, waveEnergy: 110, currents: { speed: 1.8, ripRisk: "Alto" }, windS: 20, gust: 26, windDir: 285, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 1.0, period: 8, waveEnergy: 80, currents: { speed: 1.5, ripRisk: "Alto" }, windS: 16, gust: 22, windDir: 280, uv: 2, rain: 0, weather: 'cloudy' },
        ]
      }
    ]
  },
  malagueta: {
    name: "La Malagueta, Málaga",
    days: [
      {
        date: "Hoy (Terral)", score: 85, bestTime: "09:00", worstTime: "16:00",
        tides: { high: "14:15 (0.6m)", low: "08:10 (0.2m)", coef: 45 }, temps: { air: 25, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 5, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 15, windDir: 315, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.1, period: 3, waveEnergy: 8, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 18, windDir: 315, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 15, gust: 22, windDir: 320, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.2, period: 4, waveEnergy: 18, currents: { speed: 0.3, ripRisk: "Bajo" }, windS: 17, gust: 25, windDir: 320, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.1, period: 3, waveEnergy: 10, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 12, gust: 18, windDir: 315, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Mañana (Terral)", score: 88, bestTime: "08:00", worstTime: "16:00",
        tides: { high: "15:00 (0.6m)", low: "09:00 (0.2m)", coef: 50 }, temps: { air: 24, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 4, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 8, gust: 12, windDir: 310, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.1, period: 3, waveEnergy: 6, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 15, windDir: 310, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 12, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 14, gust: 20, windDir: 315, uv: 9, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.2, period: 4, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 16, gust: 22, windDir: 315, uv: 7, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.1, period: 3, waveEnergy: 8, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 16, windDir: 310, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Pasado Mañana", score: 92, bestTime: "09:00", worstTime: "16:00",
        tides: { high: "15:45 (0.7m)", low: "09:45 (0.2m)", coef: 55 }, temps: { air: 23, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 4, currents: { speed: 0.0, ripRisk: "Nulo" }, windS: 5, gust: 8, windDir: 180, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 0.2, period: 3, waveEnergy: 8, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 8, gust: 12, windDir: 190, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 12, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 15, windDir: 200, uv: 9, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 4, waveEnergy: 18, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 12, gust: 16, windDir: 210, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 3, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 8, gust: 12, windDir: 200, uv: 2, rain: 0, weather: 'sunny' },
        ]
      }
    ]
  },
  misericordia: {
    name: "La Misericordia, Málaga",
    days: [
      {
        date: "Hoy (Terral)", score: 82, bestTime: "08:00", worstTime: "17:00",
        tides: { high: "14:20 (0.6m)", low: "08:15 (0.2m)", coef: 45 }, temps: { air: 25, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 6, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 16, windDir: 310, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.2, period: 4, waveEnergy: 12, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 14, gust: 20, windDir: 310, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 18, currents: { speed: 0.3, ripRisk: "Bajo" }, windS: 18, gust: 25, windDir: 315, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 4, waveEnergy: 25, currents: { speed: 0.4, ripRisk: "Bajo" }, windS: 20, gust: 28, windDir: 315, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 4, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 14, gust: 20, windDir: 310, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Mañana (Terral)", score: 85, bestTime: "07:00", worstTime: "16:00",
        tides: { high: "15:05 (0.6m)", low: "09:05 (0.2m)", coef: 50 }, temps: { air: 24, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 5, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 14, windDir: 310, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.2, period: 4, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 18, windDir: 310, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 16, gust: 22, windDir: 315, uv: 9, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.2, period: 4, waveEnergy: 18, currents: { speed: 0.3, ripRisk: "Bajo" }, windS: 18, gust: 24, windDir: 315, uv: 7, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.1, period: 3, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 18, windDir: 310, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        date: "Pasado Mañana", score: 90, bestTime: "08:00", worstTime: "16:00",
        tides: { high: "15:50 (0.7m)", low: "09:50 (0.2m)", coef: 55 }, temps: { air: 23, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 4, currents: { speed: 0.0, ripRisk: "Nulo" }, windS: 5, gust: 8, windDir: 170, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 0.2, period: 3, waveEnergy: 8, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 8, gust: 12, windDir: 180, uv: 4, rain: 0, weather: 'cloudy' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 14, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 14, windDir: 190, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 4, waveEnergy: 20, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 12, gust: 18, windDir: 200, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 3, waveEnergy: 12, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 8, gust: 12, windDir: 190, uv: 2, rain: 0, weather: 'sunny' },
        ]
      }
    ]
  }
};

// --- 2. COMPONENTES DE UTILIDAD Y UI ---

const getWeatherIcon = (condition) => {
  switch (condition) {
    case 'sunny': return <Sun className="text-yellow-400 w-6 h-6" />;
    case 'cloudy': return <Cloud className="text-slate-400 w-6 h-6" />;
    case 'rainy': return <CloudRain className="text-blue-400 w-6 h-6" />;
    default: return <Sun className="text-yellow-400 w-6 h-6" />;
  }
};

const getScoreColors = (score) => {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', label: 'Nado Seguro y Plácido' };
  if (score >= 50) return { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', label: 'Precaución (Corrientes/Viento)' };
  return { text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Peligro / Bandera Roja' };
};

const DynamicArrow = ({ degree, type = 'wind' }) => {
  const colorClass = type === 'wind' ? 'text-slate-300' : 'text-cyan-400';
  return (
    <div className="flex items-center gap-1 justify-center">
      <ArrowUp 
        className={`w-4 h-4 transition-transform duration-500 ${colorClass}`} 
        style={{ transform: `rotate(${degree}deg)` }} 
      />
      <span className="text-xs text-slate-400">{degree}°</span>
    </div>
  );
};

// --- GEMINI API HELPER ---
const apiKey = ""; 
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const fetchWithRetry = async (url, options, retries = 5) => {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(delay);
      delay *= 2;
    }
  }
};

// --- 3. COMPONENTE PRINCIPAL (APP) ---
export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('malagueta');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // Estados ampliados para las nuevas funciones de IA
  const [aiSummaries, setAiSummaries] = useState({
    seguridad: '',
    entrenamiento: '',
    equipamiento: ''
  });
  const [activeAiTab, setActiveAiTab] = useState('seguridad');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  const beachData = MOCK_DATA[selectedBeach];
  const currentDay = beachData.days[selectedDayIdx];
  const scoreVisuals = getScoreColors(currentDay.score);

  useEffect(() => {
    // Resetear todas las memorias de la IA cuando cambia la playa o el día
    setAiSummaries({ seguridad: '', entrenamiento: '', equipamiento: '' });
    setActiveAiTab('seguridad');
    setAiError('');
  }, [selectedBeach, selectedDayIdx]);

  const handleGenerateAI = async (type) => {
    setActiveAiTab(type);
    
    // Si ya tenemos el resumen generado para esta pestaña y día, no volvemos a llamar a la API
    if (aiSummaries[type]) return;

    setIsGeneratingAI(true);
    setAiError('');
    
    let prompt = "";
    
    if (type === 'seguridad') {
      prompt = `Actúa como un experto entrenador de natación en aguas abiertas y salvamento marítimo. Playa: ${beachData.name}, Día: "${currentDay.date}". 
      Escribe un resumen breve (máx 3 párrafos). Debes:
      1. Destacar la viabilidad del nado basándote en el "score" (${currentDay.score}/100, donde >80 es excelente y <50 peligroso).
      2. Analizar energía de olas (kJ) y riesgo de corrientes para advertir peligros.
      3. Indicar la mejor hora para nadar según las tablas.
      Datos: ${JSON.stringify(currentDay)}`;
    } 
    else if (type === 'entrenamiento') {
      prompt = `Actúa como un entrenador olímpico de aguas abiertas. Diseña una sesión de entrenamiento específica para la playa ${beachData.name} el día "${currentDay.date}".
      Condiciones: Score de viabilidad ${currentDay.score}/100.
      Reglas estrictas:
      - Si el score es menor a 50, recomienda obligatoriamente un entrenamiento FÍSICO EN SECO (en la arena) detallando 3 ejercicios, argumentando que el mar está peligroso.
      - Si el score es mayor a 50, diseña un entrenamiento EN EL AGUA (Calentamiento, Bloque Principal, Vuelta a la calma). Adapta los ejercicios de técnica (ej. avistamiento, respiración bilateral) a la corriente y oleaje del día.
      Formato: Uso de emojis y listas, máximo 3 párrafos.
      Datos completos: ${JSON.stringify(currentDay)}`;
    }
    else if (type === 'equipamiento') {
      const maxGust = Math.max(...currentDay.hourly.map(h => h.gust));
      const maxUv = Math.max(...currentDay.hourly.map(h => h.uv));
      prompt = `Actúa como un asesor técnico de material de natación. Para nadar en ${beachData.name} el día "${currentDay.date}", haz una lista del equipo OBLIGATORIO Y RECOMENDADO.
      Condiciones clave de hoy: Temp Agua: ${currentDay.temps.water}ºC, Temp Aire: ${currentDay.temps.air}ºC, Rachas max: ${maxGust}kts, UV max: ${maxUv}.
      Debes incluir:
      - Grosor sugerido del neopreno (o bañador si el agua supera los 22ºC).
      - Tipo de lente para las gafas (espejadas/polarizadas si hace sol, transparentes si está nublado).
      - Complementos de seguridad (boya, gorro térmico, escarpines, crema solar).
      Formato: Lista de viñetas con emojis, tono motivador, directo al grano.`;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Eres un asistente de élite especializado en natación en aguas abiertas." }] }
      };
      
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setAiSummaries(prev => ({
          ...prev,
          [type]: text.replace(/\*/g, '') // Limpieza básica de Markdown
        }));
      } else {
        throw new Error("Respuesta de IA vacía");
      }
    } catch (err) {
      console.error(err);
      setAiError("La inteligencia artificial está descansando. Por favor, inténtalo de nuevo en unos minutos.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12 selection:bg-cyan-500/30">
      
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Waves className="w-8 h-8" />
            <h1 className="text-xl font-black tracking-tight text-white">
              OpenWater<span className="text-cyan-400">Forecast</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={selectedBeach}
                onChange={(e) => { setSelectedBeach(e.target.value); setSelectedDayIdx(0); }}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none appearance-none cursor-pointer"
              >
                {Object.keys(MOCK_DATA).map(key => (
                  <option key={key} value={key}>{MOCK_DATA[key].name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {beachData.days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayIdx(idx)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                ${selectedDayIdx === idx 
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <Calendar className="w-4 h-4" />
              {day.date}
            </button>
          ))}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className={`md:col-span-4 rounded-2xl border ${scoreVisuals.border} ${scoreVisuals.bg} p-6 flex flex-col items-center justify-center relative overflow-hidden`}>
            <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-80">
              <Activity className={`w-4 h-4 ${scoreVisuals.text}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Viabilidad de Nado</span>
            </div>
            
            <div className="mt-6 flex items-baseline gap-1">
              <span className={`text-7xl font-black tracking-tighter ${scoreVisuals.text}`}>
                {currentDay.score}
              </span>
              <span className="text-xl text-slate-400 font-bold">/100</span>
            </div>
            
            <div className={`mt-2 px-4 py-1 rounded-full border ${scoreVisuals.border} bg-slate-900/50 backdrop-blur-sm`}>
              <span className={`text-sm font-bold ${scoreVisuals.text}`}>{scoreVisuals.label}</span>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col justify-center">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><Sun className="w-5 h-5 text-emerald-400" /></div>
                    <span className="text-sm font-medium text-slate-300">Mejor Hora</span>
                  </div>
                  <span className="text-xl font-bold text-white">{currentDay.bestTime}</span>
                </div>
                <div className="h-px w-full bg-slate-700/50"></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-rose-500" /></div>
                    <span className="text-sm font-medium text-slate-300">Peor Hora</span>
                  </div>
                  <span className="text-xl font-bold text-white">{currentDay.worstTime}</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 grid grid-rows-2 gap-4">
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Thermometer className="w-6 h-6 text-orange-400" />
                  <div>
                    <p className="text-xs text-slate-400">Temperaturas</p>
                    <p className="text-sm font-bold text-white">
                      Aire {currentDay.temps.air}° <span className="text-slate-600">|</span> Agua {currentDay.temps.water}°
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Droplets className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400">Mareas (Coef: <span className="text-cyan-400">{currentDay.tides.coef}</span>)</p>
                    <p className="text-sm font-bold text-white text-xs mt-0.5">
                      🔺 {currentDay.tides.high} <span className="text-slate-600">|</span> 🔻 {currentDay.tides.low}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN IA: Centro de Mando */}
        <section className="bg-gradient-to-r from-indigo-900 via-slate-800 to-slate-900 rounded-2xl border border-indigo-500/30 overflow-hidden shadow-xl shadow-indigo-900/20 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="p-6 md:p-8 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                  Centro de Mando IA
                </h2>
                <p className="text-sm text-indigo-200 mt-1">
                  Tu equipo virtual: Socorrista, Entrenador y Asesor Técnico.
                </p>
              </div>
            </div>

            {/* Pestañas de Selección de IA */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button 
                onClick={() => handleGenerateAI('seguridad')}
                disabled={isGeneratingAI && activeAiTab !== 'seguridad'}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 
                  ${activeAiTab === 'seguridad' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}
              >
                <ShieldCheck className="w-4 h-4" /> Resumen Seguridad
              </button>
              <button 
                onClick={() => handleGenerateAI('entrenamiento')}
                disabled={isGeneratingAI && activeAiTab !== 'entrenamiento'}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 
                  ${activeAiTab === 'entrenamiento' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}
              >
                <Dumbbell className="w-4 h-4" /> ✨ Entrenador
              </button>
              <button 
                onClick={() => handleGenerateAI('equipamiento')}
                disabled={isGeneratingAI && activeAiTab !== 'equipamiento'}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 
                  ${activeAiTab === 'equipamiento' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}
              >
                <Briefcase className="w-4 h-4" /> ✨ Equipamiento
              </button>
            </div>

            {/* Estado de Carga o Error */}
            {isGeneratingAI && (
              <div className="flex items-center gap-3 text-indigo-300 bg-indigo-900/40 p-4 rounded-xl border border-indigo-500/20 mb-4 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">El experto está analizando las condiciones del mar...</span>
              </div>
            )}

            {aiError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> {aiError}
              </div>
            )}

            {/* Contenedor del Resumen */}
            {aiSummaries[activeAiTab] && !isGeneratingAI && (
              <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700 p-6 rounded-xl text-slate-200 text-sm md:text-base leading-relaxed space-y-4">
                {aiSummaries[activeAiTab].split('\n').map((paragraph, i) => (
                  paragraph.trim() && <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
            
            {!aiSummaries[activeAiTab] && !isGeneratingAI && !aiError && (
              <div className="bg-slate-900/30 border border-slate-700/50 border-dashed p-6 rounded-xl text-slate-400 text-sm text-center flex flex-col items-center justify-center">
                <Bot className="w-8 h-8 mb-2 opacity-50" />
                <p>Haz clic en la pestaña actual para generar este análisis con IA.</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Desglose Horario de Nado
            </h2>
            <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full">Desliza para ver más →</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Hora</th>
                  <th className="px-6 py-4 font-semibold text-center">Clima</th>
                  <th className="px-6 py-4 font-semibold text-center border-l border-slate-700 bg-cyan-950/20">Olas (m)</th>
                  <th className="px-6 py-4 font-semibold text-center bg-cyan-950/20">Energía (kJ)</th>
                  <th className="px-6 py-4 font-semibold text-center bg-cyan-950/20">Corriente / Resaca</th>
                  <th className="px-6 py-4 font-semibold text-center border-l border-slate-700 bg-slate-700/20">Viento (kts)</th>
                  <th className="px-6 py-4 font-semibold text-center bg-slate-700/20">Rachas</th>
                  <th className="px-6 py-4 font-semibold text-center border-l border-slate-700">Lluvia</th>
                  <th className="px-6 py-4 font-semibold text-center">UV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {currentDay.hourly.map((hour, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {hour.time}
                      {hour.time === currentDay.bestTime && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
                      {hour.time === currentDay.worstTime && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>}
                    </td>
                    <td className="px-6 py-4 text-center flex justify-center">
                      {getWeatherIcon(hour.weather)}
                    </td>
                    <td className={`px-6 py-4 text-center border-l border-slate-700 font-bold bg-cyan-950/10 
                      ${hour.swellH < 0.5 ? 'text-emerald-400' : hour.swellH > 1.0 ? 'text-rose-500' : 'text-amber-400'}`}>
                      {hour.swellH.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-center font-medium bg-cyan-950/10">
                      <div className="flex items-center justify-center gap-1">
                        <Zap className={`w-4 h-4 ${hour.waveEnergy > 100 ? 'text-rose-500' : 'text-amber-400'}`} />
                        <span className={hour.waveEnergy > 100 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {hour.waveEnergy}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center bg-cyan-950/10">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-200">{hour.currents.speed} m/s</span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mt-1
                          ${hour.currents.ripRisk === 'Alto' ? 'bg-rose-500/20 text-rose-400' : 
                            hour.currents.ripRisk === 'Medio' ? 'bg-amber-500/20 text-amber-400' : 
                            'bg-emerald-500/20 text-emerald-400'}`}>
                          Riesgo {hour.currents.ripRisk}
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-center border-l border-slate-700 font-bold bg-slate-800/40
                      ${hour.windS > 15 ? 'text-amber-400' : 'text-emerald-400'} 
                      ${hour.windS > 25 ? 'text-rose-400' : ''}`}>
                      {hour.windS}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400 bg-slate-800/40">
                      {hour.gust}
                    </td>
                    <td className="px-6 py-4 text-center border-l border-slate-700 text-blue-300">
                      <div className="flex items-center justify-center gap-1">
                        <Umbrella className="w-3 h-3 opacity-50" />
                        {hour.rain}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-orange-300 font-medium">
                      {hour.uv}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

