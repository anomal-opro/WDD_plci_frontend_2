import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Store } from 'lucide-react';
import { ADMIN_PASSWORD, BRANCH_INFO } from '../shared/constants';

export default function SmartPinLogin({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setError(false);
      onLoginSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-100 font-sans">
      {/* Centered Split Card matching the reference screenshot */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[460px] border border-slate-200/80">
        
        {/* Left Pane: Solid Red / Crimson Hero Branding */}
        <div className="md:w-5/12 bg-[#007a55] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Background Ornament */}
          <div className="absolute -bottom-10 -left-10 w-52 h-52 bg-white/10 rounded-full pointer-events-none"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-black/10 rounded-full pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
              Login
            </h1>
            <p className="text-sm text-green-100/90 leading-relaxed font-medium">
              Silahkan masukkan password agar bisa mengakses Portal Admin Manajemen Keuangan & Operasional.
            </p>
          </div>

          {/* Bottom Branding */}
          <div className="relative z-10 mt-12 md:mt-0 flex items-center gap-3 pt-6 border-t border-white/20">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <Store size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-white">
                {BRANCH_INFO.name}
              </p>
              <p className="text-[11px] text-green-200">
                Portal Admin Keuangan
              </p>
            </div>
          </div>
        </div>

        {/* Right Pane: Clean White Form */}
        <div className="md:w-7/12 bg-white p-8 sm:p-12 flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="max-w-md w-full mx-auto space-y-6">
            
            {/* Input Password Field */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                <span className="text-[#dc2643] font-black mr-1">*</span>Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Masukkan Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(false);
                  }}
                  className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-semibold outline-none transition-colors ${
                    error
                      ? 'border-red-500 focus:border-red-600 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#dc2643] focus:bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-xs font-bold text-[#dc2643] mt-2 flex items-center gap-1">
                  Password salah! Silakan periksa kembali.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="px-8 py-3 bg-[#007a55] hover:bg-[#007a55] active:bg-[#007a55] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Login
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
