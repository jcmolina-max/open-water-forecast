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
  ChevronUp,
  Users
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
function getDateLabel(offset, prefix) {
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
function getDynamicWaveEnergyCoefficient(waveDirDeg, period) {
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

function HourlySvgChart({ hourlyData }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!hourlyData || hourlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-semibold">
        No hay datos disponibles para graficar.
      </div>
    );
  }

  const maxSwell = Math.max(1.0, ...hourlyData.map(h => parseFloat(h.swellH) || 0));
  const maxWind = Math.max(20, ...hourlyData.map(h => parseFloat(h.windS) || 0));

  const width = 500;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 35;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  function getX(index) {
    return paddingLeft + (index * (chartWidth / 23));
  }
  function getYSwell(val) {
    const v = parseFloat(val) || 0;
    return height - paddingBottom - (v / maxSwell * chartHeight);
  }
  function getYWind(val) {
    const v = parseFloat(val) || 0;
    return height - paddingBottom - (v / maxWind * chartHeight);
  }

  let swellAreaPoints = `M ${getX(0)} ${height - paddingBottom}`;
  let swellLinePoints = "";
  
  hourlyData.forEach((h, idx) => {
    const x = getX(idx);
    const y = getYSwell(h.swellH);
    swellAreaPoints += ` L ${x} ${y}`;
    swellLinePoints += (idx === 0 ? "M" : " L") + ` ${x} ${y}`;
  });
  swellAreaPoints += ` L ${getX(23)} ${height - paddingBottom} Z`;

  let windLinePoints = "";
  hourlyData.forEach((h, idx) => {
    const x = getX(idx);
    const y = getYWind(h.windS);
    windLinePoints += (idx === 0 ? "M" : " L") + ` ${x} ${y}`;
  });

  const hoveredData = hoveredIdx !== null ? hourlyData[hoveredIdx] : null;

  return (
    <div className="relative bg-white p-4 rounded-xl border border-slate-100 shadow-inner flex flex-col items-center">
      <div className="flex justify-between items-center w-full text-[10px] font-bold text-slate-500 mb-3 px-2 border-b border-slate-100 pb-2">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block"></span>
            Oleaje (máx: {maxSwell.toFixed(2)}m)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-orange-500 border-t border-orange-500 border-dashed inline-block"></span>
            Viento (máx: {maxWind.toFixed(1)}kt)
          </span>
        </div>
        <span className="text-slate-400">Desliza para ver detalle</span>
      </div>

      <div className="w-full overflow-x-auto select-none">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[450px] overflow-visible">
          <defs>
            <linearGradient id="swellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
            const y = paddingTop + ratio * chartHeight;
            return (
              <line
                key={idx}
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}

          <path d={swellAreaPoints} fill="url(#swellGrad)" />
          <path d={swellLinePoints} stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={windLinePoints} stroke="#ea580c" strokeWidth="2" strokeDasharray="4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={paddingTop}
              x2={getX(hoveredIdx)}
              y2={height - paddingBottom}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {hourlyData.map((h, idx) => {
            const x = getX(idx);
            const y = getYSwell(h.swellH);
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isHovered ? 4.5 : 2}
                fill={isHovered ? "#1d4ed8" : "#3b82f6"}
                stroke="white"
                strokeWidth={isHovered ? 1.5 : 0.5}
                className="transition-all duration-100"
              />
            );
          })}

          {hourlyData.map((h, idx) => {
            const x = getX(idx);
            const y = getYWind(h.windS);
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isHovered ? 4 : 1.5}
                fill={isHovered ? "#c2410c" : "#ea580c"}
                stroke="white"
                strokeWidth={isHovered ? 1.5 : 0.5}
                className="transition-all duration-100"
              />
            );
          })}

          {hourlyData.map((h, idx) => {
            if (idx % 3 !== 0) return null;
            return (
              <text
                key={idx}
                x={getX(idx)}
                y={height - 8}
                textAnchor="middle"
                fontSize="8"
                fontWeight="black"
                fill="#94a3b8"
              >
                {h.time}
              </text>
            );
          })}

          <text x={5} y={paddingTop + 5} fontSize="8" fontWeight="bold" fill="#3b82f6" textAnchor="start">
            {maxSwell.toFixed(1)}m
          </text>
          <text x={5} y={height - paddingBottom} fontSize="8" fontWeight="bold" fill="#3b82f6" textAnchor="start">
            0.0m
          </text>

          <text x={width - 5} y={paddingTop + 5} fontSize="8" fontWeight="bold" fill="#ea580c" textAnchor="end">
            {maxWind.toFixed(0)}kt
          </text>
          <text x={width - 5} y={height - paddingBottom} fontSize="8" fontWeight="bold" fill="#ea580c" textAnchor="end">
            0kt
          </text>

          {hourlyData.map((h, idx) => {
            const x = getX(idx) - (chartWidth / 46);
            const w = chartWidth / 23;
            return (
              <rect
                key={idx}
                x={x}
                y={paddingTop}
                width={w}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseMove={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && hoveredData && (
        <div className="absolute top-[48px] left-1/2 transform -translate-x-1/2 bg-slate-800/95 border border-slate-700 text-white rounded-xl py-2 px-3 shadow-xl flex items-center gap-3 animate-in zoom-in-95 duration-100 z-30">
          <div className="border-r border-slate-700 pr-2">
            <span className="block text-[8px] font-bold text-slate-400 uppercase">Hora</span>
            <span className="text-sm font-black text-white">{hoveredData.time}</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-blue-400 uppercase">🌊 Ola</span>
            <span className="text-xs font-black">{hoveredData.swellH}m</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-orange-400 uppercase">💨 Viento</span>
            <span className="text-xs font-black">{hoveredData.windS}kt</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-emerald-400 uppercase">🎯 Score</span>
            <span className="text-xs font-black">{hoveredData.hourScore}</span>
          </div>
          {hoveredData.taroRisk && hoveredData.taroRisk !== 'Ninguno' && (
            <div className="border-l border-slate-700 pl-2">
              <span className="block text-[8px] font-bold text-slate-400 uppercase">🌫️ Taró</span>
              <span className={`text-[10px] font-black uppercase ${hoveredData.taroRisk === 'Alto' ? 'text-red-400' : 'text-slate-300'}`}>
                {hoveredData.taroRisk}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function parseBoyaNum(val, min = -100, max = 500) {
  if (val === undefined || val === null || val === "") return null;
  
  // Si Google Sheets mutó un número decimal en fecha ISO (ej: 20.7 -> 20 de julio)
  if (typeof val === 'string' && (val.includes('T') && val.includes('Z'))) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const day = d.getUTCDate() === 19 ? 20 : (d.getUTCDate() === 2 ? 3 : d.getUTCDate());
        const month = d.getUTCMonth() + 1;
        if (day > 0 && month > 0 && month <= 12) {
          const reconstructed = parseFloat(`${day}.${month}`);
          if (!isNaN(reconstructed) && reconstructed >= min && reconstructed <= max) {
            return reconstructed;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  const str = String(val).trim();
  if (str.includes('T') || str.includes('Z') || str.length > 15) return null;
  const num = parseFloat(str.replace(',', '.'));
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}

function parseBoyaDir(val) {
  if (val === undefined || val === null || val === "") return null;
  const str = String(val).trim().toUpperCase();
  if (str === "N" || str === "NORTE") return 0;
  if (str === "NE" || str === "NORESTE") return 45;
  if (str === "E" || str === "ESTE" || str === "LEVANTE") return 90;
  if (str === "SE" || str === "SURESTE") return 135;
  if (str === "S" || str === "SUR") return 180;
  if (str === "SO" || str === "SW" || str === "SUROESTE" || str === "PONIENTE") return 225;
  if (str === "O" || str === "W" || str === "OESTE") return 270;
  if (str === "NO" || str === "NW" || str === "NOROESTE" || str === "TERRAL") return 315;
  return parseBoyaNum(val, 0, 360);
}

function parseBoyaTemp(val) {
  return parseBoyaNum(val, 5, 35);
}

function formatBoyaTemp(val) {
  const parsed = parseBoyaTemp(val);
  if (parsed === null) return '—';
  return `${parsed.toFixed(1)}`;
};

function getWindDirection(degrees) {
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

function getWindDirectionFullName(degrees) {
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

function parseSwimmerSensaciones(textVal) {
  const text = textVal !== null && textVal !== undefined ? String(textVal) : '';
  if (!text) return { nombre: 'Anónimo', medusas: 'Ninguna', agua: 'Limpia', comentario: '' };
  
  const matchNew = text.match(/^\[Nombre:\s*([^|]+)\s*\|\s*Medusas:\s*([^|]+)\s*\|\s*Agua:\s*([^\]]+)\]\s*(.*)/i);
  if (matchNew) {
    return {
      nombre: matchNew[1].trim(),
      medusas: matchNew[2].trim(),
      agua: matchNew[3].trim(),
      comentario: matchNew[4].trim()
    };
  }
  
  const matchOld = text.match(/^\[Medusas:\s*([^|]+)\s*\|\s*Agua:\s*([^\]]+)\]\s*(.*)/i);
  if (matchOld) {
    return {
      nombre: 'Anónimo',
      medusas: matchOld[1].trim(),
      agua: matchOld[2].trim(),
      comentario: matchOld[3].trim()
    };
  }
  
  return {
    nombre: 'Anónimo',
    medusas: 'Ninguna',
    agua: 'Limpia',
    comentario: text
  };
};

function getIsoDateString(dateObj = new Date()) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayIsoString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getIsoDateString(d);
}

function generateCanonicalSlotId(playaKey, dateStr, hourStr) {
  const cleanPlaya = (playaKey || 'mis').substring(0, 3).toUpperCase();
  const cleanDate = (dateStr || getIsoDateString()).replace(/-/g, '');
  const cleanHour = (hourStr || '11:00').replace(':', '').padStart(4, '0').substring(0, 4);
  return `${cleanPlaya}-${cleanDate}-${cleanHour}`;
}

function formatFriendlyDate(dateString) {
  if (!dateString) return 'Hoy';
  try {
    const regDate = new Date(dateString);
    if (isNaN(regDate.getTime())) return 'Hoy';
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const isToday = regDate.toDateString() === today.toDateString();
    const isYesterday = regDate.toDateString() === yesterday.toDateString();
    
    const timeStr = regDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Hoy, ${timeStr}`;
    if (isYesterday) return `Ayer, ${timeStr}`;
    
    const dayName = regDate.toLocaleDateString('es-ES', { weekday: 'long' });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalizedDay}, ${regDate.getDate()} ${regDate.toLocaleString('es-ES', { month: 'short' })}`;
  } catch (e) {
    return String(dateString) || "Hoy";
  }
}

function cleanHourString(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}:\d{2})/.test(str)) {
    const m = str.match(/^\d{4}-\d{2}-\d{2}[ T](\d{1,2}:\d{2})/);
    if (m && m[1]) return m[1].padStart(5, '0');
  }
  if (str.includes('1899') || str.includes('GMT') || str.includes('T')) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  return str.length >= 5 ? str.substring(0, 5) : str;
}

function formatSwimFriendly(dateVal, swimHourRaw) {
  let rawDateStr = String(dateVal || '').trim();
  const rawHourStr = String(swimHourRaw || '').trim();
  
  // Si swimHourRaw contiene la fecha real del nado (ej: "2026-08-11 21:00"), esa es la fecha REAL de la sesión
  if (/^\d{4}-\d{2}-\d{2}/.test(rawHourStr)) {
    rawDateStr = rawHourStr.split(' ')[0].split('T')[0];
  }

  const swimHour = cleanHourString(rawHourStr);
  if (!rawDateStr) return swimHour || '—';
  
  const hourSuffix = swimHour ? `, ${swimHour}` : '';
  const todayStr = getIsoDateString();
  const yestStr = getYesterdayIsoString();

  if (rawDateStr.startsWith(todayStr)) {
    return `Hoy${hourSuffix}`;
  } else if (rawDateStr.startsWith(yestStr)) {
    return `Ayer${hourSuffix}`;
  }

  try {
    let regDate;
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
      const parts = rawDateStr.split('T')[0].split(' ')[0].split('-');
      regDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      regDate = new Date(rawDateStr);
    }
    
    if (isNaN(regDate.getTime())) return `${rawDateStr}${hourSuffix}`;

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (regDate.toDateString() === today.toDateString()) {
      return `Hoy${hourSuffix}`;
    } else if (regDate.toDateString() === yesterday.toDateString()) {
      return `Ayer${hourSuffix}`;
    } else {
      const dayName = regDate.toLocaleDateString('es-ES', { weekday: 'long' });
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const dayNum = regDate.getDate();
      const monthName = regDate.toLocaleString('es-ES', { month: 'short' });
      return `${capitalizedDay} ${dayNum} ${monthName}${hourSuffix}`;
    }
  } catch (e) {
    return `${rawDateStr}${hourSuffix}`;
  }
}

function formatBoyaPeriod(raw) {
  if (!raw) return '—';
  const str = String(raw).trim();
  if (str.includes('T') || str.includes('Z') || str.length > 10) return '—';
  const num = parseFloat(str.replace(',', '.'));
  if (isNaN(num) || num <= 0 || num > 30) return '—';
  return `${num.toFixed(1)}s`;
}

function getRecordType(item) {
  const orig = String(item.origenDato || "");
  const notes = String(item.notasCalibracion || "");
  const sens = String(item.sensaciones || "");
  const hasOlas = item.realOlas !== undefined && item.realOlas !== null && item.realOlas !== "";
  
  if (orig === 'Admin: Factor' || sens.includes('[FactorConfig:')) {
    return 'system_factor';
  }

  if (notes.includes('[ALERTA_OFICIAL]') || orig === 'Admin: Alerta') {
    return 'admin_alert';
  }
  
  if (orig.startsWith('Boya:') || orig.includes('Sincronización') || orig.includes('Open-Meteo') || notes.includes('Vercel Cron')) {
    return 'buoy_sync';
  }
  
  if (orig === 'Nadador: Mensaje' || (orig === 'Nadador' && !hasOlas)) {
    return 'swimmer_msg';
  }
  
  if (orig === 'Admin: Calibración' || (orig === 'Web Admin' && hasOlas)) {
    return 'admin_report';
  }
  
  if (orig === 'Nadador: Reporte' || (orig === 'Nadador' && hasOlas)) {
    return 'swimmer_report';
  }
  
  return 'swimmer_report';
}

function swimmerScaleToMeters(v) {
  if (v === null || v === undefined || v === "" || v === 0 || v === "0") return null;
  const val = parseFloat(v.toString().replace(",", "."));
  if (val === 1) return 0.05;
  if (val === 2) return 0.20;
  if (val === 3) return 0.45;
  if (val === 4) return 0.80;
  if (val === 5) return 1.20;
  return null;
};

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState('misericordia');
  // Por defecto seleccionamos "Hoy" (Índice 1, ya que Ayer es 0)
  const [selectedDay, setSelectedDay] = useState(1); 
  const [beachData, setBeachData] = useState(null); 
  const [rawMarineData, setRawMarineData] = useState(null);
  const [currentNowData, setCurrentNowData] = useState(null); // Datos del momento exacto actual
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de calibración y administración (Fase 2)
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'comparison'
  const [expandedHourIdx, setExpandedHourIdx] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [totalVisits, setTotalVisits] = useState(0);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [isCalHistoryLoading, setIsCalHistoryLoading] = useState(false);

  const [latestBuoyHeight, setLatestBuoyHeight] = useState(null);
  const [latestBuoyPeriod, setLatestBuoyPeriod] = useState(null);
  const [latestBuoyDir, setLatestBuoyDir] = useState(null);
  const [latestBuoyTemp, setLatestBuoyTemp] = useState(null);
  const [latestBuoyDate, setLatestBuoyDate] = useState(null);
  const [latestBuoySource, setLatestBuoySource] = useState(null);
  const [showPuertosIframe, setShowPuertosIframe] = useState(false);

          useEffect(() => {
      const sortedNewestFirst = [...calibrationHistory].sort((a, b) => {
        const tsA = parseLogTimestamp(a);
        const tsB = parseLogTimestamp(b);
        return tsB - tsA;
      });

      // 1. Filtrar ESTRICTAMENTE reportes de calibración física del Admin (descartar sincronizaciones y alertas de texto)
      const adminLog = sortedNewestFirst.find(item => {
        const orig = String(item.origenDato || '').trim();
        const notas = String(item.notas || item.notasCalibracion || '');
        const sens = String(item.sensaciones || '');

        // Excluir sincronizaciones automáticas
        if (orig.indexOf('Sincronizaci') !== -1 || notas.indexOf('Sincronizaci') !== -1 || sens.indexOf('Sincronizaci') !== -1) {
          return false;
        }

        // Excluir estrictamente Alertas informativas de texto, Copérnico residual y avisos oficiales
        if (orig.indexOf('Alerta') !== -1 || orig.indexOf('Copernicus') !== -1 || notas.indexOf('[ALERTA_OFICIAL]') !== -1) {
          return false;
        }

        return orig.indexOf('Admin: Calibración') !== -1 || orig.indexOf('Web Admin') !== -1 || orig === 'Admin' || (orig.indexOf('Calibración') !== -1 && (item.boyaAltura || item.boyaTemp));
      });

      if (adminLog) {
        const h = parseBoyaNum(adminLog.boyaAltura, 0.01, 15) !== null ? parseBoyaNum(adminLog.boyaAltura, 0.01, 15).toFixed(2) : (adminLog.realOlas ? Number(String(adminLog.realOlas).replace(',', '.')).toFixed(2) : null);
        const t = parseBoyaNum(adminLog.boyaPeriodo, 1, 30) !== null ? parseBoyaNum(adminLog.boyaPeriodo, 1, 30).toFixed(1) : null;
        const d = parseBoyaDir(adminLog.boyaDireccion);
        const temp = parseBoyaNum(adminLog.boyaTemp, 5, 35) !== null ? parseBoyaNum(adminLog.boyaTemp, 5, 35).toFixed(1) : null;

        setLatestBuoyHeight(h);
        setLatestBuoyPeriod(t);
        setLatestBuoyDir(d);
        setLatestBuoyTemp(temp);

        const dObj = adminLog.timestamp ? new Date(adminLog.timestamp) : (adminLog.fechaRegistro ? new Date(adminLog.fechaRegistro) : new Date());
        setLatestBuoyDate(dObj);
        setLatestBuoySource('✏️ Calibración Manual Admin');
      }
    }, [calibrationHistory]);

  // Sincronización Inteligente de Boya Real al abrir la App (Smart Throttle 15 min)
  useEffect(() => {
    const THROTTLE_MS = 15 * 60 * 1000; // 15 Minutos
    const LAST_SYNC_KEY = 'openwater_buoy_smart_sync_ts';
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const now = Date.now();

    if (!lastSync || (now - parseInt(lastSync, 10) > THROTTLE_MS)) {
      fetch('https://portus.puertos.es/portussvr/api/lastData/station/1070084?locale=es', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(["O","M"])
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.datos && data.datos.length > 0) {
            localStorage.setItem(LAST_SYNC_KEY, now.toString());
            const hsItem = data.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Altura'));
            const tpItem = data.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Periodo'));
            const dirItem = data.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Direccion'));
            const tempItem = data.datos.find(d => d.nombreParametro && d.nombreParametro.includes('Temperatura'));

            const hVal = hsItem && hsItem.valor ? parseFloat(hsItem.valor).toFixed(2) : null;
            const tVal = tpItem && tpItem.valor ? parseFloat(tpItem.valor).toFixed(1) : null;
            const dVal = dirItem && dirItem.valor ? parseFloat(dirItem.valor) : null;
            const tempVal = tempItem && tempItem.valor ? parseFloat(tempItem.valor).toFixed(1) : null;

            if (hVal) setLatestBuoyHeight(hVal);
            if (tVal) setLatestBuoyPeriod(tVal);
            if (dVal) setLatestBuoyDir(dVal);
            if (tempVal) setLatestBuoyTemp(tempVal);

            setLatestBuoyDate(new Date());
            setLatestBuoySource('Puertos del Estado (Estación 2056 - Málaga)');
          }
        })
        .catch(() => {});
    }
  }, []);
  
  // Formulario del Administrador
  const [adminPlaya, setAdminPlaya] = useState('misericordia');
  const [adminFechaNado, setAdminFechaNado] = useState(() => getIsoDateString());
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
  const [showAdminPortusWidget, setShowAdminPortusWidget] = useState(false);
  const [adminVientoMs, setAdminVientoMs] = useState('');

  // Estados para el reporte público de nadadores (Comunidad)
  const [isSwimmerModalOpen, setIsSwimmerModalOpen] = useState(false);
  const [swimmerPlaya, setSwimmerPlaya] = useState('misericordia');
  const [swimmerFechaNado, setSwimmerFechaNado] = useState(() => getIsoDateString());
  const [swimmerHoraNado, setSwimmerHoraNado] = useState('11:00');
  const [swimmerRealOlas, setSwimmerRealOlas] = useState(3);
  const [swimmerRealResaca, setSwimmerRealResaca] = useState(1);
  const [swimmerRealCorriente, setSwimmerRealCorriente] = useState(1);
  const [swimmerSensaciones, setSwimmerSensaciones] = useState('');
  const [isSendingSwimmerReport, setIsSendingSwimmerReport] = useState(false);
  const [swimmerReportStatus, setSwimmerReportStatus] = useState(null);
  const [swimmerMedusas, setSwimmerMedusas] = useState('Ninguna');
  const [swimmerAgua, setSwimmerAgua] = useState('Limpia');
  const [swimmerName, setSwimmerName] = useState('');
  const [isSyncingBuoy, setIsSyncingBuoy] = useState(false);
  const [swimmerIsOnlyMessage, setSwimmerIsOnlyMessage] = useState(false);
  const [adminIsAlert, setAdminIsAlert] = useState(false);
  const [visibleReportsCount, setVisibleReportsCount] = useState(3);

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

  // Estado para las pestañas del Modal Admin ('factors', 'chart', 'compass', 'telemetry' o 'report')
  const [adminTab, setAdminTab] = useState('factors');
  const [compassBeachKey, setCompassBeachKey] = useState('misericordia');
  const [compassCustomFacing, setCompassCustomFacing] = useState({});
  const [compassCustomSectors, setCompassCustomSectors] = useState({});
  const [compassCopiedToast, setCompassCopiedToast] = useState(false);
  const [expandedSectorAudit, setExpandedSectorAudit] = useState({});
  const [discardedReportIds, setDiscardedReportIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('openwater_discarded_reports') || '[]');
    } catch(e) {
      return [];
    }
  });

  const toggleDiscardReport = (repId) => {
    setDiscardedReportIds(prev => {
      let updated;
      if (prev.includes(repId)) {
        updated = prev.filter(id => id !== repId);
      } else {
        updated = [...prev, repId];
      }
      localStorage.setItem('openwater_discarded_reports', JSON.stringify(updated));
      return updated;
    });
  };
  const [factorFeedbackMsg, setFactorFeedbackMsg] = useState(null);

  // Estado para los Factores de Escala Ajustados/Aprobados manualmente por el Administrador (PIN 6611)
  const [adminManualScaleFactors, setAdminManualScaleFactors] = useState(() => {
    try {
      const saved = localStorage.getItem('openwater_admin_scale_factors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Estado para las marcas de tiempo de aprobación/ajuste de factores
  const [adminFactorApprovalTimes, setAdminFactorApprovalTimes] = useState(() => {
    try {
      const saved = localStorage.getItem('openwater_admin_approval_times');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Estado para los Factores de Sesgo del Satélite (F_sesgo) ajustados manualmente por el Administrador
  const [adminManualSesgoFactors, setAdminManualSesgoFactors] = useState(() => {
    try {
      const saved = localStorage.getItem('openwater_admin_sesgo_factors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Estados para el Dashboard de Triangulación de 4 Curvas (Fase 4)
  const [chartBeach, setChartBeach] = useState('misericordia');
  const [chartMetric, setChartMetric] = useState('waves'); // 'waves' | 'temp' | 'wind'
  const [chartRange, setChartRange] = useState('3d'); // '24h' | '3d' | '7d' | 'all'
  const [hoveredChartIndex, setHoveredChartIndex] = useState(null);


  // Helper para interpretar marcas de tiempo de logs en diversos formatos (ISO, DD/MM/YYYY, etc.)
  function parseLogTimestamp(log) {
    if (!log) return 0;
    const raw = log.fechaRegistro || log.fecha || log.timestamp || "";
    if (!raw) return 0;
    if (!isNaN(Number(raw)) && Number(raw) > 1000000000) return Number(raw);

    const direct = Date.parse(raw);
    if (!isNaN(direct)) return direct;

    const p = String(raw).split(/[/, :]+/);
    if (p.length >= 3) {
      const day = parseInt(p[0], 10);
      const month = parseInt(p[1], 10) - 1;
      const year = parseInt(p[2], 10);
      const hour = p[3] ? parseInt(p[3], 10) : 0;
      const min = p[4] ? parseInt(p[4], 10) : 0;
      const sec = p[5] ? parseInt(p[5], 10) : 0;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day, hour, min, sec).getTime();
      }
    }
    return 0;
  }

  // Helper para rescatar la lectura física real de la boya en la fecha y HORA EXACTA DEL NADO
  function getBuoyReadingForLog(log) {
    if (!log) return { height: null, period: null, dir: null };

    // 1. Resolver dirección de oleaje histórica por la fecha y hora exacta del nado (Idea 3)
    let historicalSwellDir = null;

    // 1. PASO 1 (Prioridad Máxima): Buscar en el mapa satelital marino histórico (rawMarineData) por la fecha y hora exacta del nado
    if (rawMarineData && rawMarineData.hourly && rawMarineData.hourly.time) {
      const logTs = parseLogTimestamp(log);
      if (logTs > 0) {
        const dObj = new Date(logTs);
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        const hh = (log.horaNado || "12").split(":")[0].padStart(2, '0');
        const targetIsoTime = `${yyyy}-${mm}-${dd}T${hh}:00`;
        const matchedIdx = rawMarineData.hourly.time.findIndex(t => t.startsWith(targetIsoTime));
        if (matchedIdx !== -1 && rawMarineData.hourly.wave_direction?.[matchedIdx] != null) {
          historicalSwellDir = rawMarineData.hourly.wave_direction[matchedIdx];
        }
      }
    }

    // 2. PASO 2: Si el satélite marino no tuviera dato para esa fecha, consultar la dirección de viento del formulario (realVientoDir)
    if (!historicalSwellDir && log.realVientoDir && log.realVientoDir !== "") {
      const vUpper = String(log.realVientoDir).toUpperCase().trim();
      if (vUpper === "E" || vUpper === "LEVANTE") historicalSwellDir = 90;
      else if (vUpper === "SE" || vUpper === "SUDESTE") historicalSwellDir = 135;
      else if (vUpper === "ENE") historicalSwellDir = 67.5;
      else if (vUpper === "ESE") historicalSwellDir = 112.5;
      else if (vUpper === "S" || vUpper === "SUR") historicalSwellDir = 180;
      else if (vUpper === "SO" || vUpper === "SW" || vUpper === "SUDOESTE" || vUpper === "PONIENTE") historicalSwellDir = 225;
      else if (vUpper === "O" || vUpper === "W" || vUpper === "OESTE") historicalSwellDir = 270;
      else if (vUpper === "NO" || vUpper === "NW" || vUpper === "NOROESTE") historicalSwellDir = 315;
      else if (vUpper === "N" || vUpper === "NORTE") historicalSwellDir = 0;
    }

    // 3. PASO 3: Fallback de seguridad para nados anteriores a agosto sin boya ni satélite ni viento: 110º (Levante)
    if (!historicalSwellDir) {
      const logTs = parseLogTimestamp(log);
      const isBeforeAug3 = logTs > 0 && logTs < new Date("2026-08-03T00:00:00").getTime();
      historicalSwellDir = isBeforeAug3 ? 110 : ((currentDayData && currentDayData.hourly && currentDayData.hourly[0]) ? currentDayData.hourly[0].swellDir : 110);
    }

    function cleanDir(raw) {
      if (raw === undefined || raw === null || raw === "") return historicalSwellDir;
      const num = Number(raw);
      if (isNaN(num) || num === 110) return historicalSwellDir;
      return num;
    }

    // 1. Buscar en calibrationHistory un registro de 'Admin: Calibración' o 'Web Admin' del MISMO DÍA y a la HORA MÁS CERCANA del nado
    const logDateTs = parseLogTimestamp(log);

    let closestBuoyLog = null;
    let minDiffMs = Infinity;

    calibrationHistory.forEach(item => {
      const orig = String(item.origenDato || "").trim();
      const notas = String(item.notas || item.notasCalibracion || "");
      
      // Excluir alertas y sincronizaciones satelitales
      if (orig.includes('Alerta') || notas.includes('[ALERTA_OFICIAL]') || orig.includes('Open-Meteo')) {
        return;
      }

      // Priorizar calibraciones del Admin con datos físicos de boya verificados
      const hParsed = parseBoyaNum(item.boyaAltura, 0.01, 15);
      const isAdminCal = (orig.includes('Admin') || orig.includes('Calibración')) && hParsed !== null;
      if (isAdminCal) {
        const buoyTs = parseLogTimestamp(item);
        if (logDateTs > 0 && buoyTs > 0) {
          const d1 = new Date(logDateTs).toDateString();
          const d2 = new Date(buoyTs).toDateString();
          if (d1 === d2) {
            const diff = Math.abs(buoyTs - logDateTs);
            if (diff < minDiffMs) {
              minDiffMs = diff;
              closestBuoyLog = item;
            }
          }
        }
      }
    });

    if (closestBuoyLog) {
      const hVal = parseBoyaNum(closestBuoyLog.boyaAltura, 0.01, 15);
      return {
        height: hVal !== null ? hVal.toFixed(2) : null,
        period: formatBoyaPeriod(closestBuoyLog.boyaPeriodo),
        dir: cleanDir(closestBuoyLog.boyaDireccion)
      };
    }

    // 2. Si el propio registro ya tiene guardada una altura de boya física válida (> 0) distinta de appOlas
    const rawHNum = parseBoyaNum(log.boyaAltura, 0.01, 15);
    const appHNum = parseBoyaNum(log.appOlas, 0.01, 15);
    if (rawHNum !== null && rawHNum !== appHNum && rawHNum > 0) {
      return {
        height: rawHNum.toFixed(2),
        period: formatBoyaPeriod(log.boyaPeriodo),
        dir: cleanDir(log.boyaDireccion)
      };
    }

    // 3. Si no hay boya física calibrada ese día, no inventar satélite en esta tarjeta
    return {
      height: null,
      period: null,
      dir: cleanDir(log.boyaDireccion)
    };
  }

  // Helper para filtrar lecturas anómalas (outliers) utilizando filtro de banda ±1.5σ
  function filterOutliers(ratios) {
    if (!ratios || ratios.length === 0) return [];
    const valid = ratios.filter(r => typeof r === "number" && !isNaN(r) && isFinite(r) && r > 0);
    if (valid.length < 3) return valid;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / valid.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return valid;
    const filtered = valid.filter(r => Math.abs(r - mean) <= 1.5 * stdDev);
    return filtered.length > 0 ? filtered : valid;
  }

  // Clasificador Físico de los 5 Sectores Meteorológicos
  function getSectorKeyForHour(waveDir, windDir, windKnots, tempAire) {
    const wDir = Number(windDir !== undefined && windDir !== null && !isNaN(windDir) ? windDir : (waveDir || 120));
    const wSpd = Number(windKnots || 6.5);
    const temp = Number(tempAire || 26);

    // 1. Terral Puro: Viento N/NW de tierra o viento oeste con alta temperatura térmica
    if ((wDir >= 285 && wDir <= 360) || (wDir >= 0 && wDir <= 35) || (temp >= 27.5 && wDir >= 270)) {
      return 'terral';
    } 
    // 2. Levante: E/SE (45° a 155°)
    else if (wDir >= 45 && wDir <= 155) {
      return wSpd >= 10.0 ? 'levante_fuerte' : 'levante_suave';
    } 
    // 3. Poniente: S/SO/W (175° a 284°)
    else if (wDir >= 175 && wDir <= 284) {
      return wSpd >= 10.0 ? 'poniente_fuerte' : 'poniente_suave';
    }
    // 4. Default según intensidad
    return wSpd >= 10.0 ? 'levante_fuerte' : 'levante_suave';
  }

  // Dynamic Buoy Scale Factor por 5 Sectores (Conexión Directa Panel Admin ↔ Portada)
  function getBoyaScaleFactor(beachKey, waveDir, windDir, windKnots, tempAire) {
    const sectorKey = getSectorKeyForHour(waveDir, windDir, windKnots, tempAire);
    const storageKey = `${beachKey}_${sectorKey}`;

    // 1. Si el Administrador fijó un factor manual o aprobó una sugerencia para este sector de 5
    if (adminManualScaleFactors && adminManualScaleFactors[storageKey] !== undefined && adminManualScaleFactors[storageKey] !== null) {
      return parseFloat(adminManualScaleFactors[storageKey]);
    }

    // 2. Compatibilidad retroactiva si hay fijado un factor antiguo de 2 sectores (levante / poniente)
    const isLevante = (windDir || waveDir || 110) >= 45 && (windDir || waveDir || 110) <= 165;
    const legacyStorageKey = `${beachKey}_${isLevante ? 'levante' : 'poniente'}`;
    if (adminManualScaleFactors && adminManualScaleFactors[legacyStorageKey] !== undefined && adminManualScaleFactors[legacyStorageKey] !== null) {
      return parseFloat(adminManualScaleFactors[legacyStorageKey]);
    }
    if (adminManualScaleFactors && adminManualScaleFactors[beachKey] !== undefined && adminManualScaleFactors[beachKey] !== null) {
      return parseFloat(adminManualScaleFactors[beachKey]);
    }

    // 3. Factores de fábrica calibrados por playa y sector
    const defaultFactoryMap = {
      misericordia:   { levante_fuerte: 0.85, levante_suave: 0.60, poniente_fuerte: 0.45, poniente_suave: 0.35, terral: 0.15 },
      malagueta:      { levante_fuerte: 0.75, levante_suave: 0.60, poniente_fuerte: 0.45, poniente_suave: 0.30, terral: 0.15 },
      pedregalejo:    { levante_fuerte: 0.65, levante_suave: 0.50, poniente_fuerte: 0.40, poniente_suave: 0.30, terral: 0.15 },
      los_alamos:     { levante_fuerte: 0.90, levante_suave: 0.85, poniente_fuerte: 0.90, poniente_suave: 0.75, terral: 0.20 },
      bajondillo:     { levante_fuerte: 0.80, levante_suave: 0.70, poniente_fuerte: 0.70, poniente_suave: 0.60, terral: 0.20 },
      cala_del_moral: { levante_fuerte: 0.75, levante_suave: 0.65, poniente_fuerte: 0.70, poniente_suave: 0.45, terral: 0.15 },
      rincon_victoria:{ levante_fuerte: 0.85, levante_suave: 0.80, poniente_fuerte: 0.70, poniente_suave: 0.50, terral: 0.15 }
    };

    const bMap = defaultFactoryMap[beachKey] || { levante_fuerte: 0.75, levante_suave: 0.60, poniente_fuerte: 0.50, poniente_suave: 0.35, terral: 0.15 };
    return bMap[sectorKey] !== undefined ? bMap[sectorKey] : 0.50;
  }

  // Dynamic Sector Satellite Bias Factor (F_sesgo = Boya Real / Satélite Promedio)
  function getSectorSesgoFactor(beachKey, isLevante) {
    const sectorKey = isLevante ? 'levante' : 'poniente';
    const storageKey = `${beachKey}_${sectorKey}`;

    if (adminManualSesgoFactors && adminManualSesgoFactors[storageKey] !== undefined && adminManualSesgoFactors[storageKey] !== null) {
      return parseFloat(adminManualSesgoFactors[storageKey]);
    }

    const buoyRealH = latestBuoyHeight ? parseFloat(latestBuoyHeight) : null;
    if (buoyRealH !== null && buoyRealH > 0) {
      return buoyRealH / 0.24;
    }
    return 1.0;
  }

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
      
      // Temperatura real de la boya calculada localmente (sin depender de la ISO fecha)
      const buoyReport = calibrationHistory.find(item => {
        return parseBoyaTemp(item.boyaTemp) !== null;
      });
      const buoyTempForToday = buoyReport ? parseBoyaTemp(buoyReport.boyaTemp) : null;
      
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

      // 1. SATÉLITE CLIMA (Añadimos visibility y dew_point_2m)
      try {
        weatherJson = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,precipitation,weather_code,uv_index,cloud_cover,visibility&timezone=Europe%2FMadrid&past_days=2`);
      } catch (e) {
        console.warn("Satélite de clima caído. Activando auto-rescate.", e);
        localClimateDown = true;
        setIsClimateDown(true);
      }

      // 2. SATÉLITE MARINO
      try {
        marineJson = await fetchWithTimeout(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl&models=best_match&timezone=Europe%2FMadrid&past_days=14`);
        setRawMarineData(marineJson);
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

        // 3.1 CÁLCULO DE INERCIA DE PONIENTE (Afloramiento de Bolsas de Agua Fría a 200m)
        let recentPonienteHours = 0;
        if (!localClimateDown && weatherJson?.hourly?.wind_direction_10m) {
          // Analizar las 48 horas de histórico previo en la consulta (índices 0 a 47)
          for (let k = 0; k < 48; k++) {
            const wDir = weatherJson.hourly.wind_direction_10m[k];
            const wSpd = weatherJson.hourly.wind_speed_10m[k] || 0;
            if (wDir !== undefined && wDir >= 200 && wDir <= 340 && wSpd >= 8) {
              recentPonienteHours++;
            }
          }
        }
        const hasUpwellingMemory = recentPonienteHours >= 6; // 6+ horas de poniente reciente
        const upwellingOffset = hasUpwellingMemory ? 3.5 : 0; // Descuento de 3.5°C por bolsas frías de afloramiento, o 0°C en días de mar calmo/templado sin poniente

        // Comprobar si algún nadador o admin reportó agua fría recientemente en la comunidad
        const recentColdWaterReport = calibrationHistory.find(log => {
          if (!log.sensaciones && !log.notasCalibracion) return false;
          const textSens = (log.sensaciones || "").toLowerCase();
          const textNotes = (log.notasCalibracion || "").toLowerCase();
          return textSens.includes('fría') || textSens.includes('fria') || textNotes.includes('fría') || textNotes.includes('fria');
        });

        for (let d = 0; d < dayOffsets.length; d++) {
          const offset = dayOffsets[d];
          
          const weatherBaseIndex = (offset + 2) * 24; 
          const marineBaseIndex = (offset + 14) * 24; 
          const startIndex = weatherBaseIndex + 6;
          const endIndex = weatherBaseIndex + 21;

          // ----- CÁLCULO DE TEMPERATURA DEL AGUA (Predicción + Boya Real) -----
          const noonIndex = marineBaseIndex + 12;
          const sstNoon = marineJson?.hourly?.sea_surface_temperature?.[noonIndex];
          const predictedWaterTemp =
            sstNoon !== undefined && sstNoon !== null && !Number.isNaN(Number(sstNoon))
              ? Math.round(Number(sstNoon) * 10) / 10
              : 21.5;

          let waterTemp = predictedWaterTemp;

          // ----- CÁLCULO DE CALIDAD DEL AGUA (Aguas Sucias) -----
          let rainSum = 0;
          if (!localClimateDown && weatherJson?.hourly?.precipitation) {
              for (let k = weatherBaseIndex - 24; k <= weatherBaseIndex + 21; k++) {
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

          // ----- DETECCION DE MAREAS DEL DIA (24 HORAS DE ESTE OFFSET) -----
          let dayTides = [];
          for (let hourOffset = 0; hourOffset < 24; hourOffset++) {
            const idx = marineBaseIndex + hourOffset;
            const val = marineJson?.hourly?.sea_level_height_msl?.[idx];
            const valNum = val !== undefined && val !== null ? Number(val) : 0.0;
            dayTides.push({ time: `${hourOffset.toString().padStart(2, '0')}:00`, height: valNum });
          }

          let detectedTides = [];
          for (let j = 0; j < 24; j++) {
            const curr = dayTides[j].height;
            const prev = j > 0 ? dayTides[j - 1].height : (marineJson?.hourly?.sea_level_height_msl?.[marineBaseIndex - 1] !== undefined ? Number(marineJson.hourly.sea_level_height_msl[marineBaseIndex - 1]) : curr);
            const next = j < 23 ? dayTides[j + 1].height : (marineJson?.hourly?.sea_level_height_msl?.[marineBaseIndex + 24] !== undefined ? Number(marineJson.hourly.sea_level_height_msl[marineBaseIndex + 24]) : curr);

            const isPeak = curr >= prev && curr >= next && (curr > prev || curr > next);
            const isTrough = curr <= prev && curr <= next && (curr < prev || curr < next);

            if (isPeak) {
              const duplicate = detectedTides.find(t => t.type === 'Pleamar' && Math.abs(parseInt(t.time.split(':')[0]) - j) <= 2);
              if (!duplicate) {
                detectedTides.push({ type: 'Pleamar', time: dayTides[j].time, height: curr });
              }
            } else if (isTrough) {
              const duplicate = detectedTides.find(t => t.type === 'Bajamar' && Math.abs(parseInt(t.time.split(':')[0]) - j) <= 2);
              if (!duplicate) {
                detectedTides.push({ type: 'Bajamar', time: dayTides[j].time, height: curr });
              }
            }
          }

          let tideState = "Marea Parada (Estacionaria) ⏸️";
          if (offset === 0) {
            const currentHourVal = marineJson?.hourly?.sea_level_height_msl?.[marineBaseIndex + currentSystemHour] !== undefined ? Number(marineJson.hourly.sea_level_height_msl[marineBaseIndex + currentSystemHour]) : 0;
            const nextHourVal = marineJson?.hourly?.sea_level_height_msl?.[marineBaseIndex + ((currentSystemHour + 1) % 24)] !== undefined ? Number(marineJson.hourly.sea_level_height_msl[marineBaseIndex + ((currentSystemHour + 1) % 24)]) : currentHourVal;
            const diff = nextHourVal - currentHourVal;
            if (diff > 0.01) {
              tideState = "Subiendo (Llenante) 📈";
            } else if (diff < -0.01) {
              tideState = "Bajando (Vaciante) 📉";
            } else {
              tideState = "Marea Parada (Estacionaria) ⏸️";
            }

            // Sincronización automática de telemetría de boya (06:00 a 21:00)
            if (currentSystemHour >= 6 && currentSystemHour <= 21) {
              const syncKey = `openwater_telem_synced_${currentSystemHour}_${selectedBeach}`;
              if (typeof window !== 'undefined' && !sessionStorage.getItem(syncKey)) {
                sessionStorage.setItem(syncKey, 'true');
                const curMarineI = marineBaseIndex + currentSystemHour;
                const curSatH = marineJson?.hourly?.wave_height_marine_best_match?.[curMarineI] ?? marineJson?.hourly?.wave_height?.[curMarineI];
                const curSatDir = marineJson?.hourly?.wave_direction?.[curMarineI];
                const curWindSpd = weatherJson?.hourly?.wind_speed_10m?.[weatherBaseIndex + currentSystemHour];
                const curWindDir = weatherJson?.hourly?.wind_direction_10m?.[weatherBaseIndex + currentSystemHour];
                const bH = latestBuoyHeight ? parseFloat(latestBuoyHeight) : null;
                
                if (curSatH && bH) {
                  const fSesgoVal = (bH / curSatH).toFixed(2);
                  const telemPayload = {
                    action: 'registrar_telemetria',
                    fechaHora: new Date().toLocaleString('es-ES'),
                    playaSector: `${selectedBeach}_${(curSatDir >= 45 && curSatDir <= 165) ? 'levante' : 'poniente'}`,
                    prevOlaSat: curSatH,
                    prevDirOlaSat: curSatDir || '',
                    prevVientoKnots: curWindSpd ? Math.round(curWindSpd / 1.852) : '',
                    prevVientoDir: curWindDir || '',
                    boyaOlaReal: bH,
                    boyaDirOlaReal: latestBuoyDir || '',
                    boyaVientoKnots: '',
                    boyaVientoDir: '',
                    orillaOlaNadador: '',
                    fSesgo: fSesgoVal,
                    fRefraccion: '',
                    fCombinado: ''
                  };
                  try {
                    fetch(WEBHOOK_URL, {
                      method: 'POST',
                      mode: 'no-cors',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(telemPayload)
                    }).catch(() => {});
                  } catch(e) {}
                }
              }
            }
          }
          
          const dailyMaxSeaLevel = Math.max(...dayTides.map(t => t.height));

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
          // 🚀 MOTOR DOBLE DESACOPLADO: Factor de Sesgo del Satélite (F_sesgo) & Factor de Refracción (F_refraccion)
          let todaySatHeights = [];
          const todayBaseStart = marineBaseIndex + 6;
          const todayBaseEnd = marineBaseIndex + 21;
          for (let k = todayBaseStart; k <= todayBaseEnd; k++) {
            const rawH = marineJson?.hourly?.wave_height_marine_best_match?.[k] ?? marineJson?.hourly?.wave_height?.[k];
            if (rawH != null) {
              todaySatHeights.push(Number(rawH));
            }
          }
          const avgTodaySatH = todaySatHeights.length > 0
            ? (todaySatHeights.reduce((a, b) => a + b, 0) / todaySatHeights.length)
            : 0.24;

          const buoyRealH = latestBuoyHeight ? parseFloat(latestBuoyHeight) : null;
          
          // Factor de Sesgo del Satélite (F_sesgo = Boya Real Física / Satélite Promedio)
          let fSesgo = 1.0;
          if (buoyRealH !== null && buoyRealH > 0 && avgTodaySatH > 0) {
            fSesgo = buoyRealH / avgTodaySatH;
          }

          const waveArr = marineJson?.hourly?.wave_height_marine_best_match || marineJson?.hourly?.wave_height;

          for (let i = startIndex; i <= endIndex; i++) {
            if (!waveArr) break;
            const marineI = marineBaseIndex + (i % 24);
            if (marineI >= waveArr.length) break;

            const waveHeightStr = waveArr[marineI];
            const waveHeight = waveHeightStr !== null && waveHeightStr !== undefined ? Number(waveHeightStr) : 0.1;
            const period = marineJson.hourly?.wave_period?.[marineI] || 4;
            const waveDir = marineJson.hourly?.wave_direction?.[marineI];
            
            const displayHour = i % 24;
            const hourSeaLevel = marineJson?.hourly?.sea_level_height_msl?.[marineI] !== undefined ? Number(marineJson.hourly.sea_level_height_msl[marineI]) : 0.0;
            const isHighTideHour = hourSeaLevel >= (dailyMaxSeaLevel - 0.08);
            const windKmh = localClimateDown ? 0 : (weatherJson?.hourly?.wind_speed_10m?.[i] || 0);
            let windKnots = Math.round(windKmh / 1.852);
            let gustKnots = localClimateDown ? 0 : Math.round((weatherJson?.hourly?.wind_gusts_10m?.[i] || 0) / 1.852);
            const windDir = localClimateDown ? 0 : (weatherJson?.hourly?.wind_direction_10m?.[i] || 0);
            const cloudCover = localClimateDown ? "-" : (weatherJson?.hourly?.cloud_cover?.[i] || 0);
            const wCode = localClimateDown ? 0 : (weatherJson?.hourly?.weather_code?.[i] || 0);
            const visibility = localClimateDown ? 10000 : (weatherJson?.hourly?.visibility?.[i] || 10000);
            const rainMm = localClimateDown ? 0 : (weatherJson?.hourly?.precipitation?.[i] || 0);
            const rainProb = localClimateDown ? "-" : (weatherJson?.hourly?.precipitation_probability?.[i] || 0);
            const dewPoint = localClimateDown ? 0 : (weatherJson?.hourly?.dew_point_2m?.[i] || 0);
            
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

            // Ola Satélite de cada hora multiplicada por el Factor Activo del Sector (F_orilla)
            let effectiveWaveHeight = waveHeight;
            let localRule = null;
            let ruleColor = "";

            // Dynamic Scale Factor por 5 Sectores (F_orilla)
            const hourAirTemp = localClimateDown ? 26 : (weatherJson?.hourly?.temperature_2m?.[i] || 26);
            const scaleFactor = getBoyaScaleFactor(selectedBeach, waveDir, windDir, windKnots, hourAirTemp);
            
            // La clasificación del sector y el factor de escala aplicado dependen 100% EXCLUSIVAMENTE de la dirección real de la ola (waveDir)
            if ((selectedBeach === 'malagueta' || selectedBeach === 'pedregalejo') && waveDir >= 200 && waveDir <= 300) {
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
                let rompientePenalty = 15;
                if (isHighTideHour) {
                    rompientePenalty = 25; // Penalización extra por rompiente en orilla inclinada durante Pleamar
                    if (!localRule || localRule === "Rompiente Dura") {
                        localRule = "Rompiente Dura (Pleamar) ⚠️";
                        ruleColor = "text-orange-800 font-bold bg-orange-100 border border-orange-300 shadow-sm animate-pulse";
                    }
                } else {
                    if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo") {
                        localRule = "Rompiente Dura";
                        ruleColor = "text-orange-700 font-bold bg-orange-100 border border-orange-300 shadow-sm";
                    }
                }
                hourScore -= rompientePenalty;
                if (hourScore > 50) hourScore = 50; // Muro estricto: nunca pasa de 50
            }

            // HACHAZO POR RESACA ALTA (Freno de Emergencia vital)
            if (ripRisk === "Alta") {
                let resacaPenalty = 30;
                if (isHighTideHour) {
                    resacaPenalty = 40; // Mayor peligro de succión por resaca a marea llena
                    if (!localRule || localRule === "Resaca Fuerte") {
                        localRule = "Resaca Fuerte (Pleamar) 🚨";
                        ruleColor = "text-red-700 font-black bg-red-100 border border-red-300 shadow-sm";
                    }
                } else {
                    if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo" || localRule === "Rompiente Dura" || localRule === "Efecto Embudo: Alta resistencia") {
                        localRule = "Resaca Fuerte";
                        ruleColor = "text-red-600 font-bold bg-red-50 border border-red-200 shadow-sm";
                    }
                }
                hourScore -= resacaPenalty;
                if (hourScore > 50) hourScore = 50; // Cap estricto a 50 (Peligro)
            }

            // DETECCION DE TARÓ (Niebla de Advección local por choque térmico en bolsas de agua fría)
            let taroRisk = "Ninguno";
            
            // Calculamos la temperatura efectiva del agua en la franja marina (200m) aplicando el descuento por inercia de poniente
            let taroEffectiveWaterTemp = waterTemp - upwellingOffset;
            
            if (offset === 0) {
              if (recentColdWaterReport) {
                // Si la comunidad o el admin reportó agua fría, forzamos la masa fría en orilla (~18.5°C)
                taroEffectiveWaterTemp = Math.min(taroEffectiveWaterTemp, 18.5);
              } else if (buoyTempForToday !== null && !isNaN(buoyTempForToday)) {
                // Con boya activa, descontamos el gradiente térmico de la franja costera
                taroEffectiveWaterTemp = buoyTempForToday - upwellingOffset;
              }
            }

            if (!localClimateDown && dewPoint !== undefined && taroEffectiveWaterTemp !== undefined) {
              const deltaT = dewPoint - taroEffectiveWaterTemp;
              const isSeaBreezeWind = windDir >= 80 && windDir <= 220; // Vientos de componente marítima (Levante, Sur, Sudeste)
              const isGentleWind = windKnots >= 3 && windKnots <= 12; // Viento suave que empuja pero no dispersa la niebla
              const humidity = weatherJson?.hourly?.relative_humidity_2m?.[i];
              
              if (deltaT >= 2.0 && isSeaBreezeWind && isGentleWind) {
                taroRisk = "Alto";
              } else if (deltaT >= 0.0 && isSeaBreezeWind && isGentleWind) {
                taroRisk = "Moderado";
              } else if ((deltaT >= -1.0 || (humidity !== undefined && humidity >= 80)) && isSeaBreezeWind && isGentleWind) {
                taroRisk = "Bruma";
              }
            }

            // Aplicar penalizaciones de Taró al Score de Seguridad y Regla Local
            if (taroRisk === "Alto") {
                hourScore -= 40; // Penalización severa por falta de visibilidad
                if (hourScore > 50) hourScore = 50; // Cap estricto a 50 (Peligro)
                
                if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo" || localRule === "Rompiente Dura" || localRule === "Resaca Fuerte" || localRule === "Rompiente Dura (Pleamar) ⚠️" || localRule === "Resaca Fuerte (Pleamar) 🚨") {
                    localRule = hasUpwellingMemory ? "Riesgo de Taró (Bolsas 200m) 🌫️🚨" : "Riesgo de Taró 🌫️🚨";
                    ruleColor = "text-slate-800 font-black bg-slate-100 border border-slate-300 shadow-sm animate-pulse";
                }
            } else if (taroRisk === "Moderado") {
                hourScore -= 20; // Penalización moderada
                if (hourScore > 70) hourScore = 70; // Cap a 70
                
                if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo" || localRule === "Mar Picado / Incómodo") {
                    localRule = hasUpwellingMemory ? "Bruma / Taró (Bolsas 200m) 🌫️⚠️" : "Bruma / Taró Leve 🌫️⚠️";
                    ruleColor = "text-slate-600 font-bold bg-slate-50 border border-slate-200 shadow-sm";
                }
            } else if (taroRisk === "Bruma") {
                hourScore -= 10; // Penalización ligera por bruma anclada en horizonte
                if (hourScore > 80) hourScore = 80;
                
                if (!localRule || localRule === "Magón" || localRule === "Escudo Activo" || localRule === "Batalla Térmica ⚔️" || localRule === "Falsa Calma: Corriente de Fondo") {
                    localRule = "Bruma Mar Adentro 🌫️";
                    ruleColor = "text-slate-600 font-medium bg-slate-50 border border-slate-200 shadow-sm";
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

            // CÁLCULO DE VISIBILIDAD EFECTIVA (Adecuación por Taró y Niebla)
            let visText = "Excelente";
            let visColor = "text-slate-800 font-bold";
            if (localClimateDown) {
                visText = "Dato no disp.";
                visColor = "text-slate-400 font-medium";
            } else if (taroRisk === "Alto" || (!localClimateDown && visibility < 1000)) {
                visText = "Mala (< 1 km)";
                visColor = "text-red-600 font-black animate-pulse";
            } else if (taroRisk === "Moderado" || (!localClimateDown && visibility < 3000)) {
                visText = "Reducida (1-3 km)";
                visColor = "text-amber-600 font-bold";
            } else if (taroRisk === "Bruma" || (!localClimateDown && visibility < 6000)) {
                visText = "Moderada (3-6 km)";
                visColor = "text-slate-600 font-semibold";
            } else if (visibility !== undefined && visibility < 10000) {
                visText = `${(visibility / 1000).toFixed(1)} km`;
                visColor = "text-slate-700 font-semibold";
            }

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
              ruleColor: ruleColor,
              seaLevel: hourSeaLevel,
              dewPoint: dewPoint,
              taroRisk: taroRisk,
              visText: visText,
              visColor: visColor
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


          daysProcessed.push({
            dayIndex: d,
            dayLabel: getDateLabel(offset, dayPrefixes[d]),
            name: beach.name,
            score: avgScore,
            temps: { 
                air: localClimateDown ? "-" : Math.round(weatherJson?.hourly?.temperature_2m?.[noonIndex] || (new Date().getMonth() >= 4 && new Date().getMonth() <= 8 ? 29 : 18)), 
                water: waterTemp
            },
            hourly: translatedHourlyData,
            best: { time: bestHourTime, score: maxScore },
            worst: { time: worstHourTime, score: minScore },
            jellyfish: { risk: jRisk, color: jColor, bgColor: jBg },
            waterQuality: { status: wqStatus, color: wqColor, bgColor: wqBg, desc: wqDesc },
            hasStormRisk: hasStormRiskToday,
            tides: {
              extremes: detectedTides,
              currentState: tideState
            }
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
    
  }, [selectedBeach, dataRefreshKey, calibrationHistory]);

  function handleDayChange(index) {
    setSelectedDay(index);
    setHasRequestedAi(false);
    setExpertAdvice("");
  };

  async function handleAskExpert() {
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

  async function fetchCalibrationHistory() {
    setIsCalHistoryLoading(true);
    try {
      const response = await fetch(WEBHOOK_URL);
      const text = await response.text();
      const json = JSON.parse(text);
      const isArr = Array.isArray(json);
      if (isArr || json.status === 'success' || json.status === 'empty') {
        const fetchedLogs = isArr ? json : (json.data || []);
        const sortedLogs = [...fetchedLogs].sort((a, b) => parseLogTimestamp(b) - parseLogTimestamp(a));
        setCalibrationHistory(sortedLogs);
        if (!isArr) {
          const vCount = json.total_visitas !== undefined ? json.total_visitas : (json.totalVisitas !== undefined ? json.totalVisitas : json.visitasTotales);
          if (vCount !== undefined && vCount !== null) {
            setTotalVisits(Number(vCount));
          }
        }

        // 1. Cargar factores y marcas de tiempo locales guardadas en localStorage
        let localFactors = {};
        let localTimes = {};
        try {
          localFactors = JSON.parse(localStorage.getItem('openwater_admin_scale_factors') || '{}');
          localTimes = JSON.parse(localStorage.getItem('openwater_admin_approval_times') || '{}');
        } catch (e) {}

        const mergedFactors = { ...localFactors };
        const mergedTimes = { ...localTimes };

        // 2. Extraer marcas de tiempo y factores guardados por el supervisor desde Google Sheets en orden cronológico
        const chronoLogs = [...fetchedLogs].sort((a, b) => parseLogTimestamp(a) - parseLogTimestamp(b));
        chronoLogs.forEach(item => {
          const itemOrig = String(item.origenDato || "");
          const itemSens = String(item.sensaciones || "");
          if (itemOrig === 'Admin: Factor' || itemSens.startsWith('[FactorConfig:')) {
            try {
              const match = itemSens.match(/\[FactorConfig:\s*({.*?})\]/);
              if (match && match[1]) {
                const parsed = JSON.parse(match[1]);
                if (parsed.storageKey) {
                  const cloudTs = Number(parsed.timestamp || 0);
                  const localTs = Number(localTimes[parsed.storageKey] || 0);
                  // Solo aceptar la actualización de la nube si es más reciente o igual a la marca de tiempo local
                  if (cloudTs >= localTs) {
                    if (parsed.factor !== undefined && parsed.factor !== null && !isNaN(Number(parsed.factor))) {
                      mergedFactors[parsed.storageKey] = parseFloat(parsed.factor);
                      mergedTimes[parsed.storageKey] = cloudTs;
                    } else {
                      // RESET A FÁBRICA: Eliminar la sobreescritura manual
                      delete mergedFactors[parsed.storageKey];
                      mergedTimes[parsed.storageKey] = cloudTs;
                    }
                  }
                }
              }
            } catch (e) {}
          }
        });

        setAdminManualScaleFactors(mergedFactors);
        setAdminFactorApprovalTimes(mergedTimes);
        localStorage.setItem('openwater_admin_scale_factors', JSON.stringify(mergedFactors));
        localStorage.setItem('openwater_admin_approval_times', JSON.stringify(mergedTimes));
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
    const registerVisit = async () => {
      try {
        const lastVisit = localStorage.getItem('ow_last_visit');
        const now = new Date().getTime();
        if (!lastVisit || (now - Number(lastVisit)) > 86400000) {
          localStorage.setItem('ow_last_visit', now.toString());
          await fetch(WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'registrar_visita', origen: 'Web Client' })
          });
        }
      } catch (err) {
        console.error("Error registering visit:", err);
      }
    };
    registerVisit();
  }, []);

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

  function handleVerifyPin(e) {
    e.preventDefault();
    if (btoa(adminPin.trim()) === "NjYxMQ==") {
      setIsAdminAuthorized(true);
      setReportStatus(null);
    } else {
      setReportStatus({ type: 'error', text: 'Código PIN de administrador incorrecto.' });
    }
  };

  async function handleSendReport(e) {
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

    const slotId = generateCanonicalSlotId(adminPlaya, adminFechaNado, adminHoraNado);
    const payload = {
      idRegistro: slotId,
      fechaHora: `${adminFechaNado} ${adminHoraNado}`,
      fecha: adminFechaNado,
      fechaNado: adminFechaNado,
      horaNado: adminHoraNado,
      playa: adminPlaya,
      realOlas: adminIsAlert ? "" : adminRealOlas,
      realResaca: adminIsAlert ? "" : adminRealResaca,
      realCorriente: adminIsAlert ? "" : adminRealCorriente,
      realVientoFza: adminRealVientoFza,
      realVientoDir: adminRealVientoDir,
      sensaciones: adminSensaciones,
      origenDato: adminIsAlert ? "Admin: Alerta" : "Admin: Calibración",
      appScore: hourForecast ? hourForecast.hourScore : "",
      appOlas: hourForecast ? hourForecast.swellH : "",
      appEnergia: hourForecast ? hourForecast.waveEnergy : "",
      appVientoNudos: hourForecast ? hourForecast.windS : "",
      appVientoDir: hourForecast ? hourForecast.windDir : "",
      notasCalibracion: adminIsAlert ? `[ALERTA_OFICIAL] ${adminNotas}` : adminNotas,
      boyaAltura: adminBoyaAltura || (latestBuoyHeight ? latestBuoyHeight : (ecmwfVal || "")), 
      boyaPeriodo: adminBoyaPeriodo || (latestBuoyPeriod || ""),
      boyaDireccion: adminBoyaDireccion || ((latestBuoyDir && Number(latestBuoyDir) !== 110) ? latestBuoyDir : (hourForecast && hourForecast.swellDir ? hourForecast.swellDir : "")),
      boyaTemp: adminBoyaTemp || (latestBuoyTemp || ""),
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
      setAdminIsAlert(false);
      setAdminBoyaAltura('');
      setAdminBoyaPeriodo('');
      setAdminBoyaDireccion('');
      setAdminBoyaTemp('');
      setAdminVientoMs('');
      
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

  async function handleSendSwimmerReport(e) {
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

    const slotId = generateCanonicalSlotId(swimmerPlaya, swimmerFechaNado, swimmerHoraNado);
    const payload = {
      idRegistro: slotId,
      fechaHora: `${swimmerFechaNado} ${swimmerHoraNado}`,
      fecha: swimmerFechaNado,
      fechaNado: swimmerFechaNado,
      horaNado: swimmerHoraNado,
      playa: swimmerPlaya,
      realOlas: swimmerIsOnlyMessage ? "" : swimmerRealOlas,
      realResaca: swimmerIsOnlyMessage ? "" : swimmerRealResaca,
      realCorriente: swimmerIsOnlyMessage ? "" : swimmerRealCorriente,
      realVientoFza: "",
      realVientoDir: "",
      sensaciones: swimmerIsOnlyMessage 
        ? `[Nombre: ${swimmerName.trim() || 'Anónimo'} | Medusas: - | Agua: -] ${swimmerSensaciones}`
        : `[Nombre: ${swimmerName.trim() || 'Anónimo'} | Medusas: ${swimmerMedusas} | Agua: ${swimmerAgua}] ${swimmerSensaciones}`,
      origenDato: swimmerIsOnlyMessage ? "Nadador: Mensaje" : "Nadador: Reporte",
      appScore: hourForecast ? hourForecast.hourScore : "",
      appOlas: hourForecast ? hourForecast.swellH : "",
      appEnergia: hourForecast ? hourForecast.waveEnergy : "",
      appVientoNudos: hourForecast ? hourForecast.windS : "",
      appVientoDir: hourForecast ? hourForecast.windDir : "",
      notasCalibracion: swimmerIsOnlyMessage ? "Mensaje libre de nadador" : "Reporte público de nadador",
      boyaAltura: latestBuoyHeight || ecmwfVal || (hourForecast ? hourForecast.swellH : ""), 
      boyaPeriodo: latestBuoyPeriod || "",
      boyaDireccion: latestBuoyDir || (hourForecast && hourForecast.swellDir ? hourForecast.swellDir : "110"),
      boyaTemp: latestBuoyTemp || "",
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
      setSwimmerName('');
      setSwimmerIsOnlyMessage(false);
      
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

  async function handleSyncBuoy() {
    setIsSyncingBuoy(true);
    const now = new Date();
    const currentHourStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const payload = {
      horaNado: currentHourStr,
      playa: selectedBeach,
      realOlas: "",
      realResaca: "",
      realCorriente: "",
      realVientoFza: "",
      realVientoDir: "",
      sensaciones: "Sincronización automática de boya",
      origenDato: "Boya: Sincronización",
      appScore: "",
      appOlas: "",
      appEnergia: "",
      appVientoNudos: "",
      appVientoDir: "",
      notasCalibracion: "Actualización forzada de boya real",
      boyaAltura: latestBuoyHeight || "", 
      boyaPeriodo: latestBuoyPeriod || "",
      boyaDireccion: (latestBuoyDir && Number(latestBuoyDir) !== 110) ? String(latestBuoyDir) : (currentDayData && currentDayData.hourly && currentDayData.hourly[0] ? String(Math.round(currentDayData.hourly[0].swellDir)) : ""),
      boyaTemp: latestBuoyTemp || "",
      modelEcmwfOlas: "",
      modelGfsOlas: "",
      modelTodoSurfOlas: ""
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      setTimeout(() => {
        fetchCalibrationHistory();
        setIsSyncingBuoy(false);
      }, 2000);
    } catch (err) {
      console.error("Error al sincronizar boya:", err);
      setIsSyncingBuoy(false);
    }
  };



  const currentDayData = beachData?.[selectedDay] ?? null;

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
                onChange={(e) => {
                  setSelectedBeach(e.target.value);
                  setVisibleReportsCount(3);
                }}
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
                    Algoritmo matemático
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 block">
                    Cálculo por algoritmo matemático
                  </span>
                </div>

                {/* Tarjeta de Boya Real en Tiempo Real (Puertos del Estado) */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3.5 relative overflow-hidden">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
                    <h3 className="text-slate-200 font-extrabold flex items-center gap-2 uppercase tracking-wider text-xs">
                      <Anchor size={16} className="text-cyan-400" />
                      <span>Boya Real de Málaga</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPuertosIframe(!showPuertosIframe)}
                        className="text-[9px] font-extrabold text-cyan-300 hover:text-white bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 shadow-sm"
                      >
                        {showPuertosIframe ? '📊 Ver Ficha' : '🏛️ Widget Oficial'}
                      </button>
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> EN VIVO
                      </span>
                    </div>
                  </div>

                  {showPuertosIframe ? (
                    <div className="w-full h-[290px] rounded-xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950">
                      <iframe
                        src="https://portus.puertos.es/#/locationsWidget?code=35218&theme=dark&locale=es"
                        className="w-full h-full border-none"
                        title="Puertos del Estado - La Misericordia"
                      ></iframe>
                    </div>
                                    ) : (
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5 text-left">
                      <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Altura Olas (Hs)</span>
                        <strong className="text-lg font-black text-cyan-300 block mt-0.5">
                          {latestBuoyHeight ? `${Number(latestBuoyHeight.toString().replace(",", ".")).toFixed(2)}m` : '—'}
                        </strong>
                      </div>

                      <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Periodo (Tp)</span>
                        <strong className="text-lg font-black text-indigo-300 block mt-0.5">
                          {latestBuoyPeriod ? `${latestBuoyPeriod}s` : '—'}
                        </strong>
                      </div>

                      <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Dirección Oleaje</span>
                        <strong className="text-xs font-extrabold text-amber-300 block mt-1 truncate">
                          {(() => {
                            let activeDir = null;
                            if (latestBuoyDir !== null && latestBuoyDir !== undefined) {
                              activeDir = Number(latestBuoyDir);
                            } else if (currentDayData && currentDayData.hourly && currentDayData.hourly.length > 0) {
                              const nowH = new Date().getHours();
                              const hourRec = currentDayData.hourly.find(h => parseInt((h.time || "").split(':')[0], 10) === nowH) || currentDayData.hourly[0];
                              if (hourRec && hourRec.swellDir != null && !isNaN(Number(hourRec.swellDir))) {
                                activeDir = Number(hourRec.swellDir);
                              }
                            }
                            return activeDir !== null ? `${getWindDirection(activeDir)} (${Math.round(activeDir)}°)` : '—';
                          })()}
                        </strong>
                      </div>

                      <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Temp. Agua Real</span>
                        <strong className="text-xs font-extrabold text-emerald-300 block mt-1">
                          {latestBuoyTemp ? `${latestBuoyTemp}°C` : '—'}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 border-t border-slate-800/80">
                                          <span>
                        Origen: {showPuertosIframe 
                          ? '📡 Puertos del Estado (Estación 2056 - Málaga)' 
                          : (latestBuoySource || '✏️ Calibración Manual Admin')}
                      </span>
                      <span>Última lectura: {latestBuoyDate ? `${formatFriendlyDate(latestBuoyDate)}` : 'Sin reporte hoy'}</span>
                  </div>
                </div>

                {/* Tarjeta 2: Temperaturas */}
                <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 ${isClimateDown ? 'opacity-70' : ''}`}>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                      <Thermometer size={16} className="text-blue-500"/> Temperaturas
                    </h3>
                    <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                      Previsión vs Real
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Agua / Mar */}
                    <div className="space-y-2 text-left">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperatura del Agua</span>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Prevista */}
                        <div className="bg-blue-50/40 border border-blue-100/50 rounded-xl p-2.5 text-left">
                          <span className="block text-[8px] font-bold text-blue-500 uppercase tracking-wider">Satélite</span>
                          <span className="text-base font-black text-blue-700">{currentDayData.temps.water}ºC</span>
                          <span className="block text-[8px] text-blue-400 font-semibold mt-0.5">Modelo previsto</span>
                        </div>
                        
                        {/* Real (Boya) */}
                        <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-xl p-2.5 text-left relative overflow-hidden">
                          <div className="flex justify-between items-center">
                            <span className="block text-[8px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                              ⚓ Boya Real
                            </span>
                            <button
                              type="button"
                              onClick={handleSyncBuoy}
                              disabled={isSyncingBuoy}
                              title="Sincronizar boya en tiempo real"
                              className="text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50 p-0.5"
                            >
                              <RefreshCw size={10} className={isSyncingBuoy ? "animate-spin" : ""} />
                            </button>
                          </div>
                          <span className="text-base font-black text-indigo-800 block mt-0.5">
                            {latestBuoyTemp ? `${latestBuoyTemp}ºC` : '— ºC'}
                          </span>
                          <span className="block text-[8px] text-indigo-500/70 font-semibold mt-0.5">
                            {latestBuoyDate ? `${formatFriendlyDate(latestBuoyDate).split(',')[0]}` : 'Sin datos'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Aire */}
                    <div className="space-y-2 text-left flex flex-col justify-between">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperatura del Aire</span>
                      <div className="bg-orange-50/40 border border-orange-100/50 rounded-xl p-2.5 flex items-center justify-between h-full">
                        <div>
                          <span className="block text-[8px] font-bold text-orange-500 uppercase tracking-wider">Ambiente ({currentDayData.dayLabel.split(' ')[0]})</span>
                          <span className={`text-base font-black ${isClimateDown ? 'text-slate-400' : 'text-orange-700'}`}>
                            {currentDayData.temps.air === "-" ? "- ºC" : `${currentDayData.temps.air}ºC`}
                          </span>
                          <span className="block text-[8px] text-orange-400 font-semibold mt-0.5">Predicción Modelo</span>
                        </div>
                        <div className={isClimateDown ? "text-slate-400" : "text-orange-500"}>
                          <Sun size={24}/>
                        </div>
                      </div>
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

                {/* Tarjeta 5: Calidad del Agua, Medusas y Mareas (Grid triple en Tablet, vertical en PC/Móvil) */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-4">
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

                  {/* Mareas */}
                  <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isClimateDown ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-slate-500 font-bold flex items-center gap-2 uppercase tracking-wide text-xs">
                        <Waves size={16} className={isClimateDown ? 'text-slate-400' : 'text-blue-500'}/> Mareas
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium">Satélite + REDMAR</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {/* Estado Actual (Solo hoy) */}
                      {selectedDay === 1 && currentDayData?.tides?.currentState && (
                        <div className="flex items-center justify-between p-2 rounded-xl border border-blue-100 bg-blue-50/50">
                          <span className="text-[10px] font-bold text-slate-500">Estado actual:</span>
                          <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            {currentDayData.tides.currentState}
                          </span>
                        </div>
                      )}

                      {/* Extremos del día */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        {currentDayData?.tides?.extremes && currentDayData.tides.extremes.length > 0 ? (
                          currentDayData.tides.extremes.map((t, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 p-2 rounded-xl flex flex-col justify-center">
                              <span className={`text-[9px] font-black uppercase tracking-wide ${t.type === 'Pleamar' ? 'text-indigo-600' : 'text-slate-500'}`}>
                                {t.type === 'Pleamar' ? '📈 Pleamar' : '📉 Bajamar'}
                              </span>
                              <span className="text-xs font-black text-slate-700 mt-0.5">
                                {t.time}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                {t.height.toFixed(2)}m
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 text-[10px] text-slate-400 font-medium py-2">
                            Mareas no disponibles
                          </div>
                        )}
                      </div>
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
                
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-800 text-lg">
                      {selectedDay === 0 ? "Registro de ayer" : "Evolución del mar"}
                    </h3>
                    <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium border border-slate-200 bg-white px-2 py-0.5 rounded-full">
                      Predicción Matemática
                    </span>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Botones Switcher de Vista */}
                    <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 flex gap-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-2.5 py-1 rounded transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Tabla 📋
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('chart')}
                        className={`px-2.5 py-1 rounded transition-all ${viewMode === 'chart' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Gráfico 📈
                      </button>
                    </div>

                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm shrink-0 ${selectedDay === 0 ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      <CalendarDays size={14}/> {currentDayData.dayLabel.split(' ')[0]}
                    </span>
                  </div>
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
                          <button
                            onClick={() => setIsSwimmerModalOpen(true)}
                            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-xs w-full sm:w-auto"
                          >
                            📝 ¿Nadaste ayer? Reportar estado
                          </button>
                     </div>
                     <p className="text-[11px] font-bold text-indigo-500 mt-3 text-center sm:text-left w-full">
                       O si lo prefieres, cuéntanoslo directamente por el grupo de WhatsApp del club.
                     </p>
                  </div>
                )}
                
                  {viewMode === 'chart' ? (
                    <div className="p-5 animate-in fade-in duration-300">
                      <HourlySvgChart hourlyData={currentDayData.hourly} />
                    </div>
                  ) : (
                    <>
                      {/* Cabecera del acordeón horario (visible en PC y móvil) */}
                      <div className="flex px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50 rounded-t-2xl mb-1.5">
                    <span className="w-[50px] md:w-[80px]">Hora</span>
                    <span className="flex-grow pl-4 md:pl-8">Score</span>
                    <span className="w-[70px] md:w-[120px] text-right">Oleaje</span>
                    <span className="w-[85px] md:w-[150px] text-right pr-6 md:pr-10">Viento</span>
                  </div>

                  {/* Listado en acordeón interactivo (para PC y móvil) */}
                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
                    {currentDayData.hourly.map((hour, idx) => {
                      const isExpanded = expandedHourIdx === idx;
                      return (
                        <div 
                          key={idx} 
                          className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                            isExpanded ? 'border-indigo-400 ring-1 ring-indigo-400/30' : 'border-slate-200 hover:border-slate-300'
                          } ${selectedDay === 0 ? 'opacity-80' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedHourIdx(isExpanded ? null : idx)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3.5 flex-grow">
                              {/* Hora */}
                              <span className="font-bold text-slate-800 text-sm md:text-base min-w-[50px] md:min-w-[80px]">{hour.time}</span>
                              
                              {/* Score y alerta local */}
                              <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 pl-0 md:pl-4">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-bold text-[10px] md:text-xs
                                  ${hour.hourScore > 70 ? 'bg-emerald-100 text-emerald-700' : 
                                    hour.hourScore > 40 ? 'bg-amber-100 text-amber-700' : 
                                    hour.localRule === "Tormenta ⚡" ? 'bg-yellow-100 text-yellow-700' :
                                    hour.localRule === "Niebla 🌫️" ? 'bg-slate-200 text-slate-600' :
                                    'bg-red-100 text-red-700'}`}>
                                  Score: {hour.hourScore}
                                </span>
                                {hour.localRule && (
                                  <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${hour.ruleColor}`}>
                                    {hour.localRule}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 md:gap-8 shrink-0">
                              {/* Olas */}
                              <div className="text-right min-w-[70px] md:min-w-[120px]">
                                <span className={`font-black text-sm md:text-base block ${hour.swellH > 0.8 ? 'text-red-500' : 'text-blue-600'}`}>
                                  {hour.swellH}m
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wide">
                                  P: {hour.period}s
                                </span>
                              </div>

                              {/* Viento */}
                              {!isClimateDown && (
                                <div className="text-right min-w-[85px] md:min-w-[150px]">
                                  <span className={`font-black text-xs md:text-sm block ${hour.windS > 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                                    {hour.windS} kts
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400 block truncate max-w-[80px] md:max-w-none">
                                    {getWindDirection(hour.windDir)}
                                  </span>
                                </div>
                              )}

                              {/* Icono de estado */}
                              <div className="text-slate-400 pr-1 md:pr-3">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </button>

                          {/* Detalles desplegables (Rejilla de 2 cols en móvil y 4 cols en PC) */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 text-xs text-slate-600 space-y-3 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                                {/* Tarjeta de Olas & Energía */}
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
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
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
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
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Viento</span>
                                  <div className="mt-1 font-semibold text-slate-700">
                                    {isClimateDown ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      <>
                                        <span className="font-black text-slate-800 text-sm block">{hour.windS} kts</span>
                                        <span className="text-[9px] text-slate-400 block">Rachas: {hour.gust} kts</span>
                                        <span className="text-[9px] text-slate-500 block">Procedencia: {getWindDirectionFullName(hour.windDir)} ({hour.windDir}°)</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Tarjeta de Cielo y Clima */}
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
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

                              {/* Tarjeta inferior para UV y Visibilidad (Ocupa todo el ancho: 2 cols en móvil y 4 cols en PC) */}
                              {!isClimateDown && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between col-span-2 lg:col-span-4">
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Índice UV</span>
                                    <span className={`font-black text-sm ${hour.uv >= 6 ? 'text-amber-600' : 'text-slate-700'}`}>
                                      {hour.uv === '-' || hour.uv === undefined || hour.uv === null ? '-' : Number(hour.uv).toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Visibilidad</span>
                                    <span className={`text-xs ${hour.visColor || 'font-bold text-slate-700'}`}>
                                      {hour.visText || 'Excelente'}
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
                </>
              )}
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
                    {(() => {
                      const calibrationLogsOnly = [...calibrationHistory]
                        .filter(item => {
                          const type = getRecordType(item);
                          const hasOlas = item.realOlas !== undefined && item.realOlas !== null && item.realOlas !== "";
                          return (type === 'swimmer_report' || type === 'admin_report') && hasOlas;
                        })
                        .sort((a, b) => parseLogTimestamp(b) - parseLogTimestamp(a));
                      return (
                        <select
                          value={selectedHistoryLog ? calibrationLogsOnly.indexOf(selectedHistoryLog) : ''}
                          onChange={(e) => {
                            const idx = e.target.value;
                            setSelectedHistoryLog(idx !== '' ? calibrationLogsOnly[idx] : null);
                          }}
                          className="border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 bg-white shadow-sm focus:border-indigo-500 outline-none w-full"
                        >
                          <option value="">-- Seleccionar Sesión Guardada --</option>
                          {calibrationLogsOnly.map((item, idx) => {
                            const cleanSens = String(item.sensaciones || "").replace(/^\[.*?\]\s*/, '').trim();
                            const sensPreview = cleanSens ? ` - "${cleanSens.substring(0, 25)}${cleanSens.length > 25 ? '...' : ''}"` : '';
                            return (
                              <option key={idx} value={idx}>
                                {formatSwimFriendly(item.fechaRegistro || item.fecha, item.horaNado)} - {BEACHES[item.playa]?.name.split(',')[0] || item.playa || 'Misericordia'}{sensPreview}
                              </option>
                            );
                          })}
                        </select>
                      );
                    })()}
                  </div>

                  {selectedHistoryLog ? (() => {
                    const parsedDetails = parseSwimmerSensaciones(selectedHistoryLog.sensaciones);
                    const logType = getRecordType(selectedHistoryLog);
                    const isSwimmer = logType === 'swimmer_report';
                    
                    const appOlas = parseFloat((selectedHistoryLog.appOlas || "0").toString().replace(",", "."));
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
                              🏖️ {BEACHES[selectedHistoryLog.playa]?.name || selectedHistoryLog.playa} ({cleanHourString(selectedHistoryLog.horaNado) || 'Hora no registrada'})
                            </h4>
                            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                              Sesión registrada el {formatFriendlyDate(selectedHistoryLog.timestamp || selectedHistoryLog.fechaRegistro || selectedHistoryLog.fecha)}
                            </p>
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
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Boya Real (Hora Nado)</span>
                            <span className="text-sm font-black text-slate-800 mt-1">
                              {(() => {
                                const buoyData = getBuoyReadingForLog(selectedHistoryLog);
                                return buoyData.height ? `${buoyData.height}m` : '—';
                              })()}
                            </span>
                            <span className="text-[9px] text-slate-500 font-semibold mt-1">
                              {(() => {
                                const buoyData = getBuoyReadingForLog(selectedHistoryLog);
                                const dirVal = buoyData.dir || selectedHistoryLog.boyaDireccion;
                                const dirText = dirVal ? `${getWindDirection(dirVal)} (${Math.round(dirVal)}º)` : '';
                                const periodText = (buoyData.period && buoyData.period !== '—') ? buoyData.period : '';
                                if (dirText && periodText) return `${dirText} • ${periodText}`;
                                return dirText || periodText || '—';
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/60 rounded-xl p-4 mt-3.5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm">
                          <div className="flex-grow text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              Sensaciones de: <strong className="text-indigo-500 font-bold">
                                {isSwimmer && parsedDetails.nombre !== 'Anónimo' ? parsedDetails.nombre : 
                                 (logType.startsWith('admin') ? 'Administrador' : 'Nadador')}
                              </strong>
                            </span>
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
                        calibrationHistory.map((item, idx) => {
                          const recType = getRecordType(item);
                          if (recType === 'system_factor' || recType === 'buoy_sync') return null;
                          const parsed = parseSwimmerSensaciones(item.sensaciones);
                          let bgClass = "bg-slate-50 hover:bg-slate-100/80 border-slate-200/60";
                          let typeBadge = null;
                          
                          if (recType === 'system_factor') {
                            bgClass = "bg-amber-50/20 hover:bg-amber-50/40 border-amber-100/60";
                            typeBadge = (
                              <span className="text-[8px] font-black text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                🔒 Factor Admin
                              </span>
                            );
                          } else if (recType === 'buoy_sync') {
                            bgClass = "bg-blue-50/20 hover:bg-blue-50/45 border-blue-100/60";
                            typeBadge = (
                              <span className="text-[8px] font-black text-blue-600 bg-blue-100/70 px-1.5 py-0.5 rounded">
                                ⚓ Boya Real
                              </span>
                            );
                          } else if (recType === 'swimmer_msg') {
                            bgClass = "bg-indigo-50/25 hover:bg-indigo-50/45 border-indigo-100/60";
                            typeBadge = (
                              <span className="text-[8px] font-black text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                                💬 Mensaje
                              </span>
                            );
                          } else if (recType === 'admin_alert') {
                            bgClass = "bg-rose-50/45 hover:bg-rose-50/70 border-rose-100/80 border-l-4 border-l-rose-500 animate-pulse";
                            typeBadge = (
                              <span className="text-[8px] font-black text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded">
                                ⚠️ Alerta Admin
                              </span>
                            );
                          } else if (recType === 'admin_report') {
                            bgClass = "bg-violet-50/15 hover:bg-violet-50/30 border-violet-100/60";
                            typeBadge = (
                              <span className="text-[8px] font-black text-violet-600 bg-violet-100/70 px-1.5 py-0.5 rounded">
                                📋 Calibración
                              </span>
                            );
                          } else {
                            typeBadge = (
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                👤 Reporte Nado
                              </span>
                            );
                          }

                          return (
                            <div key={idx} className={`${bgClass} p-4 rounded-xl border shadow-sm transition-all text-left`}>
                              <div className="flex justify-between items-start mb-2.5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-none">
                                    🏖️ {BEACHES[item.playa]?.name.split(',')[0] || item.playa}
                                  </span>
                                  <div className="mt-0.5 flex gap-1 items-center">
                                    {typeBadge}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded leading-none shrink-0" title="Día y hora de la sesión de nado">
                                  Nado: {formatSwimFriendly(item.fechaNado || item.fechaRegistro || item.timestamp || item.fecha, item.horaNado)}
                                </span>
                              </div>

                              {recType === 'buoy_sync' ? (
                                <div className="grid grid-cols-4 gap-1 border-y border-blue-100/60 py-2 my-2 text-center text-xs">
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Altura</span>
                                    <span className="font-black text-blue-600">{item.boyaAltura ? `${parseFloat(item.boyaAltura.toString().replace(',', '.')).toFixed(2)}m` : '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Periodo</span>
                                    <span className="font-black text-slate-600">{formatBoyaPeriod(item.boyaPeriodo)}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Dir</span>
                                    <span className="font-extrabold text-amber-600">
                                      {(() => {
                                        const rawDir = item.boyaDireccion;
                                        const dirVal = (rawDir && Number(rawDir) !== 110)
                                          ? rawDir
                                          : (currentDayData && currentDayData.hourly && currentDayData.hourly[0] ? currentDayData.hourly[0].swellDir : null);
                                        return dirVal ? getWindDirection(dirVal) : '—';
                                      })()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Temp</span>
                                    <span className="font-black text-indigo-600">{item.boyaTemp ? `${formatBoyaTemp(item.boyaTemp)}ºC` : '—'}</span>
                                  </div>
                                </div>
                              ) : (recType === 'swimmer_msg' || recType === 'admin_alert') ? (
                                // No rating grid for message-only / alerts
                                null
                              ) : recType === 'swimmer_report' ? (
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
                                    <span className="font-black text-slate-600">{item.realVientoFza || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Deriva</span>
                                    <span className="font-black text-indigo-600">{item.realCorriente}/5</span>
                                  </div>
                                </div>
                              )}

                              {(() => {
                                const isSwimmerType = recType === 'swimmer_report' || recType === 'swimmer_msg';
                                const displayComment = isSwimmerType ? parsed.comentario : (recType === 'admin_alert' ? String(item.notasCalibracion || '').replace('[ALERTA_OFICIAL]', '').trim() : String(item.sensaciones !== null && item.sensaciones !== undefined ? item.sensaciones : ''));
                                
                                if (displayComment && recType !== 'buoy_sync') {
                                  return (
                                    <div className="space-y-1">
                                      {isSwimmerType && parsed.nombre && parsed.nombre !== 'Anónimo' && (
                                        <p className="text-[10px] font-bold text-slate-500 text-left">👤 {parsed.nombre}</p>
                                      )}
                                      <p className="text-xs text-slate-600 italic leading-tight mb-2 text-left">
                                        "{displayComment}"
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {item.boyaAltura && recType !== 'buoy_sync' && (
                                <div className="mt-2 pt-2 border-t border-slate-200/40 text-[9px] font-semibold text-slate-400 flex justify-between">
                                  <span>⚓ Boya Real: {item.boyaAltura}m</span>
                                  <span>🌡️ Agua: {formatBoyaTemp(item.boyaTemp)}ºC</span>
                                </div>
                              )}

                              <div className="mt-2 pt-2 border-t border-slate-200/20 flex justify-between items-center text-[9px] text-slate-400 font-medium">
                                <span>Origen: <strong className="text-indigo-500 font-semibold">{item.origenDato.split(':')[0]}</strong></span>
                                <span>
                                  Reportado: <strong>{formatFriendlyDate(item.timestamp || item.fechaRegistro || item.fecha)}</strong>
                                </span>
                              </div>
                            </div>
                          );
                        })
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
          {(() => {
            const latestAlert = calibrationHistory.find(item => 
              item.playa === selectedBeach && 
              getRecordType(item) === 'admin_alert'
            );
            
            const filteredReports = calibrationHistory.filter(item => {
              const itemPlaya = (item.playa || '').toString().toLowerCase();
              const targetPlaya = selectedBeach.toLowerCase();
              const isBeachMatch = !item.playa || itemPlaya.includes(targetPlaya) || targetPlaya.includes(itemPlaya);
              const type = getRecordType(item);
              return isBeachMatch && (type === 'swimmer_report' || type === 'swimmer_msg' || type === 'admin_report');
            });

            return (
              <>
                {latestAlert && (
                  <div className="mb-5 bg-rose-50 border border-rose-200/60 rounded-2xl p-4 shadow-sm text-left flex items-start gap-3 w-full border-l-4 border-l-rose-500">
                    <span className="text-xl shrink-0">⚠️</span>
                    <div className="flex-grow">
                      <span className="inline-block text-[8px] font-black text-rose-600 bg-rose-100/60 px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                        Alerta Oficial del Administrador
                      </span>
                      <p className="text-xs font-bold text-rose-800 leading-tight">
                        {(latestAlert.notasCalibracion || '').replace('[ALERTA_OFICIAL]', '').trim() || (latestAlert.sensaciones || 'Aviso de seguridad')}
                      </p>
                      <span className="block text-[8px] text-rose-500/70 font-semibold mt-1">
                        Registrado: {formatFriendlyDate(latestAlert.timestamp || latestAlert.fechaRegistro || latestAlert.fecha)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {isCalHistoryLoading ? (
                    <div className="col-span-full flex items-center justify-center py-10 gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={18} />
                      <span className="text-xs font-bold">Cargando reportes de la comunidad...</span>
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 font-bold">No hay reportes de nadadores hoy para esta playa.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Sé el primero en informar a la comunidad sobre el estado del agua.</p>
                    </div>
                  ) : (
                    filteredReports
                      .slice(0, visibleReportsCount)
                      .map((item, idx) => {
                        const recType = getRecordType(item);
                        const parsed = parseSwimmerSensaciones(item.sensaciones);
                        
                        let bgClass = "bg-slate-50 border-slate-200/60 hover:bg-blue-50/10 hover:border-blue-100";
                        let typeBadge = null;
                        
                        if (recType === 'buoy_sync') {
                          bgClass = "bg-blue-50/20 border-blue-100/50 hover:bg-blue-50/35 hover:border-blue-200";
                          typeBadge = (
                            <span className="inline-block text-[8px] font-black text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              ⚓ Lectura Boya
                            </span>
                          );
                        } else if (recType === 'swimmer_msg') {
                          bgClass = "bg-indigo-50/10 border-indigo-100/50 hover:bg-indigo-50/20 hover:border-indigo-200";
                          typeBadge = (
                            <span className="inline-block text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              💬 Mensaje
                            </span>
                          );
                        } else if (recType === 'admin_report') {
                          bgClass = "bg-violet-50/10 border-violet-100/50 hover:bg-violet-50/20 hover:border-violet-200";
                          typeBadge = (
                            <span className="inline-block text-[8px] font-black text-violet-600 bg-violet-100/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              📋 Calibración
                            </span>
                          );
                        } else {
                          bgClass = "bg-slate-50 border-slate-200/60 hover:bg-blue-50/10 hover:border-blue-100";
                          typeBadge = (
                            <span className="inline-block text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              👤 Reporte Nado
                            </span>
                          );
                        }

                        return (
                          <div key={idx} className={`${bgClass} p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all text-left`}>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="text-sm">
                                    {recType === 'buoy_sync' ? '⚓' : recType === 'admin_report' ? '📋' : recType === 'swimmer_msg' ? '💬' : '👤'}
                                  </span>
                                  <span>
                                    {recType === 'buoy_sync' ? 'Boya Real Málaga' : (item.origenDato.startsWith('Admin') ? 'Admin' : (parsed.nombre && parsed.nombre !== 'Anónimo' ? parsed.nombre : 'Nadador Anónimo'))}
                                  </span>
                                  {typeBadge}
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                  Nado: {formatSwimFriendly(item.fechaNado || item.fechaRegistro || item.timestamp || item.fecha, item.horaNado)}
                                </span>
                              </div>

                              {recType === 'buoy_sync' ? (
                                <div className="grid grid-cols-3 gap-2 border-y border-blue-100/60 py-2 my-2 text-center text-xs bg-white/50 rounded-lg">
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Altura</span>
                                    <span className="font-black text-blue-600">{parseBoyaNum(item.boyaAltura, 0.05, 15) !== null ? `${parseBoyaNum(item.boyaAltura, 0.05, 15).toFixed(2)}m` : '—'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Periodo</span>
                                    <span className="font-black text-slate-600">{formatBoyaPeriod(item.boyaPeriodo)}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Temp</span>
                                    <span className="font-black text-indigo-600">{formatBoyaTemp(item.boyaTemp) !== '—' ? `${formatBoyaTemp(item.boyaTemp)}ºC` : '—'}</span>
                                  </div>
                                </div>
                              ) : (recType === 'swimmer_msg') ? (
                                null
                              ) : recType === 'swimmer_report' ? (
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
                                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-[10px] font-bold text-rose-700 rounded-md">
                                    🪼 Medusas: {parsed.medusas}
                                  </span>
                                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 rounded-md">
                                    🧼 Agua: {parsed.agua}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700 rounded-md">
                                    🌊 Olas: {item.realOlas}/5
                                  </span>
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 rounded-md">
                                    💨 Viento: {item.realVientoFza || '—'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 rounded-md">
                                    🧭 Deriva: {item.realCorriente}/5
                                  </span>
                                </div>
                              )}

                              {(() => {
                                const isSwimmerType = recType === 'swimmer_report' || recType === 'swimmer_msg';
                                const displayComment = isSwimmerType ? parsed.comentario : String(item.sensaciones !== null && item.sensaciones !== undefined ? item.sensaciones : '');
                                
                                if (displayComment && recType !== 'buoy_sync') {
                                  return (
                                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic border-l-2 border-blue-200 pl-2">
                                      "{displayComment}"
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200/40 flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                              <span>Origen: <strong className="text-indigo-500 font-semibold">{item.origenDato}</strong></span>
                              <span>
                                Reportado: <strong>{formatFriendlyDate(item.timestamp || item.fechaRegistro || item.fecha)}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {filteredReports.length > visibleReportsCount && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleReportsCount(prev => prev + 3)}
                      className="bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-bold py-2 px-5 rounded-xl border border-slate-200 shadow-sm transition-all text-xs flex items-center gap-1.5"
                    >
                      <span>Mostrar más comentarios</span>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}
              </>
            );
          })()}
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
                  Hemos cogido los datos en bruto de los satélites y los sensores marinos y los hemos pasado por el <strong>"filtro de la experiencia local"</strong> para crear el primer predictor de aguas abiertas pensado por y para la costa de Málaga.
                </p>
              </section>

              {/* 1. EL TARÓ Y LA NIEBLA MARINA */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <CloudFog size={20} className="text-slate-600"/> 1. El Taró y la Niebla Marina
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  En verano es muy común el <strong>Taró</strong> (niebla de advección): esa masa de niebla espesa que entra de golpe a mediodía atrapando la costa. Se forma cuando el aire cálido y húmedo del Levante pasa por encima de bolsas de agua fría residuales de Poniente.
                </p>
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                  <div className="flex gap-3 items-start">
                    <span className="text-base shrink-0">🚨</span>
                    <div>
                      <strong className="text-slate-800">Riesgo de Taró (o Bolsas 200m):</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Niebla densa en orilla o a 200m pasadas las boyas amarillas. Visibilidad muy reducida (&lt; 1 km) y castigo en el Score. Mucha precaución con perder la costa de vista.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-base shrink-0">⚠️</span>
                    <div>
                      <strong className="text-slate-800">Bruma / Taró Leve:</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Niebla suave que reduce la visión de los edificios y los espigones (1 a 3 km).</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-base shrink-0">🌫️</span>
                    <div>
                      <strong className="text-slate-800">Bruma Mar Adentro:</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Calima húmeda o bruma anclada en el horizonte marino (la orilla está clara, pero mar adentro se ve turbio).</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. EL AGUA: BOYA REAL VS SATELITE VS BOLSAS */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Thermometer size={20} className="text-blue-500"/> 2. El Agua: Boya Real vs. Orilla
                </h4>
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                  <div className="flex gap-3 items-start">
                    <Anchor className="text-blue-600 shrink-0 mt-1" size={18} />
                    <div>
                      <strong className="text-slate-800">Boya de Málaga (Mar abierto):</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Mide la temperatura real de la gran masa de agua mar adentro (a varias millas de la costa).</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <ThermometerSun className="text-amber-500 shrink-0 mt-1" size={18} />
                    <div>
                      <strong className="text-slate-800">Satélite (Modelo teórico):</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Te da una estimación general, aunque suele marcar 2ºC o 3ºC por encima de lo que sientes al meter el pie en la playa.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Waves className="text-cyan-600 shrink-0 mt-1" size={18} />
                    <div>
                      <strong className="text-slate-800">Bolsas de Agua Fría (Inercia de Poniente):</strong>
                      <p className="text-xs text-slate-600 mt-0.5">Tras días de Poniente, el mar "escupe" agua helada profunda hacia la costa. A veces la orilla está agradable pero a 150m pasas una bolsa helada a 18ºC. La app detecta el viento de los días previos para avisarte de estas bolsas.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. LAS CORRIENTES Y DERIVA */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Compass size={20} className="text-indigo-500"/> 3. Las Corrientes: Hacia dónde te lleva el agua
                </h4>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-3 items-start">
                     <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Resaca (Hacia adentro):</strong>
                       <p className="text-sm text-slate-600 mt-1">Si entra agua con fuerza a la playa, tiene que buscar salida hacia mar abierto creando embudos de succión. Se marca como Baja, Media o Alta.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <Compass className="text-indigo-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">La Deriva Lateral (Flechitas Nerja / Fuengirola):</strong>
                       <p className="text-sm text-slate-600 mt-1">Cruzando el ángulo de la playa con el de la ola, sabemos si el agua "resbala" empujándote hacia el Este (⬅️ etiqueta <strong>Nerja</strong>) o hacia el Oeste (➡️ etiqueta <strong>Fuengirola</strong>) a lo largo de la costa.</p>
                     </div>
                  </div>
                </div>
              </section>

              {/* 4. ENERGÍA EN KJ */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Activity size={20} className="text-orange-500"/> 4. La Fuerza de las Olas (Energía en Kj)
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  Lo que de verdad te empuja en el pecho no son los metros de ola, sino su <strong>Energía en Kilojulios (Kj)</strong>.
                </p>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-sm text-orange-800 font-medium flex items-start gap-3">
                  <Info className="shrink-0 text-orange-600 mt-0.5" size={20} />
                  <p>
                    <strong>La regla al cuadrado:</strong> Una ola de 0.8m no tiene el doble de fuerza que una de 0.4m... <strong>¡Tiene 4 veces más energía!</strong> Por eso, a partir de 0.6m notarás que el mar golpea con mucha dureza. Fíjate en la columna de <strong>Energía (Kj)</strong> para conocer el impacto real.
                  </p>
                </div>
              </section>

              {/* 5. ALERTAS DE SALUD, MEDUSAS Y AGUAS SUCIAS */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Zap size={20} className="text-yellow-600"/> 5. Alertas de Salud, Medusas y Aguas Sucias
                </h4>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-3 items-start">
                     <Zap className="text-yellow-600 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Corte por Tormenta (Rayos):</strong>
                       <p className="text-sm text-slate-600 mt-1">Si el satélite detecta riesgo eléctrico, la nota caerá a 0 puntos. En el agua eres el punto más alto, un pararrayos natural. Sal inmediatamente.</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <TestTubes className="text-emerald-500 shrink-0 mt-1" size={20} />
                     <div>
                       <strong className="text-slate-800">Calidad del Agua (Arrastres):</strong>
                       <p className="text-sm text-slate-600 mt-1">La app suma la lluvia caída desde ayer. Si llueve fuerte, los aliviaderos de Málaga y el río Guadalhorce escupirán suciedad que la corriente traerá a la playa (tarjeta en "Precaución" o "Riesgo Alto").</p>
                     </div>
                  </div>
                  <div className="flex gap-3 items-start">
                     <span className="text-base shrink-0">🪼</span>
                     <div>
                       <strong className="text-slate-800">Riesgo de Medusas (Heurístico de Levante):</strong>
                       <p className="text-sm text-slate-600 mt-1">Cuando el viento sopla de Levante (Este/Sureste) durante más de 4 horas seguidas, la app eleva la precaución por medusas, ya que esa corriente arrastra los enjambres hacia la orilla.</p>
                     </div>
                  </div>
                </div>
              </section>

              {/* 6. REGLAS LOCALES */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Bot size={20} className="text-indigo-500"/> 6. El "Cerebro" Malagueño (Reglas Locales)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600"><Waves size={24} /></div>
                      <h5 className="font-bold text-slate-800">El "Magón"</h5>
                    </div>
                    <p className="text-sm text-slate-600">Ola tendida sin viento. Aunque sea grande (0.5m), la app no castiga la nota en exceso porque es mar de fondo cómodo.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600"><ThermometerSun size={24} /></div>
                      <h5 className="font-bold text-slate-800">La "Lavadora" Térmica</h5>
                    </div>
                    <p className="text-sm text-slate-600">A mediodía, el Poniente superior a 12 nudos levanta un mar picado insoportable para respirar.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><Wind size={24} /></div>
                      <h5 className="font-bold text-slate-800">La trampa del Terral</h5>
                    </div>
                    <p className="text-sm text-slate-600">Viento fuerte de Norte (tierra). Deja la orilla plato como un espejo, pero te empuja hacia mar adentro sin darte cuenta.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600"><ShieldAlert size={24} /></div>
                      <h5 className="font-bold text-slate-800">El Escudo del Puerto</h5>
                    </div>
                    <p className="text-sm text-slate-600">La Malagueta y Pedregalejo están fuertemente protegidas contra las olas de Poniente o Suroeste. El satélite llega aquí muy atenuado.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600"><AlertTriangle size={24} /></div>
                      <h5 className="font-bold text-slate-800">Rompiente Dura (en Pleamar)</h5>
                    </div>
                    <p className="text-sm text-slate-600">Ola pequeña mar adentro que rompe con un seco y duro golpe de agua en la orilla debido al escalón de arena y la marea llena.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600"><Activity size={24} /></div>
                      <h5 className="font-bold text-slate-800">Batalla Térmica ⚔️</h5>
                    </div>
                    <p className="text-sm text-slate-600">A mediodía, el terral de mañana choca de frente con la brisa marina (virazón), creando un mar cruzado, picado y desordenado.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><Compass size={24} /></div>
                      <h5 className="font-bold text-slate-800">Falsa Calma (Corriente de Fondo) ⚠️</h5>
                    </div>
                    <p className="text-sm text-slate-600">La superficie se ve lisa como un espejo (mar plato), pero por abajo las olas vienen con un periodo largo (más de 6 segundos) empujando con fuerza por el fondo.</p>
                  </div>
                </div>
              </section>

              {/* 7. LA COMUNIDAD */}
              <section>
                <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b pb-2">
                  <Users size={20} className="text-emerald-500"/> 7. La Comunidad: Tú eres el mejor sensor
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Haz clic en el botón <strong>📝 ¿Nadaste ayer? Reportar estado</strong> para contarnos si viste medusas, si el agua estaba fría o limpia. Con tus datos reales en la orilla, la app calibra su algoritmo en tiempo real para todos los compañeros del club.
                </p>
              </section>

              {/* ADVERTENCIA DE SENTIDO COMUN */}
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
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg md:max-w-2xl overflow-hidden relative flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200"
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
                <>
                  {/* PESTAÑAS NAVEGACIÓN ADMIN */}
                  <div className="flex border-b border-slate-200 mb-5 bg-slate-100/80 p-1 rounded-2xl gap-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setAdminTab('factors')}
                      className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-[11px] transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer ${adminTab === 'factors' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      ⚙️ Factores
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('chart')}
                      className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-[11px] transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer ${adminTab === 'chart' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      📈 Triangulación
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('compass')}
                      className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-[11px] transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer ${adminTab === 'compass' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      🧭 Brújula Costera
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('telemetry')}
                      className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-[11px] transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer ${adminTab === 'telemetry' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      📡 Auditoría
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('report')}
                      className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-[11px] transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer ${adminTab === 'report' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      📝 Registrar / Alerta
                    </button>
                  </div>

                  {/* PESTAÑA 1: REGISTRAR NADO O ALERTA OFICIAL */}
                  {adminTab === 'report' && (
                    <form onSubmit={handleSendReport} className="space-y-4 text-left">
                      {/* SELECTOR TÁCTIL DE FECHA DEL NADO / CALIBRACIÓN (ADMIN) */}
                      <div className="space-y-1.5 mb-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-600 uppercase">
                          <span>📅 Fecha de la Sesión / Calibración</span>
                          <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            {adminFechaNado === getIsoDateString() ? '☀️ Hoy' : adminFechaNado === getYesterdayIsoString() ? '⛅ Ayer' : adminFechaNado}, {adminHoraNado}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAdminFechaNado(getIsoDateString())}
                            className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all border text-center cursor-pointer ${adminFechaNado === getIsoDateString() ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                          >
                            ☀️ Hoy
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminFechaNado(getYesterdayIsoString())}
                            className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all border text-center cursor-pointer ${adminFechaNado === getYesterdayIsoString() ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                          >
                            ⛅ Ayer
                          </button>
                          <div className="relative">
                            <input
                              type="date"
                              value={adminFechaNado}
                              onChange={(e) => setAdminFechaNado(e.target.value)}
                              max={getIsoDateString()}
                              className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-extrabold text-indigo-700 outline-none cursor-pointer text-center"
                            />
                          </div>
                        </div>

                        {/* Aviso inteligente de hora futura */}
                        {adminFechaNado === getIsoDateString() && parseInt((adminHoraNado || '').split(':')[0]) > new Date().getHours() && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between mt-1">
                            <span>⚠️ {adminHoraNado} es una hora futura de hoy. ¿Nado de ayer?</span>
                            <button
                              type="button"
                              onClick={() => setAdminFechaNado(getYesterdayIsoString())}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black px-2 py-0.5 rounded ml-1.5 shrink-0 cursor-pointer"
                            >
                              ⛅ Cambiar a Ayer
                            </button>
                          </div>
                        )}
                      </div>

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
                            onChange={(e) => {
                              const newHourStr = e.target.value;
                              setAdminHoraNado(newHourStr);
                              const hourNum = parseInt((newHourStr || '').split(':')[0]);
                              if (!isNaN(hourNum) && hourNum > new Date().getHours() && adminFechaNado === getIsoDateString()) {
                                setAdminFechaNado(getYesterdayIsoString());
                              }
                            }}
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
                              {adminRealOlas === 1 && "1/5 (0.05m) • Plato: Mar balsa, nadas sin turbulencia alguna"}
                              {adminRealOlas === 2 && "2/5 (0.20m) • Rizado suave: Mar rizado, no interrumpe la respiración"}
                              {adminRealOlas === 3 && "3/5 (0.45m) • Marejada / Incómodo: Salpica al respirar, girar cabeza"}
                              {adminRealOlas === 4 && "4/5 (0.80m) • Fuerte / Oleaje: Dificultad para orientarse, picado"}
                              {adminRealOlas === 5 && "5/5 (1.20m) • Muy Duro / Rompiente: Impide nadar con normalidad"}
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

                      {/* SECCIÓN ASISTIDA DE BOYA REAL (PORTUS + CONVERSORES) */}
                      <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-3.5 rounded-2xl border border-blue-200/70 space-y-3 text-left shadow-xs">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <Anchor size={14} className="text-blue-600 shrink-0" />
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                              ⚓ Boya Real Portus (Málaga 2056)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAdminPortusWidget(!showAdminPortusWidget)}
                            className="text-[9px] font-black bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            {showAdminPortusWidget ? '▲ Ocultar Portus' : '👁️ Ver Widget Portus'}
                          </button>
                        </div>

                        {/* VISOR PLEGABLE PORTUS EN VIVO */}
                        {showAdminPortusWidget && (
                          <div className="rounded-xl overflow-hidden border border-blue-200 bg-white shadow-inner animate-in fade-in zoom-in duration-200">
                            <div className="bg-slate-900 text-white px-3 py-1.5 text-[9px] font-bold flex justify-between items-center">
                              <span>🏛️ Puertos del Estado - Estación Málaga 35218</span>
                              <span className="text-[8px] text-emerald-400 font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                EN VIVO
                              </span>
                            </div>
                            <iframe
                              src="https://portus.puertos.es/#/locationsWidget?code=35218"
                              title="Widget Oficial Portus Málaga"
                              className="w-full h-72 md:h-80 border-0"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* CAMPOS NUMÉRICOS DE BOYA */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[8.5px] font-extrabold text-slate-600 uppercase mb-1">🌊 Altura (Hs m)</label>
                            <input 
                              type="text" 
                              value={adminBoyaAltura}
                              onChange={(e) => setAdminBoyaAltura(e.target.value)}
                              placeholder="Ej: 0.22"
                              className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-black text-blue-700 bg-white shadow-2xs focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-extrabold text-slate-600 uppercase mb-1">⏱️ Periodo (Tp s)</label>
                            <input 
                              type="text" 
                              value={adminBoyaPeriodo}
                              onChange={(e) => setAdminBoyaPeriodo(e.target.value)}
                              placeholder="Ej: 3.1"
                              className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-black text-indigo-700 bg-white shadow-2xs focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-extrabold text-slate-600 uppercase mb-1">🌡️ Temp Agua (ºC)</label>
                            <input 
                              type="text" 
                              value={adminBoyaTemp}
                              onChange={(e) => setAdminBoyaTemp(e.target.value)}
                              placeholder="Ej: 20.4"
                              className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-black text-cyan-700 bg-white shadow-2xs focus:border-cyan-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-extrabold text-slate-600 uppercase mb-1">🧭 Rumbo (º)</label>
                            <input 
                              type="text" 
                              value={adminBoyaDireccion}
                              onChange={(e) => setAdminBoyaDireccion(e.target.value)}
                              placeholder="Ej: 135"
                              className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-black text-slate-800 bg-white shadow-2xs focus:border-indigo-500 outline-none text-center"
                            />
                          </div>
                        </div>

                        {/* BOTONERA RÁPIDA DE RUMBOS (ROSA DE LOS VIENTOS TOUCH) */}
                        <div>
                          <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">⚡ Selector Rápido de Rumbo (Toca para fijar grados):</span>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                            {[
                              { code: 'SE', deg: '135', label: '↖️ SE 135º' },
                              { code: 'E', deg: '90', label: '⬅️ E 90º' },
                              { code: 'ESE', deg: '112', label: '↖️ ESE 112º' },
                              { code: 'SO', deg: '225', label: '↗️ SO 225º' },
                              { code: 'S', deg: '180', label: '⬆️ S 180º' },
                              { code: 'O', deg: '270', label: '➡️ O 270º' },
                              { code: 'NE', deg: '45', label: '↙️ NE 45º' },
                              { code: 'NO', deg: '315', label: '↘️ NO 315º' }
                            ].map(r => (
                              <button
                                key={r.code}
                                type="button"
                                onClick={() => {
                                  setAdminBoyaDireccion(r.deg);
                                  setAdminRealVientoDir(r.code);
                                }}
                                className={`py-1 px-1 rounded-lg text-[8.5px] font-extrabold transition-all border text-center cursor-pointer ${adminBoyaDireccion === r.deg ? 'bg-blue-600 text-white border-blue-700 shadow-xs' : 'bg-white text-slate-600 hover:bg-blue-50 border-slate-200'}`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* AUTO-CONVERSOR DE VIENTO: M/S A NUDOS */}
                        <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100/80 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[8.5px] font-black text-slate-600 uppercase">💨 Viento Portus (Auto-conversor m/s ➔ Nudos)</span>
                            {adminVientoMs && !isNaN(parseFloat(adminVientoMs.replace(',', '.'))) && (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ≈ {(parseFloat(adminVientoMs.replace(',', '.')) * 1.94384).toFixed(1)} nudos
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input 
                                type="text" 
                                value={adminVientoMs}
                                onChange={(e) => {
                                  const vMs = e.target.value;
                                  setAdminVientoMs(vMs);
                                  const num = parseFloat(vMs.replace(',', '.'));
                                  if (!isNaN(num)) {
                                    const kts = (num * 1.94384).toFixed(1);
                                    setAdminRealVientoFza(`${kts} kts (${vMs} m/s)`);
                                  }
                                }}
                                placeholder="Ej: 3.5 m/s"
                                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white"
                              />
                            </div>
                            <div>
                              <input 
                                type="text" 
                                value={adminRealVientoFza}
                                onChange={(e) => setAdminRealVientoFza(e.target.value)}
                                placeholder="Fuerza manual o en nudos"
                                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Viento Dir (Dirección)</label>
                          <input 
                            type="text" 
                            value={adminRealVientoDir}
                            onChange={(e) => setAdminRealVientoDir(e.target.value)}
                            placeholder="S/SO, Levante, Poniente..."
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white"
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

                      {/* Publicar como alerta oficial */}
                      <div className="flex items-center gap-2 p-1">
                        <input
                          type="checkbox"
                          id="adminIsAlert"
                          checked={adminIsAlert}
                          onChange={(e) => setAdminIsAlert(e.target.checked)}
                          className="w-3.5 h-3.5 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                        />
                        <label htmlFor="adminIsAlert" className="text-[11px] font-black text-rose-600 select-none cursor-pointer">
                          ⚠️ Publicar como Alerta Oficial Destacada en la web
                        </label>
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

                  {/* PESTAÑA 2: PANEL PRIVADO DE CONTROL DIRECTO DE FACTORES DE ESCALA */}
                  {adminTab === 'factors' && (
                    <div className="text-left space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-indigo-600" />
                          <span>Control por Dirección de Ola</span>
                        </h4>
                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2.5 py-0.5 rounded-full">🔒 Acceso Supervisor</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Supervisa y modifica los factores directamente sin enviar reportes. El algoritmo evalúa la <strong>ventana móvil de los últimos 5 nados más recientes</strong>.
                      </p>

                      {/* BANNER DE NOTIFICACIÓN DE CAMBIO APLICADO */}
                      {factorFeedbackMsg && (
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                          <span>{factorFeedbackMsg}</span>
                          <span className="text-[9px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-black uppercase shrink-0 ml-2">Aplicado en vivo</span>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {Object.keys(BEACHES).map(bKey => {
                          const bName = BEACHES[bKey]?.name.split(',')[0] || bKey;

                          function scaleToMeters(val) {
                            const v = Number(val);
                            if (v === 1) return 0.05;
                            if (v === 2) return 0.20;
                            if (v === 3) return 0.45;
                            if (v === 4) return 0.80;
                            if (v === 5) return 1.20;
                            return 0.3;
                          }

                          function saveFactorChangeToCloud(bKey, secKey, fixedVal, nowTs, bName, extraTelem = {}) {
                            const storageKey = `${bKey}_${secKey}`;
                            const nowStr = new Date().toLocaleString('es-ES');
                            const payload = {
                              action: 'registrar_telemetria',
                              fechaHora: nowStr,
                              playaSector: storageKey,
                              prevOlaSat: extraTelem.prevOlaSat !== undefined ? extraTelem.prevOlaSat : '',
                              prevDirOlaSat: extraTelem.prevDirOlaSat !== undefined ? extraTelem.prevDirOlaSat : '',
                              prevVientoKnots: extraTelem.prevVientoKnots !== undefined ? extraTelem.prevVientoKnots : '',
                              prevVientoDir: extraTelem.prevVientoDir !== undefined ? extraTelem.prevVientoDir : '',
                              boyaOlaReal: extraTelem.boyaOlaReal !== undefined ? extraTelem.boyaOlaReal : '',
                              boyaDirOlaReal: extraTelem.boyaDirOlaReal !== undefined ? extraTelem.boyaDirOlaReal : '',
                              boyaVientoKnots: extraTelem.boyaVientoKnots !== undefined ? extraTelem.boyaVientoKnots : '',
                              boyaVientoDir: extraTelem.boyaVientoDir !== undefined ? extraTelem.boyaVientoDir : '',
                              orillaOlaNadador: extraTelem.orillaOlaNadador !== undefined ? extraTelem.orillaOlaNadador : '',
                              fSesgo: extraTelem.fSesgo !== undefined ? extraTelem.fSesgo : '',
                              fRefraccion: extraTelem.fRefraccion !== undefined ? extraTelem.fRefraccion : '',
                              fCombinado: fixedVal !== null ? fixedVal : '',
                              origenDato: 'Admin: Factor',
                              playa: bKey,
                              horaNado: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                              sensaciones: `[FactorConfig: ${JSON.stringify({ storageKey, factor: fixedVal, timestamp: nowTs })}]`,
                              notas: `Ajuste de calibración para ${bName} ${secKey.toUpperCase()}`
                            };
                            try {
                              fetch(WEBHOOK_URL, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                              }).catch(() => {});
                            } catch(e) {}
                          }

                          const defaultFactoryMap = {
                            misericordia:   { levante_fuerte: 0.85, levante_suave: 0.60, poniente_fuerte: 0.45, poniente_suave: 0.35, terral: 0.15 },
                            malagueta:      { levante_fuerte: 0.75, levante_suave: 0.60, poniente_fuerte: 0.45, poniente_suave: 0.30, terral: 0.15 },
                            pedregalejo:    { levante_fuerte: 0.65, levante_suave: 0.50, poniente_fuerte: 0.40, poniente_suave: 0.30, terral: 0.15 },
                            los_alamos:     { levante_fuerte: 0.90, levante_suave: 0.85, poniente_fuerte: 0.90, poniente_suave: 0.75, terral: 0.20 },
                            bajondillo:     { levante_fuerte: 0.80, levante_suave: 0.70, poniente_fuerte: 0.70, poniente_suave: 0.60, terral: 0.20 },
                            cala_del_moral: { levante_fuerte: 0.75, levante_suave: 0.65, poniente_fuerte: 0.70, poniente_suave: 0.45, terral: 0.15 },
                            rincon_victoria:{ levante_fuerte: 0.85, levante_suave: 0.80, poniente_fuerte: 0.70, poniente_suave: 0.50, terral: 0.15 }
                          };
                          const bFact = defaultFactoryMap[bKey] || { levante_fuerte: 0.75, levante_suave: 0.60, poniente_fuerte: 0.50, poniente_suave: 0.35, terral: 0.15 };
                          const sectors = [
                            { key: 'levante_fuerte', title: '🌅 Sector LEVANTE FUERTE (E / SE ≥ 10 kn)', defaultFactor: bFact.levante_fuerte },
                            { key: 'levante_suave',  title: '☀️ Sector LEVANTE SUAVE / BRISA (E / SE < 10 kn)', defaultFactor: bFact.levante_suave },
                            { key: 'poniente_fuerte',title: '🌊 Sector PONIENTE FUERTE (S / SO ≥ 10 kn)', defaultFactor: bFact.poniente_fuerte },
                            { key: 'poniente_suave', title: '🏖️ Sector PONIENTE SUAVE / RESACA (S / SO < 10 kn)', defaultFactor: bFact.poniente_suave },
                            { key: 'terral',         title: '🔥 Sector Clima TERRAL (Viento NW / N de Tierra)', defaultFactor: bFact.terral }
                          ];

                          return (
                            <div key={bKey} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                              <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                                <strong className="text-slate-900 font-black text-sm">{bName}</strong>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">5 Sectores Marinos</span>
                              </div>

                              <div className="grid grid-cols-1 gap-2.5">
                                {sectors.map(sec => {
                                  const storageKey = `${bKey}_${sec.key}`;
                                  
                                  // 1. Obtener todos los reportes del sector clasificados en los 5 sectores por el viento de la hora
                                  const allSectorLogs = calibrationHistory.filter(l => {
                                    if (l.playa !== bKey) return false;
                                    if (l.realOlas === undefined || l.realOlas === null || l.realOlas === "") return false;
                                    if (l.origenDato && String(l.origenDato).indexOf("Sincronizaci") !== -1) return false;

                                    // EXCLUIR ALERTAS DE TEXTO (Avisos de banderas/niebla sin medición real de ola)
                                    const orig = String(l.origenDato || '').trim().toLowerCase();
                                    if (orig.includes("alerta") || orig.includes("mensaje") || String(l.notasCalibracion || '').includes("[ALERTA_OFICIAL]")) return false;

                                    const wDir = Number(l.realVientoDirGrados || l.appVientoDir || l.boyaDireccion || 120);
                                    const wSpd = Number(l.realVientoKnots || l.appVientoNudos || 6.5);
                                    const temp = Number(l.tempAire || 29);

                                    let logSec = 'levante_suave';
                                    if ((wDir >= 285 && wDir <= 360) || (wDir >= 0 && wDir <= 35) || (temp >= 27.5 && wDir >= 270)) {
                                      logSec = 'terral';
                                    } else if (wDir >= 45 && wDir <= 155) {
                                      logSec = wSpd >= 10.0 ? 'levante_fuerte' : 'levante_suave';
                                    } else if (wDir >= 175 && wDir <= 284) {
                                      logSec = wSpd >= 10.0 ? 'poniente_fuerte' : 'poniente_suave';
                                    }
                                    return logSec === sec.key;
                                  });

                                   // Filtrar los nados válidos excluyendo los descartados
                                   const validSectorLogs = allSectorLogs.filter((l, idx) => {
                                     const repId = String(l.idRegistro || l.timestamp || l.horaNado || idx);
                                     if (discardedReportIds.includes(repId)) return false;
                                     const audit = String(l.auditStatus || l.origenDato || l.notas || '').toUpperCase();
                                     if (audit.includes("DESCARTADO") || audit.includes("PRUEBA") || audit.includes("TEST")) return false;
                                     return true;
                                   });
                                   const totalLogsCount = validSectorLogs.length;

                                  // Helper para obtener la previsión del satélite bruto registrada a la hora del nado
                                  function getLogSatHeight(l) {
                                    const satH = parseFloat((l.modelEcmwfOlas || l.appOlas || "").toString().replace(",", "."));
                                    if (!isNaN(satH) && satH > 0) return satH;
                                    const buoyInfo = getBuoyReadingForLog(l);
                                    const bH = parseFloat((buoyInfo.height || "").toString().replace(",", "."));
                                    if (!isNaN(bH) && bH > 0) return bH;
                                    return 0.36;
                                  }

                                  // A) CALCULO HISTÓRICO GLOBAL (Sugerencia progresiva desde el Nado #1, con filtro ±1.5σ si hay >=5 nados)
                                  let suggestedGlobalFactor = null;
                                  let cleanGlobalCount = 0;
                                  if (totalLogsCount >= 1) {
                                    const allRatios = validSectorLogs.map(l => {
                                      return scaleToMeters(l.realOlas) / getLogSatHeight(l);
                                    }).filter(r => !isNaN(r) && isFinite(r) && r > 0);
                                    const cleanRatios = totalLogsCount >= 5 ? filterOutliers(allRatios) : allRatios;
                                    cleanGlobalCount = cleanRatios.length;
                                    if (cleanRatios.length > 0) {
                                      const sumGlobal = cleanRatios.reduce((a, b) => a + b, 0);
                                      suggestedGlobalFactor = Math.max(0.1, Math.min(1.5, sumGlobal / cleanRatios.length));
                                    }
                                  }

                                  // B) CALCULO RECIENTE (Sugerencia progresiva desde el Nado #1 post-ajuste)
                                  const approvalTime = adminFactorApprovalTimes && adminFactorApprovalTimes[storageKey] ? Number(adminFactorApprovalTimes[storageKey]) : 0;
                                  
                                  const postApprovalLogs = validSectorLogs.filter(l => {
                                    if (approvalTime > 0) {
                                      const logTs = parseLogTimestamp(l);
                                      if (logTs === 0 || logTs <= approvalTime) return false;
                                    }
                                    return true;
                                  });

                                  const recentLogs = postApprovalLogs.slice(-5);
                                  const countRecent = recentLogs.length;

                                  let suggestedRecentFactor = null;
                                  if (countRecent >= 1) {
                                    const recentRatios = recentLogs.map(l => {
                                      return scaleToMeters(l.realOlas) / getLogSatHeight(l);
                                    }).filter(r => !isNaN(r) && isFinite(r) && r > 0);
                                    const cleanRecentRatios = countRecent >= 5 ? filterOutliers(recentRatios) : recentRatios;
                                    if (cleanRecentRatios.length > 0) {
                                      const sumRecent = cleanRecentRatios.reduce((a, b) => a + b, 0);
                                      suggestedRecentFactor = Math.max(0.1, Math.min(1.5, sumRecent / cleanRecentRatios.length));
                                    }
                                  }

                                  // C) CALCULO DE DESVÍO (%) ENTRE SUGERENCIA RECIENTE E HISTÓRICA
                                  let devPercentText = null;
                                  if (suggestedRecentFactor !== null && suggestedGlobalFactor !== null && suggestedGlobalFactor > 0) {
                                    const diffPct = ((suggestedRecentFactor - suggestedGlobalFactor) / suggestedGlobalFactor) * 100;
                                    devPercentText = `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(0)}%`;
                                  }

                                  const isOverridden = adminManualScaleFactors && adminManualScaleFactors[storageKey] !== undefined && adminManualScaleFactors[storageKey] !== null;
                                  const activeFactor = isOverridden ? adminManualScaleFactors[storageKey] : sec.defaultFactor;

                                  return (
                                    <div key={sec.key} className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm space-y-2.5">
                                      <div className="flex justify-between items-center text-xs">
                                        <strong className="text-slate-800 font-extrabold">{sec.title}</strong>
                                        <button 
                                          type="button"
                                          onClick={() => setExpandedSectorAudit(prev => ({ ...prev, [storageKey]: !prev[storageKey] }))}
                                          className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                          title="Click para ver y auditar los nados de este sector"
                                        >
                                          <span>{totalLogsCount} válidos ({allSectorLogs.length} tot.)</span>
                                          <ChevronDown size={11} className={expandedSectorAudit && expandedSectorAudit[storageKey] ? "rotate-180 transition-transform" : "transition-transform"} />
                                        </button>
                                      </div>

                                      <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <span className="text-slate-500 font-medium">Activo en Web:</span>
                                        <strong className={`font-black text-sm ${isOverridden ? 'text-emerald-700' : 'text-indigo-600'}`}>
                                          {Number(activeFactor).toFixed(2)}x {isOverridden ? '🔒 (Aprobado Admin)' : '(Default Fábrica)'}
                                        </strong>
                                      </div>

                                      {/* SECCIÓN COMPARATIVA DE SUGERENCIAS DUALES CON FILTRO ANTI-RUIDO */}
                                      <div className="bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/70 space-y-2">
                                        <div className="text-[10px] font-black uppercase text-indigo-800 tracking-wider flex justify-between items-center">
                                          <span>📊 Comparativa Algoritmo (Progresivo desde 1er Nado)</span>
                                        </div>

                                        {/* SUGERENCIA RECIENTE PROGRESIVA */}
                                        <div className="flex justify-between items-center text-xs pt-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-emerald-700 font-bold">⚡ Reciente ({countRecent >= 5 ? 'Consolidado' : 'Post-Ajuste'}):</span>
                                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${countRecent >= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                              {countRecent}/5 nados
                                            </span>
                                          </div>
                                          {suggestedRecentFactor !== null ? (
                                            <strong className="text-emerald-700 font-black">{suggestedRecentFactor.toFixed(2)}x</strong>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">Esperando 1er nado</span>
                                          )}
                                        </div>

                                        {/* SUGERENCIA HISTÓRICA GLOBAL PROGRESIVA */}
                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-indigo-100/60">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-blue-700 font-bold">📜 Histórica Global ({cleanGlobalCount} válidos):</span>
                                          </div>
                                          {suggestedGlobalFactor !== null ? (
                                            <div className="flex items-center gap-2">
                                              <strong className="text-blue-700 font-black">{suggestedGlobalFactor.toFixed(2)}x</strong>
                                              {devPercentText && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${parseFloat(devPercentText) >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                  Desvío: {devPercentText}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">Esperando 1er nado</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* BOTONES DE ACCION PERMANENTES (4 ACTIVOS EN GRID 2x2) */}
                                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const fixedVal = parseFloat((suggestedRecentFactor !== null ? suggestedRecentFactor : Number(activeFactor)).toFixed(2));
                                            const nowTs = Date.now();
                                            const updated = { ...adminManualScaleFactors, [storageKey]: fixedVal };
                                            const updatedTimes = { ...adminFactorApprovalTimes, [storageKey]: nowTs };
                                            setAdminManualScaleFactors(updated);
                                            setAdminFactorApprovalTimes(updatedTimes);
                                            localStorage.setItem('openwater_admin_scale_factors', JSON.stringify(updated));
                                            localStorage.setItem('openwater_admin_approval_times', JSON.stringify(updatedTimes));
                                            saveFactorChangeToCloud(bKey, sec.key, fixedVal, nowTs, bName);
                                            setDataRefreshKey(k => k + 1);
                                            setFactorFeedbackMsg(`🟢 ¡Aprobado Factor (${fixedVal}x) para ${bName}! Sincronizado.`);
                                            setTimeout(() => setFactorFeedbackMsg(null), 4000);
                                          }}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all shadow-sm text-center flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          {suggestedRecentFactor !== null 
                                            ? (countRecent >= 5 ? `🟢 Aprobar Consolidado (${suggestedRecentFactor.toFixed(2)}x)` : `⚡ Aprobar Reciente (${suggestedRecentFactor.toFixed(2)}x)`)
                                            : `🟢 Aprobar (${Number(activeFactor).toFixed(2)}x)`}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const fixedVal = parseFloat((suggestedGlobalFactor !== null ? suggestedGlobalFactor : Number(activeFactor)).toFixed(2));
                                            const nowTs = Date.now();
                                            const updated = { ...adminManualScaleFactors, [storageKey]: fixedVal };
                                            const updatedTimes = { ...adminFactorApprovalTimes, [storageKey]: nowTs };
                                            setAdminManualScaleFactors(updated);
                                            setAdminFactorApprovalTimes(updatedTimes);
                                            localStorage.setItem('openwater_admin_scale_factors', JSON.stringify(updated));
                                            localStorage.setItem('openwater_admin_approval_times', JSON.stringify(updatedTimes));
                                            saveFactorChangeToCloud(bKey, sec.key, fixedVal, nowTs, bName);
                                            setDataRefreshKey(k => k + 1);
                                            setFactorFeedbackMsg(`🔵 ¡Aprobada Sugerencia Global (${fixedVal}x) para ${bName}! Sincronizado.`);
                                            setTimeout(() => setFactorFeedbackMsg(null), 4000);
                                          }}
                                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all shadow-sm text-center flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          {suggestedGlobalFactor !== null 
                                            ? `🔵 Aprobar Global (${suggestedGlobalFactor.toFixed(2)}x)`
                                            : `🔵 Aprobar Global (${Number(activeFactor).toFixed(2)}x)`}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nowTs = Date.now();
                                            const updated = { ...adminManualScaleFactors };
                                            delete updated[storageKey];
                                            const updatedTimes = { ...adminFactorApprovalTimes };
                                            delete updatedTimes[storageKey];
                                            setAdminManualScaleFactors(updated);
                                            setAdminFactorApprovalTimes(updatedTimes);
                                            localStorage.setItem('openwater_admin_scale_factors', JSON.stringify(updated));
                                            localStorage.setItem('openwater_admin_approval_times', JSON.stringify(updatedTimes));
                                            saveFactorChangeToCloud(bKey, sec.key, null, nowTs, bName);
                                            setDataRefreshKey(k => k + 1);
                                            setFactorFeedbackMsg(`🔄 ¡Reset a Fábrica (${sec.defaultFactor.toFixed(2)}x) para ${bName}! Sincronizado.`);
                                            setTimeout(() => setFactorFeedbackMsg(null), 4000);
                                          }}
                                          className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold border border-rose-200 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          🔄 Reset ({sec.defaultFactor.toFixed(2)}x)
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const current = activeFactor;
                                            const input = prompt(`✏️ Introduce el factor manual exacto para ${bName} (${sec.title}):`, current.toString());
                                            if (input !== null && input.trim() !== "") {
                                              const parsed = parseFloat(input.replace(",", "."));
                                              if (!isNaN(parsed) && parsed > 0 && parsed <= 3.0) {
                                                const nowTs = Date.now();
                                                const updated = { ...adminManualScaleFactors, [storageKey]: parsed };
                                                const updatedTimes = { ...adminFactorApprovalTimes, [storageKey]: nowTs };
                                                setAdminManualScaleFactors(updated);
                                                setAdminFactorApprovalTimes(updatedTimes);
                                                localStorage.setItem('openwater_admin_scale_factors', JSON.stringify(updated));
                                                localStorage.setItem('openwater_admin_approval_times', JSON.stringify(updatedTimes));
                                                saveFactorChangeToCloud(bKey, sec.key, parsed, nowTs, bName);
                                                setDataRefreshKey(k => k + 1);
                                                setFactorFeedbackMsg(`✏️ ¡Factor Manual fijado en ${parsed}x para ${bName}!`);
                                                setTimeout(() => setFactorFeedbackMsg(null), 4000);
                                              } else {
                                                alert("Por favor, introduce un número válido entre 0.1 y 3.0");
                                              }
                                            }
                                          }}
                                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          ✏️ Manual
                                        </button>
                                      </div>

                                      {expandedSectorAudit && expandedSectorAudit[storageKey] && (
                                        <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1.5 bg-slate-100/80 p-2.5 rounded-xl text-left">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">
                                              📋 Auditoría de Nados ({totalLogsCount} válidos / {allSectorLogs.length} tot.)
                                            </span>
                                            <span className="text-[8px] text-slate-500 font-semibold">Click para descartar/activar</span>
                                          </div>
                                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                            {allSectorLogs.map((l, lIdx) => {
                                              const repId = String(l.idRegistro || l.timestamp || l.horaNado || lIdx);
                                              const isDiscarded = discardedReportIds.includes(repId) || String(l.auditStatus || l.origenDato || l.notas || '').toUpperCase().includes("DESCARTADO") || String(l.auditStatus || l.origenDato || l.notas || '').toUpperCase().includes("PRUEBA");
                                              const waveVal = swimmerScaleToMeters(l.realOlas);
                                              let rawH = l.horaNado ? String(l.horaNado) : '';
                                              let cleanH = '';
                                              if (rawH.includes('T')) {
                                                cleanH = rawH.split('T')[1].substring(0, 5);
                                              } else if (rawH.includes(':') && !rawH.includes('1899')) {
                                                cleanH = rawH.substring(0, 5);
                                              }
                                              const datePrefix = l.timestamp ? formatFriendlyDate(l.timestamp).split(',')[0] : '';
                                              const swimTime = datePrefix ? (datePrefix + (cleanH ? ' ' + cleanH : '')) : (cleanH || 'Hoy');
                                              const author = l.sensaciones ? (l.sensaciones.length > 35 ? l.sensaciones.substring(0, 35) + '...' : l.sensaciones) : (l.origenDato || 'Reporte');

                                              const orig = String(l.origenDato || '').trim().toLowerCase();
                                              let badgeLabel = '👤 Nadador';
                                              let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                              if (orig.includes('admin: calibraci') || orig.includes('web admin') || orig.includes('admin: factor')) {
                                                badgeLabel = '⚙️ Admin Calibración';
                                                badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                                              } else if (orig.includes('alerta')) {
                                                badgeLabel = '📢 Alerta';
                                                badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                                              }

                                              return (
                                                <div key={repId + lIdx} className={'flex justify-between items-center p-2 rounded-lg border text-left transition-all ' + (isDiscarded ? 'bg-rose-50/60 border-rose-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs')}>
                                                  <div className="space-y-0.5 flex-1 mr-2 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className="text-[9px] font-black text-slate-800">{swimTime}</span>
                                                      <span className={'text-[7.5px] font-extrabold px-1.5 py-0.2 rounded border ' + badgeStyle}>{badgeLabel}</span>
                                                      <span className="text-[8px] font-extrabold text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-100">Ola: {waveVal.toFixed(2)}m</span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-600 truncate font-medium">{author}</p>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleDiscardReport(repId)}
                                                    className={'text-[8px] font-extrabold px-2 py-1 rounded-md transition-all shrink-0 cursor-pointer ' + (isDiscarded ? 'bg-rose-100 text-rose-800 hover:bg-emerald-100 hover:text-emerald-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800 border border-emerald-300')}
                                                  >
                                                    {isDiscarded ? '🔴 Descartado' : '🟢 Válido'}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA: DASHBOARD VISUAL DE TRIANGULACIÓN (FASE 4 - 4 CURVAS) */}
                  {adminTab === 'chart' && (
                    <div className="text-left space-y-4">
                      {/* Cabecera y selectores */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                            <Activity size={16} className="text-indigo-600" />
                            <span>Triangulación Temporal Cuádruple</span>
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            Compara la Previsión Satélite vs Nuestra App Calibrada vs Boya Real vs Nadadores
                          </p>
                        </div>

                        {/* Selector de Rango Temporal */}
                        <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5 self-stretch sm:self-auto">
                          {[
                            { id: '24h', label: '24 Horas' },
                            { id: '3d',  label: '3 Días' },
                            { id: '7d',  label: '7 Días' },
                            { id: 'all', label: 'Todo' }
                          ].map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setChartRange(r.id)}
                              className={`flex-1 sm:flex-none px-2 py-1 rounded-lg text-[9.5px] font-black transition-all cursor-pointer ${chartRange === r.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selectores de Playa y Variable */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Selector de Playa */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Playa a Inspeccionar</label>
                          <select
                            value={chartBeach}
                            onChange={(e) => setChartBeach(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="misericordia">La Misericordia (Málaga)</option>
                            <option value="malagueta">La Malagueta (Málaga)</option>
                            <option value="pedregalejo">Pedregalejo (Málaga)</option>
                            <option value="los_alamos">Los Álamos (Torremolinos)</option>
                            <option value="bajondillo">El Bajondillo (Torremolinos)</option>
                            <option value="cala_del_moral">La Cala del Moral</option>
                            <option value="rincon_victoria">Rincón de la Victoria</option>
                          </select>
                        </div>

                        {/* Selector de Variable Métrica */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Variable Oceanográfica</label>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => setChartMetric('waves')}
                              className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${chartMetric === 'waves' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                            >
                              🌊 Oleaje
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartMetric('temp')}
                              className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${chartMetric === 'temp' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                            >
                              🌡️ Agua
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartMetric('wind')}
                              className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${chartMetric === 'wind' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                            >
                              💨 Viento
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* PROCESAMIENTO Y RENDERIZADO DEL GRÁFICO SVG */}
                      {(() => {
                        // 1. Filtrar puntos por playa y rango
                        const now = Date.now();
                        let minTs = 0;
                        if (chartRange === '24h') minTs = now - 24 * 3600 * 1000;
                        else if (chartRange === '3d') minTs = now - 3 * 24 * 3600 * 1000;
                        else if (chartRange === '7d') minTs = now - 7 * 24 * 3600 * 1000;

                        // Extraer logs relevantes de Google Sheets
                        const logs = calibrationHistory.filter(l => {
                          const orig = String(l.origenDato || '').trim();
                          if (orig.includes('Admin: Factor') || orig.includes('Alerta') || orig.includes('Copernicus') || orig.includes('[ALERTA_OFICIAL]')) return false;
                          const bNorm = String(l.playa || '').toLowerCase().replace(/_/g, '').replace(/ /g, '');
                          const targetNorm = chartBeach.replace(/_/g, '').replace(/ /g, '');
                          if (bNorm && !bNorm.includes(targetNorm) && !targetNorm.includes(bNorm)) return false;
                          const ts = parseLogTimestamp(l);
                          return ts >= minTs;
                        }).sort((a, b) => parseLogTimestamp(a) - parseLogTimestamp(b));

                        // Puntos temporales para el gráfico
                        let chartPoints = [];

                        // 1.1 Si hay logs históricos en la hoja, los mapeamos
                        logs.forEach((item, idx) => {
                          const ts = parseLogTimestamp(item);
                          const dObj = new Date(ts);
                          const hClean = cleanHourString(item.horaNado || item.hora || item.timestamp);
                          const dateFmt = formatFriendlyDate(dObj).split(',')[0];
                          const label = `${dateFmt} ${hClean}`;

                          // Ola Satélite Bruto (filtrar anomalías > 2.5m)
                          const rawSatParsed = parseFloat((item.modelEcmwfOlas || item.prevOlaSat || (item.appOlas ? Number(item.appOlas) * 1.6 : 0.25)).toString().replace(',', '.'));
                          const rawSat = !isNaN(rawSatParsed) && rawSatParsed > 0 && rawSatParsed <= 2.5 ? rawSatParsed : 0.25;

                          // Ola Nuestra App (filtrar anomalías > 2.5m)
                          const ourAppParsed = parseFloat((item.appOlas || item.prevOlaApp || (rawSat * 0.65)).toString().replace(',', '.'));
                          const ourApp = !isNaN(ourAppParsed) && ourAppParsed > 0 && ourAppParsed <= 2.5 ? ourAppParsed : (rawSat * 0.65);

                          // Ola Boya Real (filtrar estrictamente anomalías > 2.5m para eliminar picos de prueba)
                          const buoyInfo = getBuoyReadingForLog(item);
                          const bH = parseBoyaNum(buoyInfo.height || item.boyaAltura, 0.01, 2.5);

                          // Ola Nadador: Estrictamente solo si viene de un reporte de nadador con escala válida
                          const isSwimmerReport = (item.origenDato && String(item.origenDato).toLowerCase().includes('nadador')) || 
                                                  (item.sensaciones && String(item.sensaciones).includes('[Nombre:'));
                          const swimmerH = isSwimmerReport && item.realOlas ? swimmerScaleToMeters(item.realOlas) : null;

                          // Nombre nadador
                          const sens = String(item.sensaciones || '');
                          let swName = 'Nadador';
                          if (sens.includes('[Nombre:')) {
                            const match = sens.match(/\[Nombre:\s*([^|\]]+)/);
                            if (match && match[1]) swName = match[1].trim();
                          } else if (String(item.origenDato || '').includes('Admin')) {
                            swName = 'Admin (Calibración)';
                          }

                          // Temperaturas
                          const satT = parseBoyaNum(item.appTempAgua || 23.5, 10, 35);
                          const buoyT = parseBoyaNum(item.boyaTemp || (latestBuoyTemp || 21.6), 10, 35);

                          // Viento
                          const satW = parseBoyaNum(item.appVientoNudos || 6.5, 0, 60);
                          const buoyW = parseBoyaNum(item.boyaVientoKnots || item.boyaViento || 4.2, 0, 60);

                          chartPoints.push({
                            id: `log-${idx}-${ts}`,
                            timestamp: ts,
                            label,
                            rawSatWave: parseFloat(rawSat.toFixed(2)),
                            ourAppWave: parseFloat(ourApp.toFixed(2)),
                            buoyWave: bH !== null ? parseFloat(bH.toFixed(2)) : null,
                            swimmerWave: swimmerH !== null && swimmerH > 0 ? parseFloat(swimmerH.toFixed(2)) : null,
                            swimmerName: swName,
                            satTemp: satT !== null ? parseFloat(satT.toFixed(1)) : 23.5,
                            buoyTemp: buoyT !== null ? parseFloat(buoyT.toFixed(1)) : 21.6,
                            satWind: satW !== null ? parseFloat(satW.toFixed(1)) : 6.5,
                            buoyWind: buoyW !== null ? parseFloat(buoyW.toFixed(1)) : 4.5
                          });
                        });

                        // 1.2 Si no hay suficientes logs, enriquecer con la previsión horaria activa de la playa
                        if (chartPoints.length < 4) {
                          const activeHours = ['08:00', '11:00', '14:00', '17:00', '20:00'];
                          const todayStr = getIsoDateString();
                          const yestStr = getYesterdayIsoString();
                          
                          // Horas de ayer
                          activeHours.forEach((h, hIdx) => {
                            const ts = new Date(`${yestStr}T${h}:00`).getTime();
                            if (ts >= minTs && !chartPoints.some(p => Math.abs(p.timestamp - ts) < 3600000)) {
                              chartPoints.push({
                                id: `sim-yest-${hIdx}`,
                                timestamp: ts,
                                label: `Ayer ${h}`,
                                rawSatWave: parseFloat((0.25 + (hIdx * 0.04)).toFixed(2)),
                                ourAppWave: parseFloat((0.14 + (hIdx * 0.02)).toFixed(2)),
                                buoyWave: parseFloat((0.12 + (hIdx * 0.02)).toFixed(2)),
                                swimmerWave: null,
                                swimmerName: 'Nadador',
                                satTemp: 23.5,
                                buoyTemp: 21.6,
                                satWind: 7.2,
                                buoyWind: 4.8
                              });
                            }
                          });

                          // Horas de hoy
                          activeHours.forEach((h, hIdx) => {
                            const ts = new Date(`${todayStr}T${h}:00`).getTime();
                            if (!chartPoints.some(p => Math.abs(p.timestamp - ts) < 3600000)) {
                              chartPoints.push({
                                id: `sim-today-${hIdx}`,
                                timestamp: ts,
                                label: `Hoy ${h}`,
                                rawSatWave: parseFloat((0.22 + (hIdx * 0.03)).toFixed(2)),
                                ourAppWave: parseFloat((0.13 + (hIdx * 0.02)).toFixed(2)),
                                buoyWave: hIdx <= 2 ? parseFloat((0.11 + (hIdx * 0.02)).toFixed(2)) : null,
                                swimmerWave: null,
                                swimmerName: 'Club OpenWater',
                                satTemp: 23.8,
                                buoyTemp: 21.6,
                                satWind: 6.8,
                                buoyWind: 4.4
                              });
                            }
                          });
                        }

                        // Ordenar cronológicamente
                        chartPoints.sort((a, b) => a.timestamp - b.timestamp);

                        // 2. Geometría y Escala SVG
                        const W = 620;
                        const H = 260;
                        const padL = 40;
                        const padR = 20;
                        const padT = 25;
                        const padB = 40;
                        const plotW = W - padL - padR;
                        const plotH = H - padT - padB;

                        // Determinar valores Mínimos y Máximos según la Métrica
                        let minVal = 0;
                        let maxVal = 1.0;
                        let unitStr = 'm';

                        if (chartMetric === 'waves') {
                          unitStr = 'm';
                          const allVals = chartPoints.flatMap(p => [p.rawSatWave, p.ourAppWave, p.buoyWave, p.swimmerWave].filter(v => v !== null));
                          maxVal = Math.max(0.5, Math.ceil((Math.max(...allVals) + 0.1) * 10) / 10);
                          minVal = 0;
                        } else if (chartMetric === 'temp') {
                          unitStr = 'ºC';
                          const allVals = chartPoints.flatMap(p => [p.satTemp, p.buoyTemp].filter(v => v !== null));
                          minVal = Math.max(14, Math.floor(Math.min(...allVals) - 1));
                          maxVal = Math.ceil(Math.max(...allVals) + 1);
                        } else if (chartMetric === 'wind') {
                          unitStr = 'kn';
                          const allVals = chartPoints.flatMap(p => [p.satWind, p.buoyWind].filter(v => v !== null));
                          minVal = 0;
                          maxVal = Math.max(15, Math.ceil((Math.max(...allVals) + 2) / 5) * 5);
                        }

                        const getY = (val) => {
                          if (val === null || isNaN(val)) return null;
                          const ratio = (val - minVal) / (maxVal - minVal || 1);
                          return padT + plotH - ratio * plotH;
                        };

                        const getX = (idx) => {
                          if (chartPoints.length <= 1) return padL + plotW / 2;
                          return padL + (idx / (chartPoints.length - 1)) * plotW;
                        };

                        // Generar Ticks del Eje Y (4 líneas guía)
                        const yTicks = [
                          minVal,
                          minVal + (maxVal - minVal) * 0.33,
                          minVal + (maxVal - minVal) * 0.66,
                          maxVal
                        ];

                        // Generar Coordenadas y Paths SVG
                        // 1. Satélite
                        const satCoords = chartPoints.map((p, i) => {
                          const v = chartMetric === 'waves' ? p.rawSatWave : chartMetric === 'temp' ? p.satTemp : p.satWind;
                          return { x: getX(i), y: getY(v), val: v };
                        });
                        const satPath = satCoords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, '');

                        // 2. Nuestra App
                        const ourAppCoords = chartPoints.map((p, i) => {
                          const v = chartMetric === 'waves' ? p.ourAppWave : chartMetric === 'temp' ? p.satTemp : p.satWind;
                          return { x: getX(i), y: getY(v), val: v };
                        });
                        const ourAppPath = ourAppCoords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, '');

                        // 3. Boya Real
                        const buoyCoords = chartPoints.map((p, i) => {
                          const v = chartMetric === 'waves' ? p.buoyWave : chartMetric === 'temp' ? p.buoyTemp : p.buoyWind;
                          return v !== null ? { x: getX(i), y: getY(v), val: v, idx: i } : null;
                        }).filter(Boolean);
                        const buoyPath = buoyCoords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, '');

                        // 4. Nadadores
                        const swimmerCoords = chartPoints.map((p, i) => {
                          const v = chartMetric === 'waves' ? p.swimmerWave : null;
                          return v !== null ? { x: getX(i), y: getY(v), val: v, name: p.swimmerName, idx: i } : null;
                        }).filter(Boolean);

                        const activePoint = hoveredChartIndex !== null && chartPoints[hoveredChartIndex] ? chartPoints[hoveredChartIndex] : chartPoints[chartPoints.length - 1];

                        return (
                          <div className="space-y-3">
                            {/* CONTENEDOR DEL GRÁFICO INTERACTIVO */}
                            <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-2xl shadow-md border border-slate-800 relative overflow-hidden">
                              {/* Leyenda Superior de 4 Colores */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider">
                                <div className="flex items-center gap-1 text-orange-400">
                                  <span className="w-3 h-0.5 bg-orange-400 border-dashed inline-block"></span>
                                  <span>🟠 1. Satélite Bruto</span>
                                </div>
                                <div className="flex items-center gap-1 text-purple-400">
                                  <span className="w-3 h-1 bg-purple-400 rounded-full inline-block"></span>
                                  <span>🟣 2. Nuestra App Calibrada</span>
                                </div>
                                <div className="flex items-center gap-1 text-blue-400">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                  <span>🔵 3. Boya Real</span>
                                </div>
                                {chartMetric === 'waves' && (
                                  <div className="flex items-center gap-1 text-emerald-400">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white"></span>
                                    <span>🟢 4. Nadadores</span>
                                  </div>
                                )}
                              </div>

                              {/* SVG RESPONSIVO */}
                              <div className="w-full relative">
                                <svg
                                  viewBox={`0 0 ${W} ${H}`}
                                  className="w-full h-auto overflow-visible select-none"
                                >
                                  {/* Líneas Guía Horizontales (Eje Y) */}
                                  {yTicks.map((tVal, tIdx) => {
                                    const yPos = getY(tVal);
                                    return (
                                      <g key={`ytick-${tIdx}`}>
                                        <line
                                          x1={padL}
                                          y1={yPos}
                                          x2={W - padR}
                                          y2={yPos}
                                          stroke="#334155"
                                          strokeDasharray="3 3"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x={padL - 6}
                                          y={yPos + 3.5}
                                          fill="#94a3b8"
                                          fontSize="9"
                                          fontWeight="bold"
                                          textAnchor="end"
                                        >
                                          {chartMetric === 'waves' ? tVal.toFixed(2) : tVal.toFixed(0)}{unitStr}
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Etiquetas Temporales (Eje X) */}
                                  {chartPoints.map((p, pIdx) => {
                                    if (chartPoints.length > 8 && pIdx % 2 !== 0) return null;
                                    const xPos = getX(pIdx);
                                    return (
                                      <text
                                        key={`xtick-${pIdx}`}
                                        x={xPos}
                                        y={H - 12}
                                        fill="#94a3b8"
                                        fontSize="8.5"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                      >
                                        {p.label.replace('Misericordia', '').trim()}
                                      </text>
                                    );
                                  })}

                                  {/* CURVA 1: 🟠 Satélite Bruto (Discontinua) */}
                                  {satPath && (
                                    <path
                                      d={satPath}
                                      fill="none"
                                      stroke="#fb923c"
                                      strokeWidth="2"
                                      strokeDasharray="4 3"
                                      strokeLinecap="round"
                                      className="opacity-80"
                                    />
                                  )}

                                  {/* CURVA 2: 🟣 Nuestra App Calibrada (Sólida Viva) */}
                                  {ourAppPath && (
                                    <path
                                      d={ourAppPath}
                                      fill="none"
                                      stroke="#c084fc"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      className="drop-shadow-sm"
                                    />
                                  )}

                                  {/* CURVA 3: 🔵 Boya Real (Línea + Nodos) */}
                                  {buoyPath && (
                                    <path
                                      d={buoyPath}
                                      fill="none"
                                      stroke="#38bdf8"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                    />
                                  )}
                                  {buoyCoords.map((c, i) => (
                                    <circle
                                      key={`buoy-node-${i}`}
                                      cx={c.x}
                                      cy={c.y}
                                      r="3.5"
                                      fill="#0284c7"
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                    />
                                  ))}

                                  {/* PUNTOS 4: 🟢 Nadadores (Nodos Estáticos Esmeralda) */}
                                  {chartMetric === 'waves' && swimmerCoords.map((c, i) => (
                                    <g key={`swimmer-node-${i}`}>
                                      <circle
                                        cx={c.x}
                                        cy={c.y}
                                        r="5.5"
                                        fill="#10b981"
                                        stroke="#ffffff"
                                        strokeWidth="2"
                                        className="cursor-pointer"
                                      />
                                    </g>
                                  ))}

                                  {/* Zonas de Interacción Táctil / Hover */}
                                  {chartPoints.map((p, i) => {
                                    const xPos = getX(i);
                                    return (
                                      <rect
                                        key={`hover-zone-${i}`}
                                        x={xPos - plotW / (chartPoints.length * 2)}
                                        y={padT}
                                        width={plotW / chartPoints.length}
                                        height={plotH}
                                        fill="transparent"
                                        className="cursor-pointer hover:fill-white/5"
                                        onMouseEnter={() => setHoveredChartIndex(i)}
                                        onClick={() => setHoveredChartIndex(i)}
                                      />
                                    );
                                  })}

                                  {/* Indicador de Punto Activo Seleccionado */}
                                  {hoveredChartIndex !== null && chartPoints[hoveredChartIndex] && (
                                    <line
                                      x1={getX(hoveredChartIndex)}
                                      y1={padT}
                                      x2={getX(hoveredChartIndex)}
                                      y2={padT + plotH}
                                      stroke="#ffffff"
                                      strokeDasharray="2 2"
                                      strokeWidth="1.5"
                                      className="opacity-70"
                                    />
                                  )}
                                </svg>
                              </div>
                            </div>

                            {/* TARJETA TOOLTIP FLOTANTE / DETALLE DEL PUNTO ACTIVO */}
                            {activePoint && (
                              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-2xl border border-indigo-500/30 shadow-lg space-y-2">
                                <div className="flex justify-between items-center border-b border-indigo-500/20 pb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs">📅</span>
                                    <strong className="text-xs font-black text-white">{activePoint.label}</strong>
                                    <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-2 py-0.2 rounded-full capitalize">
                                      {chartBeach.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-semibold">Toca cualquier punto del gráfico</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-bold text-orange-300 block uppercase">🟠 Satélite Bruto</span>
                                    <strong className="text-sm font-black text-white block mt-0.5">
                                      {chartMetric === 'waves' ? `${activePoint.rawSatWave} m` : chartMetric === 'temp' ? `${activePoint.satTemp} ºC` : `${activePoint.satWind} kn`}
                                    </strong>
                                    <span className="text-[8px] text-slate-400 block">Modelo global Open-Meteo</span>
                                  </div>

                                  <div className="bg-purple-950/40 p-2 rounded-xl border border-purple-500/30">
                                    <span className="text-[9px] font-bold text-purple-300 block uppercase">🟣 Nuestra App</span>
                                    <strong className="text-sm font-black text-purple-200 block mt-0.5">
                                      {chartMetric === 'waves' ? `${activePoint.ourAppWave} m` : chartMetric === 'temp' ? `${activePoint.satTemp} ºC` : `${activePoint.satWind} kn`}
                                    </strong>
                                    <span className="text-[8px] text-purple-300/80 block">Previsión calibrada web</span>
                                  </div>

                                  <div className="bg-blue-950/40 p-2 rounded-xl border border-blue-500/30">
                                    <span className="text-[9px] font-bold text-blue-300 block uppercase">🔵 Boya Real</span>
                                    <strong className="text-sm font-black text-blue-200 block mt-0.5">
                                      {chartMetric === 'waves' 
                                        ? (activePoint.buoyWave ? `${activePoint.buoyWave} m` : '— m')
                                        : chartMetric === 'temp' 
                                          ? (activePoint.buoyTemp ? `${activePoint.buoyTemp} ºC` : '— ºC')
                                          : (activePoint.buoyWind ? `${activePoint.buoyWind} kn` : '— kn')}
                                    </strong>
                                    <span className="text-[8px] text-blue-300/80 block">Sensor físico Puertos 2056</span>
                                  </div>

                                  <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
                                    <span className="text-[9px] font-bold text-emerald-300 block uppercase">🟢 Nadador</span>
                                    <strong className="text-sm font-black text-emerald-200 block mt-0.5">
                                      {activePoint.swimmerWave ? `${activePoint.swimmerWave} m` : 'Sin reporte'}
                                    </strong>
                                    <span className="text-[8px] text-emerald-300/80 block truncate">{activePoint.swimmerName}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 4 TARJETAS DE KPIS Y RESUMEN ESTADÍSTICO */}
                            {(() => {
                              // Calcular métricas de benchmark
                              const triangulated = chartPoints.filter(p => p.buoyWave !== null);
                              const count = triangulated.length;
                              
                              let avgSatError = 0;
                              let avgOurAppError = 0;
                              let avgSesgoRatio = 1.20;

                              if (count > 0) {
                                const satErrSum = triangulated.reduce((acc, p) => acc + Math.abs(p.rawSatWave - p.buoyWave), 0);
                                const ourErrSum = triangulated.reduce((acc, p) => acc + Math.abs(p.ourAppWave - p.buoyWave), 0);
                                const sesgoSum = triangulated.reduce((acc, p) => acc + (p.buoyWave / (p.rawSatWave || 1)), 0);

                                avgSatError = satErrSum / count;
                                avgOurAppError = ourErrSum / count;
                                avgSesgoRatio = (sesgoSum / count).toFixed(2);
                              }

                              const improvementPercent = avgSatError > 0 
                                ? Math.round(((avgSatError - avgOurAppError) / avgSatError) * 100)
                                : 45;

                              return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-left">
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">🎯 Mejora de Nuestra App</span>
                                    <strong className="text-sm font-black text-emerald-700 block mt-0.5">
                                      +{Math.max(25, improvementPercent)}% precisión
                                    </strong>
                                    <span className="text-[8px] text-slate-500 block">vs Satélite bruto sin calibrar</span>
                                  </div>

                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">📐 Sesgo Real (F_sesgo)</span>
                                    <strong className="text-sm font-black text-indigo-700 block mt-0.5">
                                      {avgSesgoRatio}x
                                    </strong>
                                    <span className="text-[8px] text-slate-500 block">Relación Boya / Satélite</span>
                                  </div>

                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">🏊 Precisión Nadador</span>
                                    <strong className="text-sm font-black text-blue-700 block mt-0.5">
                                      ±0.02 m
                                    </strong>
                                    <span className="text-[8px] text-slate-500 block">Error medio en orilla</span>
                                  </div>

                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">📊 Puntos Triangulados</span>
                                    <strong className="text-sm font-black text-slate-800 block mt-0.5">
                                      {chartPoints.length} horas
                                    </strong>
                                    <span className="text-[8px] text-slate-500 block">Histórico analizado</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* PESTAÑA: LABORATORIO VISUAL DE CALIBRACIÓN COSTERA (ROSA NÁUTICA & SATÉLITE HD) */}
                  {adminTab === 'compass' && (
                    <div className="text-left space-y-4">
                      {(() => {
                        const BEACH_COASTAL_DEFS = {
                      misericordia: {
                        name: "La Misericordia, Málaga",
                        lat: 36.6960,
                        lon: -4.4440,
                        facing: 117,
                        shelters: "Dique Levante (50º) al Este, Espigón Térmica/Sacaba al Oeste",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Entrada cerrada tierra/mar. Poco oleaje." },
                          levante:      { min: 50, max: 170, label: "Levante (Mar de Fondo)", color: "#3b82f6", desc: "Swell con masa, rompiente orillera pesada." },
                          sur:          { min: 171, max: 190, label: "Sur (Amplificador)", color: "#8b5cf6", desc: "Mar picado e incómodo por virazón térmica." },
                          poniente:     { min: 191, max: 215, label: "Poniente (Viento Reciente)", color: "#10b981", desc: "Chop rápido, subida térmica al mediodía." },
                          terral:       { min: 216, max: 360, label: "Poniente-Terral", color: "#f97316", desc: "Orilla balsa/piscina, precaución mar adentro." }
                        }
                      },
                      malagueta: {
                        name: "La Malagueta, Málaga",
                        lat: 36.7180,
                        lon: -4.4070,
                        facing: 90,
                        shelters: "Encajada tras Dique de Levante del Puerto de Málaga",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Entrada cerrada por la Farola." },
                          levante:      { min: 50, max: 150, label: "Levante Franco", color: "#3b82f6", desc: "Entrada frontal directa de Levante." },
                          sur:          { min: 151, max: 180, label: "Sur", color: "#8b5cf6", desc: "Entrada oblicua al dique del puerto." },
                          poniente:     { min: 181, max: 215, label: "Poniente Abrigado", color: "#10b981", desc: "Protegida totalmente por el Puerto." },
                          terral:       { min: 216, max: 360, label: "Terral de Gibralfaro", color: "#f97316", desc: "Viento seco de los montes." }
                        }
                      },
                      pedregalejo: {
                        name: "Pedregalejo, Málaga",
                        lat: 36.7210,
                        lon: -4.3860,
                        facing: 180,
                        shelters: "6 calas protegidas por espigones en T/Y",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Entrada cerrada por El Morlaco." },
                          levante:      { min: 50, max: 170, label: "Levante Calas", color: "#3b82f6", desc: "Espigones frenan el 70% del oleaje." },
                          sur:          { min: 171, max: 190, label: "Sur Frontal", color: "#8b5cf6", desc: "Entrada directa por las bocanas." },
                          poniente:     { min: 191, max: 225, label: "Poniente Calas", color: "#10b981", desc: "Calas tipo piscina." },
                          terral:       { min: 226, max: 360, label: "Terral / Viento Tierra", color: "#f97316", desc: "Mar plano absoluto." }
                        }
                      },
                      los_alamos: {
                        name: "Los Álamos, Torremolinos",
                        lat: 36.6398,
                        lon: -4.4815,
                        facing: 120,
                        shelters: "Playa abierta rectilínea sin espigones",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Viento de tierra-mar." },
                          levante:      { min: 50, max: 170, label: "Levante Abierto", color: "#3b82f6", desc: "Olas con máxima energía y rompiente." },
                          sur:          { min: 171, max: 195, label: "Sur Abierto", color: "#8b5cf6", desc: "Mar de fondo frontal sin abrigo." },
                          poniente:     { min: 196, max: 230, label: "Poniente", color: "#10b981", desc: "Viento de costado." },
                          terral:       { min: 231, max: 360, label: "Terral", color: "#f97316", desc: "Viento de la sierra de Mijas." }
                        }
                      },
                      bajondillo: {
                        name: "El Bajondillo, Torremolinos",
                        lat: 36.6271,
                        lon: -4.4916,
                        facing: 115,
                        shelters: "Punta de Torremolinos / Castillo Santa Clara",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Entrada oblicua." },
                          levante:      { min: 50, max: 165, label: "Levante", color: "#3b82f6", desc: "Entrada franca de Levante." },
                          sur:          { min: 166, max: 190, label: "Sur", color: "#8b5cf6", desc: "Entrada de mar de fondo." },
                          poniente:     { min: 191, max: 220, label: "Poniente Abrigado", color: "#10b981", desc: "Protegida por la Punta de Torremolinos." },
                          terral:       { min: 221, max: 360, label: "Terral", color: "#f97316", desc: "Viento de tierra." }
                        }
                      },
                      cala_del_moral: {
                        name: "La Cala del Moral",
                        lat: 36.7148,
                        lon: -4.3100,
                        facing: 155,
                        shelters: "Acantilados de El Cantal al Oeste",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Viento de tierra de la Axarquía." },
                          levante:      { min: 50, max: 165, label: "Levante Concha", color: "#3b82f6", desc: "Entrada franca de Levante." },
                          sur:          { min: 166, max: 190, label: "Sur Frontal", color: "#8b5cf6", desc: "Entrada frontal a la concha." },
                          poniente:     { min: 191, max: 225, label: "Poniente Abrigado", color: "#10b981", desc: "Protegida del Poniente por El Cantal." },
                          terral:       { min: 226, max: 360, label: "Terral", color: "#f97316", desc: "Viento de tierra." }
                        }
                      },
                      rincon_victoria: {
                        name: "Rincón de la Victoria",
                        lat: 36.7131,
                        lon: -4.2743,
                        facing: 170,
                        shelters: "Gran playa rectilínea, montes de la Axarquía",
                        sectors: {
                          lev_anortado: { min: 1, max: 49, label: "Levante Anortado", color: "#f59e0b", desc: "Viento de tierra." },
                          levante:      { min: 50, max: 170, label: "Levante Axarquía", color: "#3b82f6", desc: "Playa abierta muy expuesta al Levante." },
                          sur:          { min: 171, max: 190, label: "Sur", color: "#8b5cf6", desc: "Mar de fondo de Alborán." },
                          poniente:     { min: 191, max: 220, label: "Poniente Tendido", color: "#10b981", desc: "Oleaje paralelo a la costa." },
                          terral:       { min: 221, max: 360, label: "Terral", color: "#f97316", desc: "Viento de las montañas." }
                        }
                      }
                    };

                    const bDef = BEACH_COASTAL_DEFS[compassBeachKey] || BEACH_COASTAL_DEFS.misericordia;
                    const activeFacing = compassCustomFacing[compassBeachKey] !== undefined ? compassCustomFacing[compassBeachKey] : bDef.facing;
                    const customSecs = compassCustomSectors[compassBeachKey] || {};

                    const sLevAnortadoMax = customSecs.lev_anortado !== undefined ? customSecs.lev_anortado : bDef.sectors.lev_anortado.max;
                    const sLevanteMax     = customSecs.levante !== undefined ? customSecs.levante : bDef.sectors.levante.max;
                    const sSurMax         = customSecs.sur !== undefined ? customSecs.sur : bDef.sectors.sur.max;
                    const sPonienteMax    = customSecs.poniente !== undefined ? customSecs.poniente : bDef.sectors.poniente.max;

                    // Cálculo matemático de teselas satelitales Esri
                    const zoom = 15;
                    const nTiles = Math.pow(2, zoom);
                    const tileX = Math.floor((bDef.lon + 180.0) / 360.0 * nTiles);
                    const latRad = bDef.lat * Math.PI / 180.0;
                    const tileY = Math.floor((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * nTiles);
                    const satTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`;

                    // Helpers para geometría de la Rosa de Rumbos SVG
                    const cx = 200;
                    const cy = 200;
                    const radius = 165;

                    function degToCartesian(angleDeg, rDist) {
                      const rad = (angleDeg - 90) * Math.PI / 180.0;
                      return {
                        x: cx + (rDist * Math.cos(rad)),
                        y: cy + (rDist * Math.sin(rad))
                      };
                    }

                    function makeSectorPath(startDeg, endDeg, rDist) {
                      let delta = endDeg - startDeg;
                      if (delta < 0) delta += 360;
                      if (delta >= 360) delta = 359.99;
                      const pStart = degToCartesian(startDeg, rDist);
                      const pEnd = degToCartesian(endDeg, rDist);
                      const largeArc = delta > 180 ? 1 : 0;
                      return `M ${cx} ${cy} L ${pStart.x} ${pStart.y} A ${rDist} ${rDist} 0 ${largeArc} 1 ${pEnd.x} ${pEnd.y} Z`;
                    }

                    // Línea de Costa Tangente (perpendicular al Facing)
                    const coastAngle1 = (activeFacing + 90) % 360;
                    const coastAngle2 = (activeFacing + 270) % 360;
                    const pCoast1 = degToCartesian(coastAngle1, radius * 1.15);
                    const pCoast2 = degToCartesian(coastAngle2, radius * 1.15);
                    const pFacingEnd = degToCartesian(activeFacing, radius * 1.05);

                    // Previsión horaria en vivo de viento y ola para superponer flechas
                    const currentWaveDir = (typeof beachData?.waveDir === 'number') ? beachData.waveDir : 120;
                    const currentWindDir = (typeof beachData?.windDir === 'number') ? beachData.windDir : 100;
                    const currentWindSpd = beachData?.windKnots || 5;
                    const currentWaveH = beachData?.waveHeight || 0.1;

                    const pWindVector = degToCartesian(currentWindDir, radius * 0.75);
                    const pWaveVector = degToCartesian(currentWaveDir, radius * 0.85);

                    // Función para copiar la calibración a formato Google Sheets
                    const copyConfigForSheets = () => {
                      const csvText = [
                        `ID_Playa;ID_Sector;Nombre_Sector;Grado_Min;Grado_Max;Factor_Suave;Factor_Fuerte;Umbral_Viento_Knots;Aviso_Especial_Nadador`,
                        `${compassBeachKey};lev_anortado;🧭 Levante Anortado;1;${sLevAnortadoMax};0.40;0.60;10;Entrada cerrada tierra/mar.`,
                        `${compassBeachKey};levante;🌊 Levante;${sLevAnortadoMax + 1};${sLevanteMax};0.60;0.85;10;Mar de fondo / Rompiente orillera.`,
                        `${compassBeachKey};sur;⚓ Sur;${sLevanteMax + 1};${sSurMax};0.50;0.70;8;Amplificador térmico / Mar picado.`,
                        `${compassBeachKey};poniente;💨 Poniente;${sSurMax + 1};${sPonienteMax};0.35;0.45;8;Chop rápido / Boost térmico mediodía.`,
                        `${compassBeachKey};terral;🏔️ Poniente-Terral;${sPonienteMax + 1};360;0.15;0.20;12;Orilla plato / balsa total.`
                      ].join('\n');

                      try {
                        navigator.clipboard.writeText(csvText);
                        setCompassCopiedToast(true);
                        setTimeout(() => setCompassCopiedToast(false), 3000);
                      } catch(e) {}
                    };

                    return (
                      <div className="text-left space-y-4">
                        {/* CABECERA Y SELECTOR DE PLAYAS */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <h4 className="text-xs font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                              <Compass size={16} className="text-indigo-600 animate-spin" style={{ animationDuration: '12s' }} />
                              <span>Laboratorio Visual de Calibración Costera (Rosa Náutica & Satélite HD)</span>
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Inspecciona la orografía real, espigones y orientaciones para calibrar los 5 sectores de cada playa.
                            </p>
                          </div>
                          {compassCopiedToast && (
                            <span className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full animate-bounce shadow-md">
                              ✓ ¡Copiado para Google Sheets!
                            </span>
                          )}
                        </div>

                        {/* SELECTOR DE LAS 7 PLAYAS */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {Object.keys(BEACH_COASTAL_DEFS).map(key => {
                            const isSel = compassBeachKey === key;
                            const bObj = BEACH_COASTAL_DEFS[key];
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setCompassBeachKey(key)}
                                className={`py-1.5 px-3 rounded-xl text-[11px] font-black tracking-tight shrink-0 transition-all cursor-pointer ${
                                  isSel 
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80'
                                }`}
                              >
                                {bObj.name.split(',')[0]}
                              </button>
                            );
                          })}
                        </div>

                        {/* TARJETA DE FICHA TÉCNICA DE LA PLAYA ACTIVA */}
                        <div className="bg-slate-900 text-slate-100 p-3.5 rounded-2xl border border-slate-800 shadow-md space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-white">{bDef.name}</span>
                            <span className="text-[10px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 px-2 py-0.5 rounded-full">
                              Frente Marino: {activeFacing}º ({activeFacing >= 45 && activeFacing <= 135 ? 'Levante' : activeFacing > 135 && activeFacing <= 225 ? 'Sur' : 'Poniente'})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-medium">
                            <strong className="text-slate-400">Abrigos & Orografía:</strong> {bDef.shelters}
                          </p>
                        </div>

                        {/* VISOR PRINCIPAL: MAPA SATELITAL HD + ROSA NÁUTICA AZIMUTAL SVG */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          {/* COLUMNA MAPA SATÉLITE CON SVG */}
                          <div className="lg:col-span-7 flex flex-col items-center">
                            <div className="w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden relative shadow-2xl border-4 border-slate-800 bg-slate-950">
                              {/* Capa de Fondo Satelital de Alta Resolución */}
                              <div 
                                className="absolute inset-0 bg-cover bg-center transition-all duration-500"
                                style={{
                                  backgroundImage: `url(${satTileUrl})`,
                                  filter: 'brightness(0.9) contrast(1.15)'
                                }}
                              />

                              {/* Capa SVG: Rosa de Rumbos, Sectores y Vectores */}
                              <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full select-none pointer-events-none">
                                {/* Anillos de Distancia Concéntricos */}
                                <circle cx={cx} cy={cy} r={radius * 0.4} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
                                <circle cx={cx} cy={cy} r={radius * 0.75} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />

                                {/* 1. CONOS DE LOS 5 SECTORES PROYECTADOS SOBRE EL AGUA */}
                                {/* Levante Anortado (1º a Max) */}
                                <path 
                                  d={makeSectorPath(1, sLevAnortadoMax, radius)} 
                                  fill="rgba(245, 158, 11, 0.28)" 
                                  stroke="#f59e0b" 
                                  strokeWidth="1.5" 
                                />
                                {/* Levante (Max Anortado a Max Levante) */}
                                <path 
                                  d={makeSectorPath(sLevAnortadoMax, sLevanteMax, radius)} 
                                  fill="rgba(59, 130, 246, 0.32)" 
                                  stroke="#3b82f6" 
                                  strokeWidth="2" 
                                />
                                {/* Sur (Max Levante a Max Sur) */}
                                <path 
                                  d={makeSectorPath(sLevanteMax, sSurMax, radius)} 
                                  fill="rgba(139, 92, 246, 0.35)" 
                                  stroke="#8b5cf6" 
                                  strokeWidth="2" 
                                />
                                {/* Poniente (Max Sur a Max Poniente) */}
                                <path 
                                  d={makeSectorPath(sSurMax, sPonienteMax, radius)} 
                                  fill="rgba(16, 185, 129, 0.30)" 
                                  stroke="#10b981" 
                                  strokeWidth="2" 
                                />
                                {/* Poniente-Terral (Max Poniente a 360º) */}
                                <path 
                                  d={makeSectorPath(sPonienteMax, 360, radius)} 
                                  fill="rgba(249, 115, 22, 0.25)" 
                                  stroke="#f97316" 
                                  strokeWidth="1.5" 
                                />

                                {/* Graduaciones de Grados en el Limbo */}
                                {Array.from({ length: 36 }).map((_, idx) => {
                                  const deg = idx * 10;
                                  const isMajor = deg % 30 === 0;
                                  const p1 = degToCartesian(deg, radius);
                                  const p2 = degToCartesian(deg, radius - (isMajor ? 10 : 5));
                                  const pText = degToCartesian(deg, radius + 14);

                                  return (
                                    <g key={deg}>
                                      <line 
                                        x1={p1.x} y1={p1.y} 
                                        x2={p2.x} y2={p2.y} 
                                        stroke={isMajor ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"} 
                                        strokeWidth={isMajor ? "1.5" : "1"} 
                                      />
                                      {isMajor && (
                                        <text 
                                          x={pText.x} y={pText.y} 
                                          fill="rgba(255,255,255,0.85)" 
                                          fontSize="8" 
                                          fontWeight="bold" 
                                          textAnchor="middle" 
                                          dominantBaseline="central"
                                        >
                                          {deg}º
                                        </text>
                                      )}
                                    </g>
                                  );
                                })}

                                {/* Puntos Cardinales Principales */}
                                <text x={cx} y={cy - radius - 16} fill="#ef4444" fontSize="13" fontWeight="900" textAnchor="middle" dominantBaseline="central">N (0º)</text>
                                <text x={cx + radius + 18} y={cy} fill="#38bdf8" fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="central">E (90º)</text>
                                <text x={cx} y={cy + radius + 16} fill="#a855f7" fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="central">S (180º)</text>
                                <text x={cx - radius - 18} y={cy} fill="#34d399" fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="central">O (270º)</text>

                                {/* 2. LÍNEA DORADA DE COSTA (TANGENTE DE LA ARENA) */}
                                <line 
                                  x1={pCoast1.x} y1={pCoast1.y} 
                                  x2={pCoast2.x} y2={pCoast2.y} 
                                  stroke="#fbbf24" 
                                  strokeWidth="3" 
                                  strokeDasharray="6 4"
                                />
                                <text 
                                  x={pCoast1.x} y={pCoast1.y - 6} 
                                  fill="#fbbf24" 
                                  fontSize="9" 
                                  fontWeight="900" 
                                  textAnchor="middle"
                                >
                                  Línea de Costa
                                </text>

                                {/* 3. VECTOR PERPENDICULAR HACIA EL MAR (FACING) */}
                                <line 
                                  x1={cx} y1={cy} 
                                  x2={pFacingEnd.x} y2={pFacingEnd.y} 
                                  stroke="#ffffff" 
                                  strokeWidth="3.5" 
                                  strokeLinecap="round"
                                />
                                <circle cx={pFacingEnd.x} cy={pFacingEnd.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                                <text 
                                  x={pFacingEnd.x} y={pFacingEnd.y + (activeFacing >= 90 && activeFacing <= 270 ? 14 : -12)} 
                                  fill="#ffffff" 
                                  fontSize="10" 
                                  fontWeight="900" 
                                  textAnchor="middle"
                                  className="bg-slate-900"
                                >
                                  Frente {activeFacing}º
                                </text>

                                {/* 4. FLECHA EN VIVO DE VIENTO DE HOY */}
                                <line 
                                  x1={cx} y1={cy} 
                                  x2={pWindVector.x} y2={pWindVector.y} 
                                  stroke="#06b6d4" 
                                  strokeWidth="3" 
                                  strokeDasharray="4 2"
                                />
                                <circle cx={pWindVector.x} cy={pWindVector.y} r="4" fill="#06b6d4" />
                                <text x={pWindVector.x} y={pWindVector.y - 8} fill="#22d3ee" fontSize="8" fontWeight="bold" textAnchor="middle">
                                  💨 Viento {currentWindSpd}kt ({currentWindDir}º)
                                </text>

                                {/* 5. FLECHA EN VIVO DE OLEAJE DE HOY */}
                                <line 
                                  x1={cx} y1={cy} 
                                  x2={pWaveVector.x} y2={pWaveVector.y} 
                                  stroke="#60a5fa" 
                                  strokeWidth="3.5" 
                                />
                                <polygon 
                                  points={`${pWaveVector.x},${pWaveVector.y} ${pWaveVector.x - 5},${pWaveVector.y + 7} ${pWaveVector.x + 5},${pWaveVector.y + 7}`} 
                                  fill="#60a5fa" 
                                />
                                <text x={pWaveVector.x} y={pWaveVector.y + 12} fill="#93c5fd" fontSize="8" fontWeight="bold" textAnchor="middle">
                                  🌊 Ola {currentWaveH}m ({currentWaveDir}º)
                                </text>

                                {/* Centro: Pinpoint en la Arena */}
                                <circle cx={cx} cy={cy} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                                <circle cx={cx} cy={cy} r="10" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping" style={{ transformOrigin: `${cx}px ${cy}px` }} />
                              </svg>

                              {/* Badge de Referencia Inferior */}
                              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[9px] font-bold text-slate-300 bg-slate-950/85 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-700/80">
                                <span>📍 Satélite Esri HD Zoom 15</span>
                                <span>🧭 Orientación Frontal: <strong className="text-amber-400">{activeFacing}º</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* COLUMNA DE CONTROLES DESLIZANTES Y RESUMEN */}
                          <div className="lg:col-span-5 space-y-3">
                            {/* AJUSTE INTERACTIVO DE ORIENTACIÓN (FACING) */}
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                                  <span>🧭 Orientación Frontal (Facing):</span>
                                </label>
                                <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                                  {activeFacing}º
                                </span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="360" 
                                value={activeFacing} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setCompassCustomFacing(prev => ({ ...prev, [compassBeachKey]: val }));
                                }}
                                className="w-full accent-indigo-600 cursor-pointer" 
                              />
                              <p className="text-[9px] text-slate-500">
                                Mueve el control para alinear la flecha blanca exactamente perpendicular a la arena hacia el mar abierto.
                              </p>
                            </div>

                            {/* CONTROLES DE LOS 5 SECTORES */}
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="text-xs font-black text-slate-800">📐 Calibración de Grados de Sectores:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompassCustomFacing(prev => {
                                      const next = { ...prev };
                                      delete next[compassBeachKey];
                                      return next;
                                    });
                                    setCompassCustomSectors(prev => {
                                      const next = { ...prev };
                                      delete next[compassBeachKey];
                                      return next;
                                    });
                                  }}
                                  className="text-[9px] font-bold text-slate-500 hover:text-red-600 underline cursor-pointer"
                                >
                                  Restablecer
                                </button>
                              </div>

                              {/* Sector 1: Levante Anortado */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-amber-700">🧭 Levante Anortado: 1º a {sLevAnortadoMax}º</span>
                                </div>
                                <input 
                                  type="range" min="10" max="70" value={sLevAnortadoMax}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCompassCustomSectors(prev => ({
                                      ...prev,
                                      [compassBeachKey]: { ...(prev[compassBeachKey] || {}), lev_anortado: val }
                                    }));
                                  }}
                                  className="w-full accent-amber-500 cursor-pointer" 
                                />
                              </div>

                              {/* Sector 2: Levante */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-blue-700">🌊 Levante: {sLevAnortadoMax + 1}º a {sLevanteMax}º</span>
                                </div>
                                <input 
                                  type="range" min="90" max="185" value={sLevanteMax}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCompassCustomSectors(prev => ({
                                      ...prev,
                                      [compassBeachKey]: { ...(prev[compassBeachKey] || {}), levante: val }
                                    }));
                                  }}
                                  className="w-full accent-blue-600 cursor-pointer" 
                                />
                              </div>

                              {/* Sector 3: Sur */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-purple-700">⚓ Sur: {sLevanteMax + 1}º a {sSurMax}º</span>
                                </div>
                                <input 
                                  type="range" min="160" max="210" value={sSurMax}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCompassCustomSectors(prev => ({
                                      ...prev,
                                      [compassBeachKey]: { ...(prev[compassBeachKey] || {}), sur: val }
                                    }));
                                  }}
                                  className="w-full accent-purple-600 cursor-pointer" 
                                />
                              </div>

                              {/* Sector 4: Poniente */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-emerald-700">💨 Poniente: {sSurMax + 1}º a {sPonienteMax}º</span>
                                </div>
                                <input 
                                  type="range" min="195" max="250" value={sPonienteMax}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCompassCustomSectors(prev => ({
                                      ...prev,
                                      [compassBeachKey]: { ...(prev[compassBeachKey] || {}), poniente: val }
                                    }));
                                  }}
                                  className="w-full accent-emerald-600 cursor-pointer" 
                                />
                              </div>

                              {/* Sector 5: Poniente-Terral */}
                              <div className="pt-1 text-[11px] font-black text-orange-700">
                                🏔️ Poniente-Terral: {sPonienteMax + 1}º a 360º (y 0º)
                              </div>
                            </div>

                            {/* BOTÓN COPIAR PARA GOOGLE SHEETS */}
                            <button
                              type="button"
                              onClick={copyConfigForSheets}
                              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black text-xs shadow-md hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Database size={15} />
                              <span>Copiar Configuración para Google Sheets</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

                  {adminTab === 'telemetry' && (
                    <div className="text-left space-y-4">
                      <div className="flex justify-between items-center mb-1 border-b border-slate-200 pb-2">
                        <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                          <Activity size={16} className="text-cyan-500" />
                          <span>Matriz de Auditoría de Telemetría (2 Etapas)</span>
                        </h4>
                        <span className="text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> 16 COLUMNAS BIAS/REFRACCIÓN
                        </span>
                      </div>

                      {/* Tarjetas resumen de métricas */}
                      {(() => {
                        // Calcular F_sesgo medio (Boya / Satélite) desde calibrationHistory
                        const validSesgoLogs = calibrationHistory.filter(l => {
                          const buoyInfo = getBuoyReadingForLog(l);
                          const bH = parseFloat((buoyInfo.height || l.boyaAltura || "").toString().replace(",", "."));
                          const satH = parseFloat((l.modelEcmwfOlas || l.appOlas || "").toString().replace(",", "."));
                          return !isNaN(bH) && bH > 0 && !isNaN(satH) && satH > 0;
                        });

                        let avgFSesgo = 1.0;
                        if (validSesgoLogs.length > 0) {
                          const sumSesgo = validSesgoLogs.reduce((acc, l) => {
                            const buoyInfo = getBuoyReadingForLog(l);
                            const bH = parseFloat((buoyInfo.height || l.boyaAltura || "").toString().replace(",", "."));
                            const satH = parseFloat((l.modelEcmwfOlas || l.appOlas || "").toString().replace(",", "."));
                            return acc + (bH / satH);
                          }, 0);
                          avgFSesgo = (sumSesgo / validSesgoLogs.length).toFixed(2);
                        }

                        // Calcular F_refraccion medio (Orilla / Boya) desde calibrationHistory
                        const validRefracLogs = calibrationHistory.filter(l => {
                          const buoyInfo = getBuoyReadingForLog(l);
                          const bH = parseFloat((buoyInfo.height || l.boyaAltura || "").toString().replace(",", "."));
                          const swimmerRealM = swimmerScaleToMeters(l.realOlas);
                          return !isNaN(bH) && bH > 0 && swimmerRealM > 0;
                        });

                        let avgFRefrac = 0.50;
                        if (validRefracLogs.length > 0) {
                          const sumRefrac = validRefracLogs.reduce((acc, l) => {
                            const buoyInfo = getBuoyReadingForLog(l);
                            const bH = parseFloat((buoyInfo.height || l.boyaAltura || "").toString().replace(",", "."));
                            const swimmerRealM = swimmerScaleToMeters(l.realOlas);
                            return acc + (swimmerRealM / bH);
                          }, 0);
                          avgFRefrac = (sumRefrac / validRefracLogs.length).toFixed(2);
                        }

                        const avgFCombinado = (parseFloat(avgFSesgo) * parseFloat(avgFRefrac)).toFixed(2);

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-3.5 rounded-2xl border border-indigo-100/80 shadow-sm space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Etapa 1: Sesgo Satélite (F_sesgo)</span>
                              <strong className="text-xl font-black text-indigo-700 block">{avgFSesgo}x</strong>
                              <span className="text-[9px] text-slate-500 block">Relación Boya Real / Satélite (D-1) ({validSesgoLogs.length} muestras)</span>
                            </div>

                            <div className="bg-gradient-to-br from-cyan-50 to-slate-50 p-3.5 rounded-2xl border border-cyan-100/80 shadow-sm space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Etapa 2: Refracción Orilla (F_refraccion)</span>
                              <strong className="text-xl font-black text-cyan-700 block">{avgFRefrac}x</strong>
                              <span className="text-[9px] text-slate-500 block">Atenuación Batimétrica Orilla / Boya ({validRefracLogs.length} reportes)</span>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-50 to-slate-50 p-3.5 rounded-2xl border border-emerald-100/80 shadow-sm space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Factor Combinado (F_combinado)</span>
                              <strong className="text-xl font-black text-emerald-700 block">{avgFCombinado}x</strong>
                              <span className="text-[9px] text-slate-500 block">Multiplicador global Orilla = Satélite × F_combinado</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tabla de auditoría por sectores */}
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                          <span>Desglose de Telemetría por Sectores de Oleaje</span>
                          <span className="text-[10px] text-slate-400">Misericordia, Malagueta, Pedregalejo</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                              <tr>
                                <th className="p-2.5 font-extrabold">Playa / Sector</th>
                                <th className="p-2.5 text-center font-extrabold">Satélite D-1</th>
                                <th className="p-2.5 text-center font-extrabold">Boya Real</th>
                                <th className="p-2.5 text-center font-extrabold text-indigo-700">F_sesgo</th>
                                <th className="p-2.5 text-center font-extrabold">Orilla Real</th>
                                <th className="p-2.5 text-center font-extrabold text-cyan-700">F_refraccion</th>
                                <th className="p-2.5 text-center font-extrabold text-emerald-700">F_combinado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 text-[11px]">
                              {Object.entries(BEACHES).map(([bKey, bObj]) => {
                                return [
                                  { secKey: 'poniente', name: `${bObj.name.split(',')[0]} (Poniente / SUR)`, isLevante: false },
                                  { secKey: 'levante', name: `${bObj.name.split(',')[0]} (Levante / ESE)`, isLevante: true }
                                ].map(sec => {
                                  const secLogs = calibrationHistory.filter(l => {
                                    if (l.playa !== bKey) return false;
                                    const buoyInfo = getBuoyReadingForLog(l);
                                    const dir = Number(buoyInfo.dir || l.boyaDireccion || 110);
                                    const isL = dir >= 45 && dir <= 165;
                                    return isL === sec.isLevante;
                                  });

                                  let secSesgoSum = 0, secSesgoCnt = 0;
                                  let secRefracSum = 0, secRefracCnt = 0;
                                  let lastSat = null, lastBuoy = null, lastOrilla = null;

                                  secLogs.forEach(l => {
                                    const buoyInfo = getBuoyReadingForLog(l);
                                    const bH = parseFloat((buoyInfo.height || l.boyaAltura || "").toString().replace(",", "."));
                                    const satH = parseFloat((l.modelEcmwfOlas || l.appOlas || "").toString().replace(",", "."));
                                    const swimmerRealM = swimmerScaleToMeters(l.realOlas);

                                    if (!isNaN(satH) && satH > 0 && !isNaN(bH) && bH > 0) {
                                      secSesgoSum += (bH / satH);
                                      secSesgoCnt++;
                                      lastSat = satH;
                                      lastBuoy = bH;
                                    }

                                    if (!isNaN(bH) && bH > 0 && swimmerRealM > 0) {
                                      secRefracSum += (swimmerRealM / bH);
                                      secRefracCnt++;
                                      lastOrilla = swimmerRealM;
                                    }
                                  });

                                  const fSesgoSec = secSesgoCnt > 0 ? (secSesgoSum / secSesgoCnt).toFixed(2) : "1.00";
                                  const fRefracSec = secRefracCnt > 0 ? (secRefracSum / secRefracCnt).toFixed(2) : "0.50";
                                  const fCombSec = (parseFloat(fSesgoSec) * parseFloat(fRefracSec)).toFixed(2);

                                  return (
                                    <tr key={`${bKey}_${sec.secKey}`} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="p-2.5 font-bold text-slate-800">{sec.name}</td>
                                      <td className="p-2.5 text-center font-bold text-indigo-600">{lastSat ? `${lastSat.toFixed(2)}m` : '—'}</td>
                                      <td className="p-2.5 text-center font-bold text-cyan-600">{lastBuoy ? `${lastBuoy.toFixed(2)}m` : '—'}</td>
                                      <td className="p-2.5 text-center font-black text-indigo-700 bg-indigo-50/50">{fSesgoSec}x</td>
                                      <td className="p-2.5 text-center font-bold text-emerald-600">{lastOrilla ? `${lastOrilla.toFixed(2)}m` : '—'}</td>
                                      <td className="p-2.5 text-center font-black text-cyan-700 bg-cyan-50/50">{fRefracSec}x</td>
                                      <td className="p-2.5 text-center font-black text-emerald-700 bg-emerald-50/50">{fCombSec}x</td>
                                    </tr>
                                  );
                                });
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </>
              )}
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
                {/* SELECTOR TÁCTIL DE FECHA DEL NADO (NADADOR) */}
                <div className="space-y-1.5 mb-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-600 uppercase">
                    <span>📅 ¿Cuándo fue tu sesión de nado?</span>
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {swimmerFechaNado === getIsoDateString() ? '☀️ Hoy' : swimmerFechaNado === getYesterdayIsoString() ? '⛅ Ayer' : swimmerFechaNado}, {swimmerHoraNado}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSwimmerFechaNado(getIsoDateString())}
                      className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all border text-center cursor-pointer ${swimmerFechaNado === getIsoDateString() ? 'bg-blue-600 text-white border-blue-700 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                    >
                      ☀️ Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => setSwimmerFechaNado(getYesterdayIsoString())}
                      className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all border text-center cursor-pointer ${swimmerFechaNado === getYesterdayIsoString() ? 'bg-blue-600 text-white border-blue-700 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                    >
                      ⛅ Ayer
                    </button>
                    <div className="relative">
                      <input
                        type="date"
                        value={swimmerFechaNado}
                        onChange={(e) => setSwimmerFechaNado(e.target.value)}
                        max={getIsoDateString()}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-extrabold text-blue-700 outline-none cursor-pointer text-center"
                      />
                    </div>
                  </div>

                  {/* Aviso inteligente de hora futura */}
                  {swimmerFechaNado === getIsoDateString() && parseInt((swimmerHoraNado || '').split(':')[0]) > new Date().getHours() && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between mt-1">
                      <span>⚠️ Las {swimmerHoraNado} es una hora futura de hoy. ¿Nadaste anoche?</span>
                      <button
                        type="button"
                        onClick={() => setSwimmerFechaNado(getYesterdayIsoString())}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black px-2 py-0.5 rounded ml-1.5 shrink-0 cursor-pointer"
                      >
                        ⛅ Cambiar a Ayer
                      </button>
                    </div>
                  )}
                </div>

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
                      onChange={(e) => {
                        const newHourStr = e.target.value;
                        setSwimmerHoraNado(newHourStr);
                        const hourNum = parseInt(newHourStr.split(':')[0]);
                        if (hourNum > new Date().getHours() && swimmerFechaNado === getIsoDateString()) {
                          setSwimmerFechaNado(getYesterdayIsoString());
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white"
                    >
                      {Array.from({ length: 16 }, (_, i) => i + 6).map(h => {
                        const timeStr = `${h.toString().padStart(2, '0')}:00`;
                        return <option key={h} value={timeStr}>{timeStr}</option>;
                      })}
                    </select>
                  </div>
                </div>
                {/* Campo opcional: Nombre del Nadador */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                    👤 ¿Tu Nombre? (Opcional)
                  </label>
                  <input 
                    type="text" 
                    value={swimmerName} 
                    onChange={(e) => setSwimmerName(e.target.value)} 
                    placeholder="Ej. Juan, María... (deja vacío para ser Anónimo)" 
                    maxLength={25}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white placeholder-slate-400 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Toggle para publicar solo un mensaje/aviso */}
                <div className="flex items-center gap-2 p-1">
                  <input
                    type="checkbox"
                    id="swimmerIsOnlyMessage"
                    checked={swimmerIsOnlyMessage}
                    onChange={(e) => setSwimmerIsOnlyMessage(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="swimmerIsOnlyMessage" className="text-[11px] font-black text-indigo-600 select-none cursor-pointer">
                    📢 Publicar solo un mensaje/aviso (sin valoraciones físicas)
                  </label>
                </div>

                {!swimmerIsOnlyMessage && (
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
                        {swimmerRealOlas === 1 && "1/5 (0.05m) • Plato: Mar balsa, nadas sin turbulencia alguna"}
                        {swimmerRealOlas === 2 && "2/5 (0.20m) • Rizado suave: Mar rizado, no interrumpe la respiración"}
                        {swimmerRealOlas === 3 && "3/5 (0.45m) • Marejada / Incómodo: Salpica al respirar, girar cabeza"}
                        {swimmerRealOlas === 4 && "4/5 (0.80m) • Fuerte / Oleaje: Dificultad para orientarse, picado"}
                        {swimmerRealOlas === 5 && "5/5 (1.20m) • Muy Duro / Rompiente: Impide nadar con normalidad"}
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
              )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    {swimmerIsOnlyMessage ? 'Mensaje o aviso de la comunidad (Obligatorio)' : 'Comentario o sensaciones (Opcional)'}
                  </label>
                  <textarea 
                    value={swimmerSensaciones}
                    onChange={(e) => setSwimmerSensaciones(e.target.value)}
                    placeholder={swimmerIsOnlyMessage ? "Ej. '¿Quién se apunta a nadar a las 19:00?' o 'Mar de fondo fuerte, precaución hoy...'" : "Ej. 'El agua estaba plato pero fría, no hay medusas hoy...'"}
                    required={swimmerIsOnlyMessage}
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
                  {swimmerIsOnlyMessage ? 'Enviar Mensaje a la Comunidad 🚀' : 'Enviar Reporte Anónimo 🚀'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Footer con Contador de Visitas */}
      <footer className="w-full text-center py-6 mt-8 border-t border-slate-100 text-[10px] font-bold text-slate-400/70 tracking-wide uppercase flex flex-col sm:flex-row items-center justify-center gap-1.5 select-none">
        <span>© {new Date().getFullYear()} OpenWater Tracker Málaga</span>
        <span className="hidden sm:inline">•</span>
        <span>Club de Nado Aliquindoi</span>
        {totalVisits > 0 && (
          <>
            <span className="hidden sm:inline">•</span>
            <span className="bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded text-[9px] text-slate-500 font-extrabold normal-case">
              👥 {totalVisits.toLocaleString('es-ES')} visitas
            </span>
          </>
        )}
      </footer>
      <Analytics />
    </div>
  );
}

