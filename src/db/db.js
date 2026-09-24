// Database Service & LocalStorage Persistence for Sistem Pengeluaran
// Menangani 3 tabel: biaya_bahan_baku, biaya_tetap, biaya_variabel

const STORAGE_KEYS = {
  BAHAN_BAKU: 'pengeluaran_biaya_bahan_baku',
  BIAYA_TETAP: 'pengeluaran_biaya_tetap',
  BIAYA_VARIABEL: 'pengeluaran_biaya_variabel',
  AUTO_INC: 'pengeluaran_auto_increment'
};

// Seed awal data jika storage masih kosong
const INITIAL_SEEDS = {
  bahan_baku: [
    {
      id_bahan_baku: 1,
      tanggal: '2026-09-20',
      nama_bahan: 'Beras Premium Ramos',
      supplier: 'Toko Beras Jaya',
      kuantitas: 50,
      satuan: 'kg',
      harga_satuan: 14000,
      total_biaya: 700000
    },
    {
      id_bahan_baku: 2,
      tanggal: '2026-09-21',
      nama_bahan: 'Ayam Broiler Segar',
      supplier: 'Agen Unggas Berkah',
      kuantitas: 25,
      satuan: 'kg',
      harga_satuan: 38000,
      total_biaya: 950000
    },
    {
      id_bahan_baku: 3,
      tanggal: '2026-09-22',
      nama_bahan: 'Minyak Goreng Sawit',
      supplier: 'Distributor Sembako Mandiri',
      kuantitas: 20,
      satuan: 'liter',
      harga_satuan: 17500,
      total_biaya: 350000
    },
    {
      id_bahan_baku: 4,
      tanggal: '2026-09-22',
      nama_bahan: 'Cabai Merah Keriting',
      supplier: 'Pasar Induk Kramat',
      kuantitas: 10,
      satuan: 'kg',
      harga_satuan: 45000,
      total_biaya: 450000
    }
  ],
  biaya_tetap: [
    {
      id_biaya_tetap: 1,
      tanggal_bayar: '2026-09-01',
      nama_pengeluaran: 'Sewa Ruko Utama',
      periode: 'Bulanan',
      jumlah_biaya: 4500000,
      keterangan: 'Pembayaran sewa ruko lantai 1 & 2 periode September 2026'
    },
    {
      id_biaya_tetap: 2,
      tanggal_bayar: '2026-09-05',
      nama_pengeluaran: 'Gaji Karyawan Operasional',
      periode: 'Bulanan',
      jumlah_biaya: 8000000,
      keterangan: 'Gaji 4 staf dapur dan pelayanan'
    },
    {
      id_biaya_tetap: 3,
      tanggal_bayar: '2026-09-10',
      nama_pengeluaran: 'Internet & Telepon Ruko',
      periode: 'Bulanan',
      jumlah_biaya: 450000,
      keterangan: 'Langganan paket internet 100 Mbps'
    }
  ],
  biaya_variabel: [
    {
      id_biaya_variabel: 1,
      tanggal: '2026-09-18',
      nama_item: 'Gas LPG 12 Kg',
      kuantitas: 4,
      satuan: 'tabung',
      harga_satuan: 215000,
      total_biaya: 860000,
      keterangan: 'Refill gas LPG dapur utama'
    },
    {
      id_biaya_variabel: 2,
      tanggal: '2026-09-19',
      nama_item: 'Plastik & Paper Box Takeaway',
      kuantitas: 500,
      satuan: 'pcs',
      harga_satuan: 1200,
      total_biaya: 600000,
      keterangan: 'Kemasan makanan bungkus / ojek online'
    },
    {
      id_biaya_variabel: 3,
      tanggal: '2026-09-21',
      nama_item: 'Token Listrik Tambahan',
      kuantitas: 1,
      satuan: 'voucher',
      harga_satuan: 250000,
      total_biaya: 250000,
      keterangan: 'Beli pulsa listrik PLN 250k'
    }
  ]
};

function getAutoIncState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTO_INC);
    if (!raw) {
      return { bahan_baku: 5, biaya_tetap: 4, biaya_variabel: 4 };
    }
    return JSON.parse(raw);
  } catch (e) {
    return { bahan_baku: 5, biaya_tetap: 4, biaya_variabel: 4 };
  }
}

function saveAutoIncState(state) {
  localStorage.setItem(STORAGE_KEYS.AUTO_INC, JSON.stringify(state));
}

// --- INITIALIZE DATA STORE ---
export function initDatabase() {
  if (!localStorage.getItem(STORAGE_KEYS.BAHAN_BAKU)) {
    localStorage.setItem(STORAGE_KEYS.BAHAN_BAKU, JSON.stringify(INITIAL_SEEDS.bahan_baku));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BIAYA_TETAP)) {
    localStorage.setItem(STORAGE_KEYS.BIAYA_TETAP, JSON.stringify(INITIAL_SEEDS.biaya_tetap));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BIAYA_VARIABEL)) {
    localStorage.setItem(STORAGE_KEYS.BIAYA_VARIABEL, JSON.stringify(INITIAL_SEEDS.biaya_variabel));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUTO_INC)) {
    saveAutoIncState({ bahan_baku: 5, biaya_tetap: 4, biaya_variabel: 4 });
  }
}

