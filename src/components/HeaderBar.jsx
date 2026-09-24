import React, { useState, useEffect } from 'react';
import { RefreshCw, Lock, Clock, ShieldCheck, Store, Calendar } from 'lucide-react';
import { BRANCH_INFO } from '../shared/constants';

export default function HeaderBar({ activeTab, onRefresh, isRefreshing, onLock }) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabLabels = {
    input_pengeluaran: 'Input Pengeluaran',
    penjualan: 'Rekapitulasi Penjualan',
    pengeluaran: 'Monitoring Pengeluaran (Admin)',
    keuangan: 'Rekapitulasi Laba Rugi',
  };

  return (
    <header className="h-16 md:h-20 bg-white border-b border-slate-200/80 px-4 sm:px-6 md:px-8 flex items-center justify-between shadow-xs sticky top-0 z-30 select-none">
      {/* Left: Breadcrumb / Active Module Info */}
      <div className="flex items-center gap-3 pl-12 md:pl-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {BRANCH_INFO.name}
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {tabLabels[activeTab] || 'Dashboard Admin'}
          </p>
        </div>
      </div>

      {/* Right: Clock, Refresh, Lock Actions */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
          title="Sinkronkan & Muat Ulang Data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
          <span className="hidden sm:inline">Sinkron Data</span>
        </button>

      </div>
    </header>
  );
}
