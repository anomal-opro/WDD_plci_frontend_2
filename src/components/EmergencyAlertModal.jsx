import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Volume2, VolumeX, ShieldAlert, Loader2 } from 'lucide-react';
import { EMERGENCY_URL, ALARM_AUDIO_URL } from '../shared/constants';

export default function EmergencyAlertModal() {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isSolving, setIsSolving] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio(ALARM_AUDIO_URL);
    audio.loop = true;
    audioRef.current = audio;

    // Ask notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  // Fetch active alerts
  const checkActiveAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${EMERGENCY_URL}/active`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
      setActiveAlerts(list);

      if (list.length > 0) {
        // Trigger browser notification if allowed
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🚨 PERINGATAN DARURAT KASIR!', {
              body: `Cabang ${list[0].branch || list[0].cabang || 'Kasir'} membutuhkan bantuan darurat!`,
              icon: '/favicon.ico',
              requireInteraction: true
            });
          } catch (e) {
            console.error('Notification error', e);
          }
        }

        // Play alarm audio
        if (audioRef.current && !isMuted) {
          audioRef.current.play().catch(() => {
            // Browser might block autoplay without user interaction
          });
        }
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    } catch (e) {
      console.warn('Gagal cek status emergency:', e);
    }
  }, [isMuted]);

  // Polling every 15s + on visibilitychange
  useEffect(() => {
    checkActiveAlerts();

    const interval = setInterval(checkActiveAlerts, 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkActiveAlerts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkActiveAlerts]);

  // Handle Solve Alert
  const handleSolve = async (alertId) => {
    setIsSolving(true);
    try {
      await fetch(`${EMERGENCY_URL}/solve/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      // Stop audio immediately
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      await checkActiveAlerts();
    } catch (e) {
      alert('Gagal menyelesaikan alert darurat. Silakan coba lagi.');
    } finally {
      setIsSolving(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch(() => {});
        setIsMuted(false);
      } else {
        audioRef.current.pause();
        setIsMuted(true);
      }
    }
  };

  if (!activeAlerts || activeAlerts.length === 0) {
    return null;
  }

  const currentAlert = activeAlerts[0];
  const branchName = currentAlert.branch || currentAlert.cabang || currentAlert.sheet || 'Kasir Pecel Lele';
  const alertTime = currentAlert.createdAt
    ? new Date(currentAlert.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Baru saja';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-md animate-in fade-in select-none">
      {/* Pulsing Red Backdrop Ambience */}
      <div className="absolute inset-0 bg-red-600/30 animate-pulse pointer-events-none"></div>

      <div className="max-w-xl w-full bg-slate-900 border-2 border-red-500 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.5)] relative z-10 text-white flex flex-col items-center text-center">
        {/* Top Icon Badge */}
        <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center mb-4 animate-bounce">
          <ShieldAlert size={44} className="text-red-500" />
        </div>

        {/* Warning Title */}
        <div className="inline-block px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-xs font-black uppercase tracking-widest mb-3">
          SISTEM DARURAT KASIR AKTIF
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          PANGGILAN DARURAT!
        </h2>
        <p className="text-slate-300 text-sm max-w-md mb-6">
          Terdeteksi sinyal darurat dari kasir cabang. Harap segera berkoordinasi dengan petugas di lapangan!
        </p>

        {/* Alert Information Card */}
        <div className="w-full bg-slate-800/80 border border-red-500/40 rounded-2xl p-4 sm:p-5 mb-6 text-left">
          <div className="flex justify-between items-center border-b border-slate-700/60 pb-3 mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cabang Pelapor</span>
            <span className="text-sm font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              {branchName}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-700/60 pb-3 mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waktu Masuk</span>
            <span className="text-sm font-mono font-bold text-red-400">
              {alertTime} WIB
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Laporan</span>
            <span className="text-xs font-extrabold text-red-400 bg-red-500/20 px-2.5 py-1 rounded-full border border-red-500/30 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> MEMBUTUHKAN PENANGANAN
            </span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="w-full sm:w-auto px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span className="text-xs">{isMuted ? 'BUNYIKAN SUARA' : 'SENYAPKAN'}</span>
          </button>

          {/* Solve Button */}
          <button
            onClick={() => handleSolve(currentAlert._id)}
            disabled={isSolving}
            className="flex-1 w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-900/40 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSolving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>MEMPROSES PENYELESAIAN...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>MASALAH SELESAI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
