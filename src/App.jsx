import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  MapPin, 
  Calendar, 
  Navigation,
  Sparkles,
  Bot,
  Loader2,
  AlertTriangle,
  Sun,
  Cloud,
  CloudRain,
  Activity,
  Thermometer,
  Droplets
} from 'lucide-react';

// --- 1. SIMULACIÓN DE DATOS (MOCK DATA) - ENFOCADO EN MÁLAGA ---
const MOCK_DATA = {
  misericordia: {
    name: "La Misericordia, Málaga",
    days: [
      {
        score: 82, bestTime: "08:00", worstTime: "17:00",
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
        score: 85, bestTime: "07:00", worstTime: "16:00",
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
        score: 90, bestTime: "08:00", worstTime: "16:00",
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
  },
  malagueta: {
    name: "La Malagueta, Málaga",
    days: [
      {
        score: 85, bestTime: "09:00", worstTime: "16:00",
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
        score: 88, bestTime: "08:00", worstTime: "16:00",
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
        score: 92, bestTime: "09:00", worstTime: "16:00",
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
  bajondillo: {
    name: "El Bajondillo, Torremolinos",
    days: [
      {
        score: 80, bestTime: "08:00", worstTime: "15:00",
        tides: { high: "14:10 (0.6m)", low: "08:00 (0.2m)", coef: 45 }, temps: { air: 24, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.2, period: 4, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 14, gust: 18, windDir: 300, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.2, period: 4, waveEnergy: 14, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 16, gust: 22, windDir: 300, uv: 6, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.3, period: 4, waveEnergy: 20, currents: { speed: 0.3, ripRisk: "Bajo" }, windS: 20, gust: 26, windDir: 310, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 4, waveEnergy: 22, currents: { speed: 0.4, ripRisk: "Bajo" }, windS: 22, gust: 30, windDir: 310, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 4, waveEnergy: 16, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 16, gust: 22, windDir: 300, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        score: 82, bestTime: "08:00", worstTime: "16:00",
        tides: { high: "14:55 (0.6m)", low: "08:50 (0.2m)", coef: 50 }, temps: { air: 23, water: 15 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 8, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 16, windDir: 300, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.2, period: 4, waveEnergy: 12, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 14, gust: 18, windDir: 305, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.2, period: 4, waveEnergy: 16, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 18, gust: 24, windDir: 310, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.2, period: 4, waveEnergy: 18, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 18, gust: 26, windDir: 310, uv: 7, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.1, period: 3, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 14, gust: 20, windDir: 300, uv: 2, rain: 0, weather: 'sunny' },
        ]
      },
      {
        score: 88, bestTime: "09:00", worstTime: "16:00",
        tides: { high: "15:40 (0.7m)", low: "09:40 (0.2m)", coef: 55 }, temps: { air: 22, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.1, period: 3, waveEnergy: 5, currents: { speed: 0.0, ripRisk: "Nulo" }, windS: 6, gust: 10, windDir: 180, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 0.2, period: 3, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 14, windDir: 190, uv: 4, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.3, period: 4, waveEnergy: 15, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 12, gust: 18, windDir: 200, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 4, waveEnergy: 20, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 14, gust: 20, windDir: 210, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 3, waveEnergy: 12, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 10, gust: 15, windDir: 200, uv: 2, rain: 0, weather: 'sunny' },
        ]
      }
    ]
  },
  burriana: {
    name: "Burriana, Nerja",
    days: [
      {
        score: 75, bestTime: "10:00", worstTime: "18:00",
        tides: { high: "14:30 (0.5m)", low: "08:20 (0.2m)", coef: 45 }, temps: { air: 22, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.3, period: 5, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 8, gust: 12, windDir: 90, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 0.3, period: 5, waveEnergy: 18, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 10, gust: 15, windDir: 95, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.4, period: 5, waveEnergy: 25, currents: { speed: 0.3, ripRisk: "Medio" }, windS: 14, gust: 20, windDir: 100, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.5, period: 6, waveEnergy: 35, currents: { speed: 0.4, ripRisk: "Medio" }, windS: 16, gust: 24, windDir: 100, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.4, period: 5, waveEnergy: 28, currents: { speed: 0.3, ripRisk: "Medio" }, windS: 14, gust: 20, windDir: 95, uv: 2, rain: 0, weather: 'cloudy' },
        ]
      },
      {
        score: 72, bestTime: "08:00", worstTime: "17:00",
        tides: { high: "15:15 (0.5m)", low: "09:10 (0.2m)", coef: 50 }, temps: { air: 23, water: 16 },
        hourly: [
          { time: "07:00", swellH: 0.3, period: 5, waveEnergy: 18, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 10, gust: 14, windDir: 95, uv: 1, rain: 0, weather: 'cloudy' },
          { time: "10:00", swellH: 0.4, period: 5, waveEnergy: 24, currents: { speed: 0.3, ripRisk: "Medio" }, windS: 12, gust: 18, windDir: 100, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.5, period: 6, waveEnergy: 32, currents: { speed: 0.4, ripRisk: "Medio" }, windS: 16, gust: 22, windDir: 105, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.6, period: 6, waveEnergy: 42, currents: { speed: 0.5, ripRisk: "Medio" }, windS: 18, gust: 26, windDir: 105, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.5, period: 5, waveEnergy: 30, currents: { speed: 0.3, ripRisk: "Medio" }, windS: 14, gust: 20, windDir: 100, uv: 2, rain: 0, weather: 'cloudy' },
        ]
      },
      {
        score: 80, bestTime: "09:00", worstTime: "16:00",
        tides: { high: "16:00 (0.6m)", low: "10:00 (0.2m)", coef: 55 }, temps: { air: 24, water: 17 },
        hourly: [
          { time: "07:00", swellH: 0.2, period: 4, waveEnergy: 10, currents: { speed: 0.1, ripRisk: "Nulo" }, windS: 6, gust: 10, windDir: 120, uv: 1, rain: 0, weather: 'sunny' },
          { time: "10:00", swellH: 0.2, period: 4, waveEnergy: 15, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 10, gust: 14, windDir: 125, uv: 5, rain: 0, weather: 'sunny' },
          { time: "13:00", swellH: 0.3, period: 5, waveEnergy: 20, currents: { speed: 0.2, ripRisk: "Bajo" }, windS: 12, gust: 18, windDir: 130, uv: 8, rain: 0, weather: 'sunny' },
          { time: "16:00", swellH: 0.3, period: 5, waveEnergy: 25, currents: { speed: 0.3, ripRisk: "Bajo" }, windS: 14, gust: 20, windDir: 135, uv: 6, rain: 0, weather: 'sunny' },
          { time: "19:00", swellH: 0.2, period: 4, waveEnergy: 14, currents: { speed: 0.2, ripRisk: "Nulo" }, windS: 10, gust: 16, windDir: 125, uv: 2, rain: 0, weather: 'sunny' },
        ]
      }
    ]
  }
};

// --- 2. FUNCIONES DE UTILIDAD ---

const getWindDirection = (degrees) => {
  if (degrees >= 337.5 || degrees < 22.5) return 'N';
  if (degrees >= 22.5 && degrees < 67.5) return 'NE';
  if (degrees >= 67.5 && degrees < 112.5) return 'E';
  if (degrees >= 112.5 && degrees < 157.5) return 'SE';
  if (degrees >= 157.5 && degrees < 202.5) return 'S';
  if (degrees >= 202.5 && degrees < 247.5) return 'SW';
  if (degrees >= 247.5 && degrees < 292.5) return 'W';
  if (degrees >= 292.5 && degrees < 337.5) return 'NW';
  return '-';
};

const getFormattedDates = () => {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const day = targetDate.getDate();
    const month = targetDate.toLocaleString('es-ES', { month: 'short' });
    dates.push(`${day} ${month}`);
  }
  return dates;
};

// Componente para pintar el icono del clima
const WeatherIcon = ({ weather }) => {
  switch(weather) {
    case 'sunny': return <Sun className="w-5 h-5 text-amber-500" />;
    case 'cloudy': return <Cloud className="w-5 h-5 text-slate-400" />;
    case 'rainy': return <CloudRain className="w-5 h-5 text-blue-400" />;
    default: return <Sun className="w-5 h-5 text-amber-500" />;
  }
};

// Lógica de puntuación visual para Nadadores
const getScoreColors = (score) => {
  if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Nado Seguro y Plácido' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Precaución (Corrientes/Viento)' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Peligro / Bandera Roja' };
};

// Configuración de Gemini API
const apiKey = ""; // API Key proveída por el entorno
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

// --- 3. COMPONENTE PRINCIPAL ---
export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  const beachData = MOCK_DATA[selectedBeach];
  const dayData = beachData.days[selectedDayIndex] || beachData.days[0];
  const formattedDates = getFormattedDates();
  const labels = ['Hoy', 'Mañana', 'Pasado'];
  
  const scoreVisuals = getScoreColors(dayData.score);

  useEffect(() => {
    setAiSummary('');
    setAiError('');
  }, [selectedBeach, selectedDayIndex]);

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    setAiError('');
    
    const prompt = `Actúa como un experto entrenador de natación en aguas abiertas y salvamento marítimo de Málaga. Analiza los siguientes datos para la playa ${beachData.name} durante el día de la previsión. 
    
    Escribe un consejo directo, amigable y conversacional (máximo 2 párrafos) dirigido a nadadores de aguas abiertas. Debes:
    1. Destacar la viabilidad del entrenamiento basándote en la "score" (${dayData.score}/100).
    2. Mencionar los contrastes entre la temperatura del aire y del agua, recomendando o no el neopreno.
    3. Advertir sobre oleaje o corrientes solo si son peligrosas.
    
    Datos a analizar: ${JSON.stringify(dayData)}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Eres un asistente meteorológico y deportivo experto, breve y al grano." }] }
      };
      
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setAiSummary(text.replace(/\*/g, ''));
      } else {
        throw new Error("Respuesta vacía");
      }
    } catch (err) {
      console.error(err);
      setAiError("No se ha podido contactar con el experto en este momento. Inténtalo más tarde.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera y Selección de Playa */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white">
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">OpenWater Forecast</h1>
              <p className="text-slate-500 text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Costa de Málaga
              </p>
            </div>
          </div>
          <select 
            value={selectedBeach}
            onChange={(e) => {
              setSelectedBeach(e.target.value);
              setSelectedDayIndex(0); 
            }}
            className="w-full md:w-auto p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {Object.entries(MOCK_DATA).map(([key, data]) => (
              <option key={key} value={key}>{data.name}</option>
            ))}
          </select>
        </div>

        {/* Selección de Día */}
        <div className="flex space-x-2 md:space-x-4">
          {labels.map((label, index) => (
            <button
              key={index}
              onClick={() => setSelectedDayIndex(index)}
              disabled={!beachData.days[index]}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${
                selectedDayIndex === index 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-2 border-blue-600' 
                  : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {selectedDayIndex === index && <Calendar className="w-4 h-4 opacity-80" />}
                {label}
              </div>
              <span className={`text-xs ${selectedDayIndex === index ? 'text-blue-100' : 'text-slate-400'}`}>
                {formattedDates[index]}
              </span>
            </button>
          ))}
        </div>

        {/* --- SECCIÓN 1: DE UN VISTAZO (Score y Resumen Diario) --- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className={`md:col-span-4 rounded-2xl border ${scoreVisuals.border} ${scoreVisuals.bg} p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-sm`}>
            <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-80">
              <Activity className={`w-4 h-4 ${scoreVisuals.text}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Viabilidad de Nado</span>
            </div>
            
            <div className="mt-6 flex items-baseline gap-1">
              <span className={`text-7xl font-black tracking-tighter ${scoreVisuals.text}`}>
                {dayData.score}
              </span>
              <span className="text-xl text-slate-500 font-bold">/100</span>
            </div>
            
            <div className={`mt-2 px-4 py-1 rounded-full border ${scoreVisuals.border} bg-white/60 backdrop-blur-sm`}>
              <span className={`text-sm font-bold ${scoreVisuals.text}`}>{scoreVisuals.label}</span>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-5 border border-slate-200 flex flex-col justify-center shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100"><Sun className="w-5 h-5 text-emerald-500" /></div>
                    <span className="text-sm font-medium text-slate-600">Mejor Hora</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{dayData.bestTime}</span>
                </div>
                <div className="h-px w-full bg-slate-100"></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-50 rounded-lg border border-rose-100"><AlertTriangle className="w-5 h-5 text-rose-500" /></div>
                    <span className="text-sm font-medium text-slate-600">Peor Hora</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{dayData.worstTime}</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 grid grid-rows-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <Thermometer className="w-6 h-6 text-orange-500" />
                  <div>
                    <p className="text-xs text-slate-500">Temperaturas</p>
                    <p className="text-sm font-bold text-slate-900">
                      Aire {dayData.temps.air}° <span className="text-slate-300">|</span> Agua {dayData.temps.water}°
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-4 border border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <Droplets className="w-6 h-6 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500">Mareas (Coef: <span className="text-blue-600">{dayData.tides.coef}</span>)</p>
                    <p className="text-sm font-bold text-slate-900 text-xs mt-0.5">
                      🔺 {dayData.tides.high} <span className="text-slate-300">|</span> 🔻 {dayData.tides.low}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de la IA */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Bot className="w-24 h-24 text-indigo-600" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-indigo-900 text-lg">Consejo Experto</h3>
              </div>
              {!aiSummary && !isGeneratingAI && (
                <button 
                  onClick={handleGenerateAI}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-md flex items-center gap-2"
                >
                  Analizar Viabilidad
                </button>
              )}
            </div>

            {isGeneratingAI && (
              <div className="flex items-center gap-3 text-indigo-700 bg-white/60 p-4 rounded-xl border border-indigo-200 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Analizando mar, viento y corrientes...</span>
              </div>
            )}

            {aiError && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2 border border-red-200">
                <AlertTriangle className="w-5 h-5" /> {aiError}
              </div>
            )}

            {aiSummary && !isGeneratingAI && (
              <div className="bg-white p-5 rounded-xl text-sm md:text-base text-slate-700 leading-relaxed border border-white shadow-sm space-y-3">
                {aiSummary.split('\n').map((paragraph, i) => (
                  paragraph.trim() && <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
            {!aiSummary && !isGeneratingAI && !aiError && (
              <p className="text-slate-500 text-sm mt-2">
                Pulsa el botón para generar una recomendación personalizada basada en las previsiones de hoy y la temperatura del agua.
              </p>
            )}
          </div>
        </div>

        {/* --- Desglose Horario con TODA la información --- */}
        <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <Navigation className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-lg">Desglose Horario Completo</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[800px]">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs">Hora</th>
                  <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs text-center">Clima</th>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs">Olas</th>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs text-center">Energía</th>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs">Corrientes</th>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs bg-slate-100/50">Viento (kts)</th>
                  <th className="px-5 py-4 font-semibold uppercase tracking-wider text-xs bg-slate-100/50">Dir. Viento</th>
                  <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs text-center">UV</th>
                  <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs text-center">Lluvia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayData.hourly.map((hour, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    {/* Hora */}
                    <td className="px-5 py-4 font-bold text-slate-900">{hour.time}</td>
                    
                    {/* Clima */}
                    <td className="px-4 py-4 text-center flex justify-center">
                      <WeatherIcon weather={hour.weather} />
                    </td>

                    {/* Olas */}
                    <td className="px-5 py-4">
                      <span className="font-semibold text-blue-700">{hour.swellH}m</span> 
                      <span className="text-slate-500 text-xs ml-1">({hour.period}s)</span>
                    </td>

                    {/* Energía */}
                    <td className="px-5 py-4 text-center">
                      <span className={`font-medium px-2.5 py-1 rounded-full text-xs
                        ${hour.waveEnergy > 30 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {hour.waveEnergy} kJ
                      </span>
                    </td>

                    {/* Corrientes */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{hour.currents.speed} m/s</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider mt-0.5
                          ${hour.currents.ripRisk === 'Alto' ? 'text-red-500' 
                          : hour.currents.ripRisk === 'Medio' ? 'text-amber-500' 
                          : 'text-emerald-500'}`}>
                          Riesgo {hour.currents.ripRisk}
                        </span>
                      </div>
                    </td>

                    {/* Viento */}
                    <td className="px-5 py-4 bg-slate-50/30">
                      <span className="font-semibold">{hour.windS}</span>
                      <span className="text-slate-400 text-xs ml-1">r: {hour.gust}</span>
                    </td>

                    {/* Dirección Viento */}
                    <td className="px-5 py-4 bg-slate-50/30">
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <span className="w-6 inline-block text-center">{getWindDirection(hour.windDir)}</span>
                        <span className="text-xs font-normal text-slate-400">({hour.windDir}º)</span>
                      </div>
                    </td>

                    {/* UV */}
                    <td className="px-4 py-4 text-center">
                      <span className={`font-semibold ${hour.uv > 5 ? 'text-orange-500' : 'text-slate-600'}`}>
                        {hour.uv}
                      </span>
                    </td>

                    {/* Lluvia */}
                    <td className="px-4 py-4 text-center">
                      <span className="text-blue-600 font-medium">{hour.rain}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
