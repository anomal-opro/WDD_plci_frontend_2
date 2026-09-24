// =============================================================================
// UNIFIED EXPENSE MANAGEMENT SERVICE & REPOSITORY
// Murni terhubung langsung ke Database MongoDB Pusat (The One and Only)
// Tanpa database internal/dummy/localStorage yang menahan data kadaluarsa
// =============================================================================

import { EXPENSES_URL } from '../shared/constants.js';
import { formatRupiah } from '../shared/utils.js';

let liveExpenses = [];
let listeners = new Set();

function notify() {
  listeners.forEach(cb => {
    try { cb(liveExpenses); } catch (e) {}
  });
}

// Bersihkan tuntas seluruh residu localStorage dummy lama di browser user
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('unified_expenses_records');
    localStorage.removeItem('pengeluaran_biaya_bahan_baku');
    localStorage.removeItem('pengeluaran_biaya_tetap');
    localStorage.removeItem('pengeluaran_biaya_variabel');
    localStorage.removeItem('pengeluaran_auto_increment');
  } catch (e) {}
}

// Helper: Hitung nominal bulanan standar dari frekuensi biaya tetap
export function getFixedExpenseMonthlyNominal(item, daysInMonth = 30) {
  const nominal = Number(item.nominal) || 0;
  const freq = (item.frekuensi || 'Per Bulan').toLowerCase();
  if (freq.includes('hari') && !freq.includes('15')) return nominal * daysInMonth;
  if (freq.includes('tahun')) return nominal / 12;
  if (freq.includes('6 bulan')) return nominal / 6;
  if (freq.includes('3 bulan')) return nominal / 3;
  if (freq.includes('2 bulan')) return nominal / 2;
  if (freq.includes('15 hari')) return (nominal * 30) / 15;
  if (freq.includes('minggu')) return (nominal * 30) / 7;
  return nominal; // Default 'Per Bulan'
}

// Helper: Hitung nominal harian (daily rate) untuk hari/tanggal tertentu
export function getFixedExpenseDailyRate(item, daysInMonth = 30) {
  const nominal = Number(item.nominal) || 0;
  const freq = (item.frekuensi || 'Per Bulan').toLowerCase();
  if (freq.includes('hari') && !freq.includes('15')) {
    return nominal;
  }
  if (freq.includes('minggu')) {
    return nominal / 7;
  }
  if (freq.includes('15 hari')) {
    return nominal / 15;
  }
  const monthlyAmount = getFixedExpenseMonthlyNominal(item, daysInMonth);
  return monthlyAmount / daysInMonth;
}

// Helper: Cek apakah biaya tetap aktif pada tanggal tertentu (YYYY-MM-DD)
export function isFixedExpenseActiveOnDate(item, dateStr) {
  if (!item || item.kategori !== 'tetap') return false;
  const startStr = (item.tanggal || '2026-01-01').split('T')[0];
  const endStr = item.endDate ? item.endDate.split('T')[0] : null;

  if (dateStr < startStr) return false;
  if (endStr && dateStr > endStr) return false;
  return true;
}

// Helper: Cek apakah biaya tetap aktif pada bulan tertentu (year, monthIdx 0-11)
export function isFixedExpenseActiveInMonth(item, year, monthIdx) {
  if (!item || item.kategori !== 'tetap') return false;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthStart = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  
  const startStr = (item.tanggal || '2026-01-01').split('T')[0];
  const endStr = item.endDate ? item.endDate.split('T')[0] : null;

  // Jika item berakhir sebelum awal bulan ini, tidak aktif
  if (endStr && endStr < monthStart) return false;
  // Jika item mulai setelah akhir bulan ini, belum aktif
  if (startStr > monthEnd) return false;

  return true;
}