// -------------------------------------------------------------
// 1. TABEL: biaya_bahan_baku
// Kolom: id_bahan_baku, tanggal, nama_bahan, supplier, kuantitas, satuan, harga_satuan, total_biaya
// -------------------------------------------------------------
export const BahanBakuDB = {
  getAll: () => {
    initDatabase();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BAHAN_BAKU) || '[]');
    } catch (e) {
      return [];
    }
  },

  create: (item) => {
    const list = BahanBakuDB.getAll();
    const autoInc = getAutoIncState();
    const newId = autoInc.bahan_baku;
    autoInc.bahan_baku += 1;
    saveAutoIncState(autoInc);

    const kuantitas = Number(item.kuantitas) || 0;
    const harga_satuan = Number(item.harga_satuan) || 0;
    const total_biaya = kuantitas * harga_satuan;

    const record = {
      id_bahan_baku: newId,
      tanggal: item.tanggal,
      nama_bahan: (item.nama_bahan || '').trim(),
      supplier: (item.supplier || '').trim(),
      kuantitas,
      satuan: (item.satuan || '').trim(),
      harga_satuan,
      total_biaya
    };

    list.unshift(record); // Data terbaru di atas
    localStorage.setItem(STORAGE_KEYS.BAHAN_BAKU, JSON.stringify(list));
    return record;
  },

  update: (id, item) => {
    const list = BahanBakuDB.getAll();
    const kuantitas = Number(item.kuantitas) || 0;
    const harga_satuan = Number(item.harga_satuan) || 0;
    const total_biaya = kuantitas * harga_satuan;

    const updatedList = list.map((row) => {
      if (row.id_bahan_baku === Number(id)) {
        return {
          ...row,
          tanggal: item.tanggal,
          nama_bahan: (item.nama_bahan || '').trim(),
          supplier: (item.supplier || '').trim(),
          kuantitas,
          satuan: (item.satuan || '').trim(),
          harga_satuan,
          total_biaya
        };
      }
      return row;
    });

    localStorage.setItem(STORAGE_KEYS.BAHAN_BAKU, JSON.stringify(updatedList));
    return updatedList;
  },

  delete: (id) => {
    const list = BahanBakuDB.getAll();
    const filtered = list.filter((row) => row.id_bahan_baku !== Number(id));
    localStorage.setItem(STORAGE_KEYS.BAHAN_BAKU, JSON.stringify(filtered));
    return filtered;
  },

  getTotalExpense: () => {
    const list = BahanBakuDB.getAll();
    return list.reduce((acc, curr) => acc + (Number(curr.total_biaya) || 0), 0);
  }
};

// -------------------------------------------------------------
// 2. TABEL: biaya_tetap
// Kolom: id_biaya_tetap, tanggal_bayar, nama_pengeluaran, periode, jumlah_biaya, keterangan
// -------------------------------------------------------------
export const BiayaTetapDB = {
  getAll: () => {
    initDatabase();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BIAYA_TETAP) || '[]');
    } catch (e) {
      return [];
    }
  },

  create: (item) => {
    const list = BiayaTetapDB.getAll();
    const autoInc = getAutoIncState();
    const newId = autoInc.biaya_tetap;
    autoInc.biaya_tetap += 1;
    saveAutoIncState(autoInc);

    const jumlah_biaya = Number(item.jumlah_biaya) || 0;

    const record = {
      id_biaya_tetap: newId,
      tanggal_bayar: item.tanggal_bayar,
      nama_pengeluaran: (item.nama_pengeluaran || '').trim(),
      periode: (item.periode || 'Bulanan').trim(),
      jumlah_biaya,
      keterangan: (item.keterangan || '').trim()
    };

    list.unshift(record);
    localStorage.setItem(STORAGE_KEYS.BIAYA_TETAP, JSON.stringify(list));
    return record;
  },

  update: (id, item) => {
    const list = BiayaTetapDB.getAll();
    const jumlah_biaya = Number(item.jumlah_biaya) || 0;

    const updatedList = list.map((row) => {
      if (row.id_biaya_tetap === Number(id)) {
        return {
          ...row,
          tanggal_bayar: item.tanggal_bayar,
          nama_pengeluaran: (item.nama_pengeluaran || '').trim(),
          periode: (item.periode || 'Bulanan').trim(),
          jumlah_biaya,
          keterangan: (item.keterangan || '').trim()
        };
      }
      return row;
    });

    localStorage.setItem(STORAGE_KEYS.BIAYA_TETAP, JSON.stringify(updatedList));
    return updatedList;
  },

  delete: (id) => {
    const list = BiayaTetapDB.getAll();
    const filtered = list.filter((row) => row.id_biaya_tetap !== Number(id));
    localStorage.setItem(STORAGE_KEYS.BIAYA_TETAP, JSON.stringify(filtered));
    return filtered;
  },

  getTotalExpense: () => {
    const list = BiayaTetapDB.getAll();
    return list.reduce((acc, curr) => acc + (Number(curr.jumlah_biaya) || 0), 0);
  }
};

