import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { BRANCH_INFO } from '../shared/constants';

export default function PinScreen0505({ onSuccess }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === '0505') {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center p-4">
      {/* Split Card matching the website's clean login aesthetic */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[420px] border border-slate-200/80">
        
        {/* Left Pane: Solid Emerald / Green Hero Branding */}
        <div className="md:w-5/12 bg-[#007a55] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 text-green-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4 border border-white/20">
              PIN Proteksi Khusus
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
              Sistem Pengeluaran
            </h2>
            <p className="text-xs text-green-100/90 leading-relaxed font-medium">
              Masukkan PIN otorisasi khusus untuk mengakses modul pencatatan dan pengelolaan pengeluaran keuangan.
            </p>
          </div>

          <div className="relative z-10 mt-8 pt-4 border-t border-white/20 text-xs text-green-200">
            <p className="font-bold text-white uppercase tracking-wider">{BRANCH_INFO.name}</p>
            <p className="text-[11px] text-green-200/80">Otoritas Pencatatan Biaya</p>
          </div>
        </div>

        {/* Right Pane: Clean White Form */}
        <div className="md:w-7/12 bg-white p-8 sm:p-10 flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="max-w-sm w-full mx-auto space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                <span className="text-[#007a55] font-black mr-1">*</span>PIN Pengeluaran
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  autoFocus
                  maxLength={6}
                  placeholder="Masukkan PIN (4 Digit)"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (error) setError(false);
                  }}
                  className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-semibold outline-none transition-colors ${
                    error
                      ? 'border-red-500 focus:border-red-600 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#007a55] focus:bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p className="text-xs font-bold text-red-600 mt-2">
                  PIN Pengeluaran salah! Harap masukkan PIN yang valid.
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-[#007a55] hover:bg-[#006647] active:bg-[#005239] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Buka Akses Pengeluaran</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
