import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, RotateCcw, TrendingUp, TrendingDown, DollarSign, 
  AlertTriangle, CheckCircle2, PieChart, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { formatRupiah, parseYearMonthDate } from '../shared/utils';
import { BRANCH_INFO } from '../shared/constants';
import { 
  UnifiedExpenseDB, 
  getFixedExpenseMonthlyNominal, 
  isFixedExpenseActiveOnDate, 
  isFixedExpenseActiveInMonth 
} from '../db/unifiedExpenses';

export default function KeuanganView({ rawData, onRefresh }) {
  // Quick presets & Custom Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dataVersion, setDataVersion] = useState(0);

  // Subscribe ke live MongoDB database pusat
  useEffect(() => {
    const unsub = UnifiedExpenseDB.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    UnifiedExpenseDB.fetchAll();
    return unsub;
  }, []);

  // Handle Preset Filters
  const setFilterToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // Helper convert date string to Date object
  // PRIORITASKAN item.tanggal akuntansi (bukan createdAt audit timestamp)
  const getItemDate = (item) => {
    if (!item) return null;

    if (item.tanggal) {
      const cleanStr = typeof item.tanggal === 'string' ? item.tanggal.trim() : '';

      // 1. Format ISO: YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
        const parts = cleanStr.slice(0, 10).split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d, 0, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) return dateObj;
      }

      // 2. Format Indonesia (e.g. "Senin, 07 September 2026")
      const parsed = parseYearMonthDate(cleanStr);
      if (parsed && parsed.year && parsed.monthIndex !== undefined && parsed.day) {
        const y = parseInt(parsed.year, 10);
        const m = parsed.monthIndex;
        const d = parseInt(parsed.day, 10);
        const dateObj = new Date(y, m, d, 0, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) return dateObj;
      }
    }

    // 3. Fallback hanya jika item.tanggal kosong sama sekali
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }

    return null;
  };

  // Helper calculate transaction income
  const getIncome = (t) => {
    const total = (Number(t.cash) || 0) + (Number(t.bca) || 0) + (Number(t.gofood) || 0) + (Number(t.qris) || 0);
    return total > 0 ? total : (Number(t.totalPendapatan) || Number(t.total) || 0);
  };

  // Date boundary comparison (Strict: tidak boleh ada data bocor di luar tanggal)
  const isWithinDateRange = (itemDate) => {
    if (!itemDate) return false;
    if (startDate) {
      const sParts = startDate.split('-');
      const start = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10), 0, 0, 0, 0);
      if (itemDate < start) return false;
    }
    if (endDate) {
      const eParts = endDate.split('-');
      const end = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10), 23, 59, 59, 999);
      if (itemDate > end) return false;
    }
    return true;
  };

  // Jumlah hari aktif dalam filter
  const filterDaysCount = useMemo(() => {
    if (!startDate && !endDate) return null;
    const s = startDate || endDate;
    const e = endDate || startDate;
    const sParts = s.split('-');
    const eParts = e.split('-');
    const start = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
    const end = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // Filtered sales income for Pecel Lele Cabe Ijo - Kantin SMB (Strict Date Range)
  const grossIncome = useMemo(() => {
    if (!Array.isArray(rawData)) return 0;

    let total = 0;
    rawData.forEach(item => {
      if (item.isDeleted) return;
      const isTargetBranch = item.sheet === BRANCH_INFO.sheetName || item.cabang === BRANCH_INFO.sheetName;
      if (!isTargetBranch) return;

      const isUnpaid = item.jenisPengeluaran && item.jenisPengeluaran.includes('[UNPAID]');
      const isSales = (Number(item.totalPengeluaran) || 0) === 0;

      if (isSales && !isUnpaid) {
        const itemDate = getItemDate(item);
        if (isWithinDateRange(itemDate)) {
          total += getIncome(item);
        }
      }
    });

    return total;
  }, [rawData, startDate, endDate]);

  // Unified expenses for Pecel Lele Cabe Ijo - Kantin SMB
  // Biaya Tetap diamortisasi/dibagi per hari (nominal sebulan / hari dalam bulan tersebut)
  const expenseMetrics = useMemo(() => {
    let bahanBaku = 0;
    let variabel = 0;
    let tetap = 0;

    const unifiedList = UnifiedExpenseDB.getAll();
    const discreteList = unifiedList.filter(item => item.kategori !== 'tetap');
    const fixedList = unifiedList.filter(item => item.kategori === 'tetap');

    // 1. Biaya Diskrit dari UnifiedExpenseDB (Bahan Baku & Variabel)
    discreteList.forEach(item => {
      const itemDate = getItemDate(item);
      if (isWithinDateRange(itemDate)) {
        const nominal = Number(item.nominal) || 0;
        if (item.kategori === 'bahan_baku') {
          bahanBaku += nominal;
        } else {
          variabel += nominal;
        }
      }
    });

    // 2. Dari rawData (transaksi server lama yang ada totalPengeluaran diskrit)
    if (Array.isArray(rawData)) {
      rawData.forEach(item => {
        if (item.isDeleted) return;
        const isTargetBranch = item.sheet === BRANCH_INFO.sheetName || item.cabang === BRANCH_INFO.sheetName;
        if (!isTargetBranch) return;

        const expense = Number(item.totalPengeluaran) || 0;
        if (expense > 0) {
          const itemDate = getItemDate(item);
          if (isWithinDateRange(itemDate)) {
            const isAlreadyTracked = discreteList.some(u => u.nominal === expense && u.tanggal === item.tanggal);
            if (!isAlreadyTracked) {
              variabel += expense;
            }
          }
        }
      });
    }

    // 3. Hitung Biaya Tetap Berdasarkan Prorata Harian
    if (startDate || endDate) {
      // Rentang Tanggal Spesifik: Akumulasikan tangguhan per hari
      const effectiveStartStr = startDate || endDate;
      const effectiveEndStr = endDate || startDate;

      const sParts = effectiveStartStr.split('-');
      const eParts = effectiveEndStr.split('-');
      const cur = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
      const endLimit = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));

      let proratedTetap = 0;
      while (cur <= endLimit) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const d = cur.getDate();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        fixedList.forEach(fe => {
          if (isFixedExpenseActiveOnDate(fe, dateStr)) {
            const freq = (fe.frekuensi || '').toLowerCase();
            const isDaily = freq.includes('hari') && !freq.includes('15');
            const dailyRate = isDaily ? (Number(fe.nominal) || 0) : (getFixedExpenseMonthlyNominal(fe, daysInMonth) / daysInMonth);
            proratedTetap += dailyRate;
          }
        });

        cur.setDate(cur.getDate() + 1);
      }
      tetap = Math.round(proratedTetap);
    } else {
      // Tanpa Filter Tanggal (All Time): Hitung seluruh bulan yang terdapat pada data transaksi/pengeluaran
      const monthYearSet = new Set();
      
      if (Array.isArray(rawData)) {
        rawData.forEach(item => {
          if (item.isDeleted) return;
          const isTargetBranch = item.sheet === BRANCH_INFO.sheetName || item.cabang === BRANCH_INFO.sheetName;
          if (!isTargetBranch) return;
          const d = getItemDate(item);
          if (d) monthYearSet.add(`${d.getFullYear()}-${d.getMonth()}`);
        });
      }

      discreteList.forEach(item => {
        const d = getItemDate(item);
        if (d) monthYearSet.add(`${d.getFullYear()}-${d.getMonth()}`);
      });

      if (monthYearSet.size === 0) {
        const now = new Date();
        monthYearSet.add(`${now.getFullYear()}-${now.getMonth()}`);
      }

      let allTimeTetap = 0;
      monthYearSet.forEach(ym => {
        const [yStr, mStr] = ym.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        fixedList.forEach(fe => {
          if (isFixedExpenseActiveInMonth(fe, y, m)) {
            allTimeTetap += getFixedExpenseMonthlyNominal(fe, daysInMonth);
          }
        });
      });
      tetap = Math.round(allTimeTetap);
    }

    const total = bahanBaku + variabel + tetap;
    return { bahanBaku, variabel, tetap, total };
  }, [rawData, startDate, endDate, dataVersion]);

  // Overall Financial Calculations (100% Khusus Pecel Lele Cabe Ijo - Kantin SMB)
  const netProfit = grossIncome - expenseMetrics.total;
  const isDeficit = netProfit < 0;
  const marginPercentage = grossIncome > 0 ? ((netProfit / grossIncome) * 100).toFixed(1) : 0;

  // Profit Sharing 60:40 (Bunda: 60%, Meri: 40%)
  const profitSharing = useMemo(() => {
    if (netProfit <= 0) {
      return {
        bundaAmount: 0,
        meriAmount: 0,
        hasProfit: false
      };
    }

    return {
      bundaAmount: netProfit * 0.6,
      meriAmount: netProfit * 0.4,
      hasProfit: true
    };
  }, [netProfit]);

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-5 pb-20 select-none">
      
      {/* 1. FILTER RENTANG WAKTU (RESPONSIF HP & DESKTOP) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Quick Filter Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={setFilterToday}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              onClick={setFilterThisMonth}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              Bulan Ini
            </button>
            {(startDate || endDate) && (
              <button
                onClick={handleResetFilter}
                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold whitespace-nowrap flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer w-full"
                />
              </div>

              <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer w-full"
                />
              </div>
            </div>

            {filterDaysCount && (
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold text-center whitespace-nowrap">
                Strict Filter: {filterDaysCount} Hari
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. 3 KARTU METRIK FINANSIAL UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Pendapatan Kotor */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Pendapatan Kotor
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <TrendingUp size={18} />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatRupiah(grossIncome)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Total omzet kasir (Cash, BCA, QRIS)
          </p>
        </div>

        {/* Card 2: Total Pengeluaran */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Total Pengeluaran
              </span>
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <TrendingDown size={18} />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              {formatRupiah(expenseMetrics.total)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {filterDaysCount 
              ? `Bahan baku, operasional variabel & prorata tetap (${filterDaysCount} hari)` 
              : 'Bahan baku, operasional variabel & biaya tetap'}
          </p>
        </div>

        {/* Card 3: Keuntungan Bersih (Net Profit) */}
        <div
          className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-md relative overflow-hidden flex flex-col justify-between ${
            !isDeficit
              ? 'bg-slate-900 border-slate-800 text-white'
              : 'bg-red-600 border-red-700 text-white'
          }`}
        >
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-white/80">
                {!isDeficit ? 'Laba Bersih (Net Profit)' : 'Defisit Berjalan'}
              </span>
              <div className="p-2 rounded-xl bg-white/10 text-white">
                <DollarSign size={18} />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              {formatRupiah(netProfit)}
            </h3>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={!isDeficit ? 'text-emerald-400 font-bold' : 'text-amber-200 font-bold'}>
              {!isDeficit ? `✓ Margin: ${marginPercentage}%` : 'Perlu evaluasi biaya'}
            </span>
            <span className="text-white/60">
              {BRANCH_INFO.name}
            </span>
          </div>
        </div>
      </div>

      {/* 3. RINCIAN STRUKTUR LABA RUGI (100% KHUSUS PECEL LELE CABE IJO KANTIN SMB) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-black text-slate-900">Rincian Laba Rugi</h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {BRANCH_INFO.sheetName}
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {/* Baris 1: Pendapatan Kotor */}
          <div className="flex justify-between items-center p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <ArrowUpRight size={16} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-black text-emerald-900">Pendapatan Kotor (Omzet)</span>
            </div>
            <span className="text-sm font-black text-emerald-700">{formatRupiah(grossIncome)}</span>
          </div>

          {/* Baris 2: Rincian 3 Komponen Biaya */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Beban Pengeluaran Operasional:
            </span>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">1. Biaya Bahan Baku (HPP)</span>
              <span className="font-black text-red-600">- {formatRupiah(expenseMetrics.bahanBaku)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">2. Biaya Variabel (Gas, Plastik, Operasional)</span>
              <span className="font-black text-red-600">- {formatRupiah(expenseMetrics.variabel)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">
                3. Biaya Tetap {filterDaysCount ? `(Prorata: ${filterDaysCount} hari)` : '(Sewa, Gaji, Internet)'}
              </span>
              <span className="font-black text-red-600">- {formatRupiah(expenseMetrics.tetap)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-xs font-black text-slate-900">
              <span>Total Beban Pengeluaran</span>
              <span className="text-red-600">- {formatRupiah(expenseMetrics.total)}</span>
            </div>
          </div>

          {/* Baris 3: Laba Bersih Akhir */}
          <div className={`flex justify-between items-center p-3.5 rounded-xl border ${
            !isDeficit ? 'bg-slate-900 text-white border-slate-800' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            <span className="text-xs font-black">Laba Bersih Setelah Beban</span>
            <span className={`text-base font-black ${!isDeficit ? 'text-emerald-400' : 'text-red-600'}`}>
              {formatRupiah(netProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. KALKULASI BAGI HASIL OTOMATIS (PROFIT SHARING 60:40) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-base font-black text-slate-900">Bagi Hasil Bersih (60:40)</h3>
          <span className="text-xs font-bold text-slate-400">Rasio 60% : 40%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Pihak 1: Bunda (60%) */}
          <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Bunda (60%)
              </span>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">60%</h4>
              <span className="text-[10px] text-slate-400">Dari Net Profit</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Nominal Diterima</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatRupiah(profitSharing.bundaAmount)}
              </span>
            </div>
          </div>

          {/* Pihak 2: Meri (40%) */}
          <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Meri (40%)
              </span>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">40%</h4>
              <span className="text-[10px] text-slate-400">Dari Net Profit</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Nominal Diterima</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatRupiah(profitSharing.meriAmount)}
              </span>
            </div>
          </div>
        </div>

        {!profitSharing.hasProfit && (
          <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 font-semibold text-center border border-slate-200">
            * Bagi hasil saat ini Rp 0 karena arus kas berada di posisi defisit atau break-even.
          </div>
        )}
      </div>
    </div>
  );
}