// -------------------------------------------------------------
// 3. TABEL: biaya_variabel
// Kolom: id_biaya_variabel, tanggal, nama_item, kuantitas, satuan, harga_satuan, total_biaya, keterangan
// -------------------------------------------------------------
export const BiayaVariabelDB = {
  getAll: () => {
    initDatabase();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BIAYA_VARIABEL) || '[]');
    } catch (e) {
      return [];
    }
  },

  create: (item) => {
    const list = BiayaVariabelDB.getAll();
    const autoInc = getAutoIncState();
    const newId = autoInc.biaya_variabel;
    autoInc.biaya_variabel += 1;
    saveAutoIncState(autoInc);

    const kuantitas = Number(item.kuantitas) || 0;
    const harga_satuan = Number(item.harga_satuan) || 0;
    const total_biaya = kuantitas * harga_satuan;

    const record = {
      id_biaya_variabel: newId,
      tanggal: item.tanggal,
      nama_item: (item.nama_item || '').trim(),
      kuantitas,
      satuan: (item.satuan || '').trim(),
      harga_satuan,
      total_biaya,
      keterangan: (item.keterangan || '').trim()
    };

    list.unshift(record);
    localStorage.setItem(STORAGE_KEYS.BIAYA_VARIABEL, JSON.stringify(list));
    return record;
  },

  update: (id, item) => {
    const list = BiayaVariabelDB.getAll();
    const kuantitas = Number(item.kuantitas) || 0;
    const harga_satuan = Number(item.harga_satuan) || 0;
    const total_biaya = kuantitas * harga_satuan;

    const updatedList = list.map((row) => {
      if (row.id_biaya_variabel === Number(id)) {
        return {
          ...row,
          tanggal: item.tanggal,
          nama_item: (item.nama_item || '').trim(),
          kuantitas,
          satuan: (item.satuan || '').trim(),
          harga_satuan,
          total_biaya,
          keterangan: (item.keterangan || '').trim()
        };
      }
      return row;
    });

    localStorage.setItem(STORAGE_KEYS.BIAYA_VARIABEL, JSON.stringify(updatedList));
    return updatedList;
  },

  delete: (id) => {
    const list = BiayaVariabelDB.getAll();
    const filtered = list.filter((row) => row.id_biaya_variabel !== Number(id));
    localStorage.setItem(STORAGE_KEYS.BIAYA_VARIABEL, JSON.stringify(filtered));
    return filtered;
  },

  getTotalExpense: () => {
    const list = BiayaVariabelDB.getAll();
    return list.reduce((acc, curr) => acc + (Number(curr.total_biaya) || 0), 0);
  }
};

// Generator Skema SQL DDL untuk 3 Tabel Sesuai Instruksi
export function generateSqlSchemaDDL() {
  return `-- =======================================================
-- SKEMA STRUKTUR DATABASE SISTEM PENCATATAN PENGELUARAN
-- =======================================================

-- 1. TABEL BIAYA BAHAN BAKU
CREATE TABLE IF NOT EXISTS biaya_bahan_baku (
  id_bahan_baku INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  nama_bahan VARCHAR(255) NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  kuantitas DECIMAL(10, 2) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  harga_satuan DECIMAL(15, 2) NOT NULL,
  total_biaya DECIMAL(15, 2) NOT NULL
);

-- 2. TABEL BIAYA TETAP / RUTIN
CREATE TABLE IF NOT EXISTS biaya_tetap (
  id_biaya_tetap INT AUTO_INCREMENT PRIMARY KEY,
  tanggal_bayar DATE NOT NULL,
  nama_pengeluaran VARCHAR(255) NOT NULL,
  periode VARCHAR(50) NOT NULL,
  jumlah_biaya DECIMAL(15, 2) NOT NULL,
  keterangan TEXT
);

-- 3. TABEL BIAYA VARIABEL
CREATE TABLE IF NOT EXISTS biaya_variabel (
  id_biaya_variabel INT AUTO_INCREMENT PRIMARY KEY,
  tanggal DATE NOT NULL,
  nama_item VARCHAR(255) NOT NULL,
  kuantitas DECIMAL(10, 2) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  harga_satuan DECIMAL(15, 2) NOT NULL,
  total_biaya DECIMAL(15, 2) NOT NULL,
  keterangan TEXT
);
`;
}

// Format Rupiah standar Indonesia
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount || 0);
}

// Format Tanggal Indonesia
export function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}
