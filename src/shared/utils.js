// =============================================================================
// SHARED UTILITIES — Portal Admin PLCI Kantin SMB
// =============================================================================

// --- FORMAT RUPIAH ---
export const formatRupiah = (number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
    .format(number || 0)
    .replace(/\u00A0/g, ' ')
    .replace(/Rp\s?/g, 'Rp. ');

// --- PARSE TANGGAL INDONESIA DARI STRING ATAU DATE OBJECT ---
export const formatIndoDate = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput || '');
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Ambil tanggal hari ini dalam format Indo
export const getTodayStr = () => formatIndoDate(new Date());

// Ekstrak Tahun dan Bulan dari string tanggal "Minggu, 05 April 2026" atau ISO string
export const parseYearMonthDate = (tanggalStr, createdAt) => {
  const monthMap = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
  };

  let year = '';
  let month = '';
  let monthIndex = 0;
  let day = '';

  if (tanggalStr && typeof tanggalStr === 'string') {
    // Pola: "Minggu, 05 April 2026"
    const parts = tanggalStr.split(',');
    const mainPart = parts.length > 1 ? parts[1].trim() : parts[0].trim();
    const tokens = mainPart.split(/\s+/);
    if (tokens.length >= 3) {
      day = tokens[0];
      const mName = tokens[1].toLowerCase();
      year = tokens[2];
      if (monthMap[mName] !== undefined) {
        monthIndex = monthMap[mName];
        month = tokens[1];
      }
    }
  }

  // Fallback to createdAt if valid
  if ((!year || !month) && createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      year = String(d.getFullYear());
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      monthIndex = d.getMonth();
      month = months[monthIndex];
      day = String(d.getDate()).padStart(2, '0');
    }
  }

  return {
    year: year || '2026',
    month: month || 'Lainnya',
    monthIndex,
    day: day || '01',
    fullDateStr: tanggalStr || `${day} ${month} ${year}`
  };
};

// --- LOGIKA KATEGORISASI OTOMATIS PENGELUARAN ---
// - tetap: Mengandung [rutin], [recurring], atau [tetap]
// - bahan_baku: Mengandung [bahan baku], [hpp], atau kata kunci:
//   lele, ayam, bebek, cabe, cabai, minyak, beras, bumbu, tahu, tempe, lalapan, telur, bawang, tomat
// - variabel: Pengeluaran operasional lainnya (default)
export const categorizeExpense = (item) => {
  const text = (item.jenisPengeluaran || '').toLowerCase();

  // 1. Cek Biaya Tetap
  if (text.includes('[rutin]') || text.includes('[recurring]') || text.includes('[tetap]')) {
    return 'tetap';
  }

  // 2. Cek Bahan Baku (HPP)
  if (text.includes('[bahan baku]') || text.includes('[hpp]')) {
    return 'bahan_baku';
  }

  const bahanBakuKeywords = [
    'lele', 'ayam', 'bebek', 'cabe', 'cabai', 'minyak',
    'beras', 'bumbu', 'tahu', 'tempe', 'lalapan', 'telur',
    'bawang', 'tomat'
  ];

  for (const kw of bahanBakuKeywords) {
    // Regex word boundary atau inclusion check
    const regex = new RegExp(`\\b${kw}`, 'i');
    if (regex.test(text) || text.includes(kw)) {
      return 'bahan_baku';
    }
  }

  // 3. Default: Biaya Variabel
  return 'variabel';
};

// --- KALKULASI JATUH TEMPO BIAYA RUTIN BERIKUTNYA ---
export const getNextPaymentDate = (r) => {
  if (!r) return "-";
  let nextDate = r.lastApplied ? new Date(r.lastApplied) : new Date(r.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Jika sudah pernah dipotong (lastApplied ada), majukan 1 interval ke depan
  if (r.lastApplied) {
    if (r.frekuensi === 'bulanan' || r.frekuensi === 'Per Bulan') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (r.frekuensi === 'tahunan' || r.frekuensi === 'Per Tahun') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (r.frekuensi === 'harian' || r.frekuensi === 'Per Hari') nextDate.setDate(nextDate.getDate() + (Number(r.intervalHari) || 1));
  }

  // Jika tanggal masih di masa lalu, majukan terus sampai >= hari ini
  while (nextDate < today) {
    if (r.frekuensi === 'bulanan' || r.frekuensi === 'Per Bulan') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (r.frekuensi === 'tahunan' || r.frekuensi === 'Per Tahun') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (r.frekuensi === 'harian' || r.frekuensi === 'Per Hari') nextDate.setDate(nextDate.getDate() + (Number(r.intervalHari) || 1));
    else break;
  }

  // Jika melewati tanggal berakhir
  if (r.endDate && nextDate > new Date(r.endDate)) {
    return "Sudah Berakhir";
  }

  return nextDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// --- PARSER STRUK DETAIL TRANSAKSI ---
export const parseItemsString = (itemsStr) => {
  const cleanInput = (itemsStr || '').replace(/^(?:\[[^\]]+\]\s*)*/, '');
  const itemArray = cleanInput.split(',').map(i => i.trim()).filter(Boolean);
  let orderType = '';
  let cabbageOpt = '';
  let sambalOpt = '';
  let note = '';
  let payMethod = '';
  let payGiven = 0;
  let payChange = 0;
  let realItems = [];

  // Parse order notes or raw items
  itemArray.forEach(item => {
    if (item.startsWith('**')) {
      const cleanStr = item.replace(/\*/g, '').trim();
      if (cleanStr === 'MAKAN SINI' || cleanStr === 'BUNGKUS' || cleanStr === 'BAWA PULANG') {
        orderType = cleanStr;
      } else if (cleanStr.includes('KOL')) {
        cabbageOpt = cleanStr;
      } else {
        sambalOpt = cleanStr;
      }
    } else if (item.startsWith('++ CATATAN:')) {
      note = item.replace('++ CATATAN:', '').trim();
    } else if (item.startsWith('++ PAY:')) {
      const splitPay = item.replace('++ PAY:', '').trim().split('|');
      payMethod = splitPay[0];
      payGiven = parseInt(splitPay[1], 10) || 0;
      payChange = parseInt(splitPay[2], 10) || 0;
    } else {
      const parts = item.split('::');
      const mainItem = parts[0].trim();
      const subOptions = parts.length > 1
        ? parts[1].split('|').map(s => s.trim()).filter(Boolean)
        : [];
      realItems.push({ main: mainItem, sub: subOptions });
    }
  });

  return { orderType, cabbageOpt, sambalOpt, note, payMethod, payGiven, payChange, realItems };
};
