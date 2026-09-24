import React from 'react';
import { formatRupiah } from '../shared/utils';

export default function ExpenseVisualChart({ bahanBaku = 0, tetap = 0, variabel = 0 }) {
  const grandTotal = bahanBaku + tetap + variabel;

  const pctBahan = grandTotal > 0 ? ((bahanBaku / grandTotal) * 100) : 0;
  const pctTetap = grandTotal > 0 ? ((tetap / grandTotal) * 100) : 0;
  const pctVariabel = grandTotal > 0 ? ((variabel / grandTotal) * 100) : 0;

  const categories = [
    {
      id: 'bahan_baku',
      label: 'Bahan Baku',
      nominal: bahanBaku,
      pct: pctBahan,
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      dotColor: '#10b981',
      bgLight: 'bg-emerald-50/70',
    },
    {
      id: 'tetap',
      label: 'Biaya Tetap',
      nominal: tetap,
      pct: pctTetap,
      barColor: 'bg-blue-500',
      textColor: 'text-blue-700',
      dotColor: '#3b82f6',
      bgLight: 'bg-blue-50/70',
    },
    {
      id: 'variabel',
      label: 'Biaya Variabel',
      nominal: variabel,
      pct: pctVariabel,
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      dotColor: '#f59e0b',
      bgLight: 'bg-amber-50/70',
    }
  ];

  const maxVal = Math.max(bahanBaku, tetap, variabel, 1);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 select-none">
      {/* 1. Proportional Stacked Bar (3 Colors Max: Emerald, Blue, Amber) */}
      <div className="w-full h-3.5 sm:h-4 rounded-full overflow-hidden flex bg-slate-100 p-0.5">
        {pctBahan > 0 && (
          <div
            style={{ width: `${pctBahan}%` }}
            className="h-full bg-emerald-500 transition-all duration-300 rounded-l-full"
            title={`Bahan Baku: ${pctBahan.toFixed(1)}%`}
          />
        )}
        {pctTetap > 0 && (
          <div
            style={{ width: `${pctTetap}%` }}
            className={`h-full bg-blue-500 transition-all duration-300 ${pctBahan === 0 ? 'rounded-l-full' : ''} ${pctVariabel === 0 ? 'rounded-r-full' : ''}`}
            title={`Biaya Tetap: ${pctTetap.toFixed(1)}%`}
          />
        )}
        {pctVariabel > 0 && (
          <div
            style={{ width: `${pctVariabel}%` }}
            className="h-full bg-amber-500 transition-all duration-300 rounded-r-full"
            title={`Biaya Variabel: ${pctVariabel.toFixed(1)}%`}
          />
        )}
      </div>

      {/* 2. Side-by-Side 3-Color Comparative Metric Columns */}
      <div className="grid grid-cols-3 gap-3">
        {categories.map((c) => {
          const heightPct = Math.round((c.nominal / maxVal) * 100);

          return (
            <div key={c.id} className={`${c.bgLight} p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dotColor }} />
                  <span className="text-[11px] font-black text-slate-700 truncate">{c.label}</span>
                </div>
                <p className={`text-sm sm:text-base font-black ${c.textColor}`}>
                  {formatRupiah(c.nominal)}
                </p>
                <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                  {c.pct.toFixed(1)}%
                </span>
              </div>

              {/* Relative Indicator Bar */}
              <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full ${c.barColor} transition-all duration-300`}
                  style={{ width: `${heightPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