export const UnifiedExpenseDB = {
  // Subscribe to live database updates
  subscribe: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  // Synchronous getter for current live data in memory
  getAll: () => {
    return liveExpenses;
  },

  // Asynchronous fetch directly from MongoDB database pusat
  fetchAll: async () => {
    if (!EXPENSES_URL) return [];
    try {
      const res = await fetch(EXPENSES_URL);
      if (res.ok) {
        const data = await res.json();
        liveExpenses = Array.isArray(data) ? data : [];
        notify();
        return liveExpenses;
      }
      liveExpenses = [];
      notify();
      return [];
    } catch (err) {
      console.warn('Gagal mengambil data pengeluaran dari MongoDB pusat:', err.message);
      liveExpenses = [];
      notify();
      return [];
    }
  },

  // Create new expense directly in MongoDB database
  create: async (item) => {
    let calculatedNominal = Number(item.nominal) || 0;
    if (calculatedNominal === 0 && item.kuantitas && item.harga_satuan) {
      calculatedNominal = Number(item.kuantitas) * Number(item.harga_satuan);
    }

    let kategoriLabel = 'Biaya Variabel';
    if (item.kategori === 'bahan_baku') kategoriLabel = 'Biaya Bahan Baku';
    else if (item.kategori === 'tetap') kategoriLabel = 'Biaya Tetap';

    const payload = {
      ...item,
      nominal: calculatedNominal,
      kategoriLabel
    };

    if (!EXPENSES_URL) return null;

    try {
      const res = await fetch(EXPENSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        // Langsung refetch dari MongoDB pusat untuk memastikan 100% konsisten
        await UnifiedExpenseDB.fetchAll();
        return result.data || result;
      }
    } catch (e) {
      console.error('Gagal menyimpan pengeluaran ke MongoDB pusat:', e);
    }
    return null;
  },

  // Delete expense directly and permanently from MongoDB database
  delete: async (id) => {
    if (!id || !EXPENSES_URL) return;

    try {
      await fetch(`${EXPENSES_URL}/${id}`, {
        method: 'DELETE'
      });
      // Langsung refetch dari MongoDB pusat agar data yang terhapus langsung hilang seketika
      await UnifiedExpenseDB.fetchAll();
    } catch (e) {
      console.error('Gagal menghapus pengeluaran dari MongoDB pusat:', e);
    }
    return liveExpenses;
  },

  // Filter personal history by employee
  getByEmployee: (employeeName) => {
    if (!employeeName) return liveExpenses;
    return liveExpenses.filter(item => (item.karyawan || '').toLowerCase().includes(employeeName.toLowerCase()));
  },

  // Hierarchical aggregation calculated directly on live MongoDB records
  // Biaya Tetap diamortisasi/dibagi per hari (nominal sebulan / hari dalam bulan tersebut)
  getHierarchy: () => {
    const list = liveExpenses;
    if (!Array.isArray(list) || list.length === 0) return [];

    const monthsNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // Pisahkan pengeluaran diskrit (bahan baku & variabel) dan biaya tetap rutin
    const discreteList = list.filter(item => item.kategori !== 'tetap');
    const fixedList = list.filter(item => item.kategori === 'tetap');

    // 1. Kumpulkan semua Year & Month yang relevan
    const yearMonthPairs = new Set();

    // Dari pengeluaran diskrit
    discreteList.forEach(item => {
      const d = item.tanggal ? new Date(item.tanggal) : new Date();
      const y = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      const m = isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth();
      yearMonthPairs.add(`${y}-${m}`);
    });

    // Dari biaya tetap yang aktif
    const now = new Date();
    fixedList.forEach(fe => {
      const startD = fe.tanggal ? new Date(fe.tanggal) : new Date();
      const startY = isNaN(startD.getFullYear()) ? now.getFullYear() : startD.getFullYear();
      const startM = isNaN(startD.getMonth()) ? now.getMonth() : startD.getMonth();

      let endY = now.getFullYear();
      let endM = now.getMonth();
      if (fe.endDate) {
        const endD = new Date(fe.endDate);
        if (!isNaN(endD.getFullYear())) {
          endY = endD.getFullYear();
          endM = endD.getMonth();
        }
      }

      // Rentang bulan dari start sampai end (dibatasi wajar)
      let curY = startY;
      let curM = startM;
      while (curY < endY || (curY === endY && curM <= endM)) {
        yearMonthPairs.add(`${curY}-${curM}`);
        curM++;
        if (curM > 11) {
          curM = 0;
          curY++;
        }
        if (curY > endY + 2) break; // guard
      }
    });

    // Jika belum ada data sama sekali
    if (yearMonthPairs.size === 0) return [];

    const yearsMap = {};

    // Inisialisasi struktur tahun dan bulan
    yearMonthPairs.forEach(pair => {
      const [yearStr, mIdxStr] = pair.split('-');
      const year = yearStr;
      const monthIdx = parseInt(mIdxStr, 10);
      const monthName = monthsNames[monthIdx];

      if (!yearsMap[year]) {
        yearsMap[year] = {
          year,
          grandTotal: 0,
          bahanBaku: 0,
          tetap: 0,
          variabel: 0,
          count: 0,
          months: {}
        };
      }

      if (!yearsMap[year].months[monthName]) {
        yearsMap[year].months[monthName] = {
          month: monthName,
          monthIndex: monthIdx,
          year,
          grandTotal: 0,
          bahanBaku: 0,
          tetap: 0,
          variabel: 0,
          count: 0,
          days: {}
        };
      }
    });

    // 2. Masukkan Pengeluaran Diskrit (Bahan Baku & Variabel) ke hari bersangkutan
    discreteList.forEach(item => {
      const dateObj = item.tanggal ? new Date(item.tanggal) : new Date();
      const year = isNaN(dateObj.getFullYear()) ? String(new Date().getFullYear()) : String(dateObj.getFullYear());
      const monthIdx = isNaN(dateObj.getMonth()) ? new Date().getMonth() : dateObj.getMonth();
      const monthName = monthsNames[monthIdx];
      const dayStr = (item.tanggal || new Date().toISOString().split('T')[0]).split('T')[0];
      const nominal = Number(item.nominal) || 0;

      if (!yearsMap[year] || !yearsMap[year].months[monthName]) return;

      const monthNode = yearsMap[year].months[monthName];

      if (!monthNode.days[dayStr]) {
        monthNode.days[dayStr] = {
          dateStr: dayStr,
          dayNumber: parseInt(dayStr.split('-')[2], 10) || dateObj.getDate() || 1,
          month: monthName,
          year,
          grandTotal: 0,
          bahanBaku: 0,
          tetap: 0,
          variabel: 0,
          count: 0,
          logs: []
        };
      }

      const dayNode = monthNode.days[dayStr];
      dayNode.grandTotal += nominal;
      dayNode.count += 1;
      if (item.kategori === 'bahan_baku') {
        dayNode.bahanBaku += nominal;
      } else {
        dayNode.variabel += nominal;
      }
      dayNode.logs.push(item);
    });

    // 3. Masukkan & Amortisasi Biaya Tetap per Hari untuk Setiap Bulan
    // Rumus: harga sebulan / jumlah hari di bulan tersebut
    Object.values(yearsMap).forEach(yearNode => {
      const yearInt = parseInt(yearNode.year, 10);

      Object.values(yearNode.months).forEach(monthNode => {
        const monthIdx = monthNode.monthIndex;
        const daysInMonth = new Date(yearInt, monthIdx + 1, 0).getDate();

        // Cari biaya tetap yang aktif di bulan ini
        const activeFixedInMonth = fixedList.filter(fe => isFixedExpenseActiveInMonth(fe, yearInt, monthIdx));

        // Untuk setiap hari di bulan ini (1 sampai daysInMonth)
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${yearNode.year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

          // Cek biaya tetap yang aktif pada hari spesifik ini
          const activeOnThisDay = activeFixedInMonth.filter(fe => isFixedExpenseActiveOnDate(fe, dayStr));

          if (activeOnThisDay.length > 0) {
            // Pastikan node hari ada
            if (!monthNode.days[dayStr]) {
              monthNode.days[dayStr] = {
                dateStr: dayStr,
                dayNumber: d,
                month: monthNode.month,
                year: yearNode.year,
                grandTotal: 0,
                bahanBaku: 0,
                tetap: 0,
                variabel: 0,
                count: 0,
                logs: []
              };
            }

            const dayNode = monthNode.days[dayStr];

            // Tambahkan porsi harian masing-masing biaya tetap
            activeOnThisDay.forEach(fe => {
              const freq = (fe.frekuensi || '').toLowerCase();
              const isDaily = freq.includes('hari') && !freq.includes('15');
              const dailyRate = isDaily ? (Number(fe.nominal) || 0) : (getFixedExpenseMonthlyNominal(fe, daysInMonth) / daysInMonth);
              const roundedDaily = Math.round(dailyRate);

              dayNode.tetap += dailyRate;
              dayNode.grandTotal += dailyRate;
              dayNode.count += 1;

              // Tambahkan virtual log item prorata / rutin harian
              dayNode.logs.push({
                _id: `prorated_${fe._id || fe.id}_${dayStr}`,
                sourceId: fe._id || fe.id,
                tanggal: dayStr,
                kategori: 'tetap',
                kategoriLabel: isDaily ? 'Biaya Tetap (Rutin Harian)' : 'Biaya Tetap (Prorata Harian)',
                nama_item: fe.nama_item,
                nominal: roundedDaily,
                exactNominal: dailyRate,
                karyawan: fe.karyawan || 'Operasional',
                frekuensi: fe.frekuensi || (isDaily ? 'Per Hari' : 'Per Bulan'),
                durasi: fe.durasi || 'Berkelanjutan',
                endDate: fe.endDate,
                isProrated: true,
                keterangan: isDaily 
                  ? `Biaya rutin harian (${formatRupiah(roundedDaily)} / hari)` 
                  : `Prorata harian (Rp ${getFixedExpenseMonthlyNominal(fe, daysInMonth).toLocaleString('id-ID')} / ${daysInMonth} hari)`
              });
            });
          }
        }

        // Bulatkan total per hari setelah seluruh biaya diakumulasi
        Object.values(monthNode.days).forEach(dayNode => {
          dayNode.tetap = Math.round(dayNode.tetap);
          dayNode.grandTotal = Math.round(dayNode.grandTotal);
        });

        // 4. Rekapitulasi Level Bulan
        monthNode.bahanBaku = Object.values(monthNode.days).reduce((acc, d) => acc + d.bahanBaku, 0);
        monthNode.variabel = Object.values(monthNode.days).reduce((acc, d) => acc + d.variabel, 0);
        monthNode.tetap = Object.values(monthNode.days).reduce((acc, d) => acc + d.tetap, 0);
        monthNode.grandTotal = monthNode.bahanBaku + monthNode.variabel + monthNode.tetap;
        monthNode.count = Object.values(monthNode.days).reduce((acc, d) => acc + d.count, 0);
      });

      // 5. Rekapitulasi Level Tahun
      yearNode.bahanBaku = Object.values(yearNode.months).reduce((acc, m) => acc + m.bahanBaku, 0);
      yearNode.variabel = Object.values(yearNode.months).reduce((acc, m) => acc + m.variabel, 0);
      yearNode.tetap = Object.values(yearNode.months).reduce((acc, m) => acc + m.tetap, 0);
      yearNode.grandTotal = yearNode.bahanBaku + yearNode.variabel + yearNode.tetap;
      yearNode.count = Object.values(yearNode.months).reduce((acc, m) => acc + m.count, 0);
    });

    return Object.values(yearsMap).sort((a, b) => parseInt(b.year) - parseInt(a.year));
  }
};

// Auto fetch awal saat aplikasi dibuka di browser
if (typeof window !== 'undefined') {
  UnifiedExpenseDB.fetchAll().catch(() => {});
}

