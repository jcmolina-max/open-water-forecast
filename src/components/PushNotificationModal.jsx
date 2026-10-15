import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  Waves, 
  Compass, 
  Loader2, 
  Send, 
  Info 
} from 'lucide-react';

/**
 * Convierte clave VAPID Base64URL a Uint8Array estándar requerido por pushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationModal({ 
  isOpen, 
  onClose, 
  vapidPublicKey = "BLrS1Zj7HbR_gN6sq9cWLgvcNOTpS5ECBGBQd65teg3VoZGRVnVvMNRvn_WRP0PsKgjKCa147lC6ZxBPskbimW4",
  webhookUrl = "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec",
  currentBeach = "misericordia"
}) {
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [profile, setProfile] = useState('nadador'); // 'nadador' | 'surfero'
  const [selectedBeach, setSelectedBeach] = useState('todas');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      return;
    }

    setPermission(Notification.permission);
    checkExistingSubscription();
  }, [isOpen]);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (e) {
      console.warn("Error comprobando suscripción push previa:", e);
    }
  };

  const handleSubscribe = async () => {
    if (!isSupported) {
      setStatusMessage({ type: 'error', text: 'Tu navegador no soporta notificaciones Web Push.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      // 1. Pedir permiso al navegador si está en default
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage({ 
          type: 'error', 
          text: 'Permiso denegado. Para recibir alertas, habilita las notificaciones en el icono de candado de tu navegador.' 
        });
        setLoading(false);
        return;
      }

      // 2. Registrar/obtener Service Worker
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      const subJson = sub.toJSON();

      // 3. Enviar a Google Apps Script
      const payload = {
        action: 'subscribe_push',
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || '',
        perfil: profile,
        playa: selectedBeach,
        timestamp: new Date().toISOString()
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      setIsSubscribed(true);
      setStatusMessage({ 
        type: 'success', 
        text: '¡Alertas activadas con éxito! Recibirás avisos a 72h según tus condiciones preferidas.' 
      });
    } catch (err) {
      console.error("Error al suscribir:", err);
      setStatusMessage({ 
        type: 'error', 
        text: 'Hubo un error al suscribir tu dispositivo: ' + (err.message || 'Error de red') 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // Notificar a Google Sheets
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'unsubscribe_push', endpoint })
          });
        } catch (e) {}
      }

      setIsSubscribed(false);
      setStatusMessage({ type: 'info', text: 'Alertas desactivadas correctamente.' });
    } catch (err) {
      console.error("Error al desuscribir:", err);
      setStatusMessage({ type: 'error', text: 'No se pudo desactivar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.showNotification) {
        reg.showNotification('🌊 OpenWater Tracker Málaga', {
          body: profile === 'nadador'
            ? '✨ ¡Alerta Mar Balsa a 72h! Ola 0.18m y viento suave en Misericordia. Ventana de Oro: 08:30 a 11:00.'
            : '🏄 ¡Swell de Levante a 72h! Marejada de 0.85m con periodo Tp 5.8s en la bahía.',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          vibrate: [200, 100, 200],
          data: { url: '/' }
        });
        setStatusMessage({ type: 'success', text: '¡Notificación de prueba enviada a tu pantalla!' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Error en prueba: ' + e.message });
    } finally {
      setTestLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Cabecera con degradado */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <BellRing size={26} className="text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Alertas Náuticas a 72 Horas</h2>
              <p className="text-xs text-blue-100 font-medium">Previsión anticipada en tu móvil sin apps pesadas</p>
            </div>
          </div>
        </div>

        {/* Contenido del modal */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Mensajes de estado */}
          {statusMessage && (
            <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {statusMessage.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <Info size={16} className="text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <Info size={16} className="text-blue-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Garantía de Privacidad 100% Anónimo */}
          <div className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600">
            <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block mb-0.5 font-bold">100% Anónimo y Seguro (Sin correos ni RGPD)</strong>
              No recopilamos emails, teléfonos ni nombres. La alerta viaja cifrada directamente a tu navegador mediante el protocolo oficial W3C Push.
            </div>
          </div>

          {/* Selector de Perfil (Nadador vs Surfero) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              1. Selecciona tu perfil de actividad:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProfile('nadador')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  profile === 'nadador'
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">🏊‍♂️</span>
                  <span className="font-black text-xs text-slate-800">Nadador Aguas Abiertas</span>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Avisos de <strong>Mar Balsa</strong> (&le; 0.30m) y <strong>Ventana de Oro</strong>. Alerta de mar picado.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProfile('surfero')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  profile === 'surfero'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">🏄‍♂️</span>
                  <span className="font-black text-xs text-slate-800">Surf / SUP / Tablón</span>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Avisos de <strong>Swell de Levante</strong> y olas surfeables locales en Málaga (&ge; 0.40m a 0.85m).
                </p>
              </button>
            </div>
          </div>

          {/* Selector de Playa */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              2. Playa de seguimiento preferida:
            </label>
            <div className="relative">
              <select
                value={selectedBeach}
                onChange={(e) => setSelectedBeach(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="todas">🌊 Toda la Bahía de Málaga (Recomendado)</option>
                <option value="misericordia">🏖️ La Misericordia (Málaga Oeste)</option>
                <option value="malagueta">🏖️ La Malagueta (Málaga Centro / Puerto)</option>
                <option value="pedregalejo">🏖️ Pedregalejo / El Palo</option>
                <option value="los_alamos">🏖️ Los Álamos (Torremolinos)</option>
                <option value="bajondillo">🏖️ El Bajondillo (Torremolinos)</option>
                <option value="cala_del_moral">🏖️ La Cala del Moral</option>
                <option value="rincon_victoria">🏖️ Rincón de la Victoria</option>
              </select>
            </div>
          </div>

          {/* Botonera de Acción */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
            {!isSubscribed ? (
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading || !isSupported}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs tracking-wide shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Conectando navegador...</span>
                  </>
                ) : (
                  <>
                    <BellRing size={16} />
                    <span>Activar Alertas a 72h Gratis</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={testLoading}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                >
                  {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Probar Notificación Ahora</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
                >
                  <BellOff size={14} />
                  <span>Desactivar</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Pie de modal */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Estado del navegador: <strong className="font-semibold text-slate-700">{permission === 'granted' ? 'Permitido ✅' : permission === 'denied' ? 'Bloqueado ❌' : 'Sin activar ⚪'}</strong></span>
          <button onClick={onClose} className="font-bold text-blue-600 hover:underline">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
