import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, X, Search } from 'lucide-react';
import { formatRupiah } from '../shared/utils';
import { UnifiedExpenseDB } from '../db/unifiedExpenses';

const PRESETS = [
  'Uang Kebersihan & Retribusi Harian',
  'Gaji Karyawan Dapur',
  'Gaji Kasir & Pelayanan',
  'Sewa Kios Kantin SMB',
  'Listrik & Air Galon',
  'WiFi Internet 100Mbps',
  'Retribusi & Kebersihan'
];

const SKEMA_OPTIONS = [
  'Per Hari',
  'Per Bulan',
  'Per Minggu',
  'Tiap 15 Hari',
  'Tiap 2 Bulan',
  'Per 3 Bulan',
  'Per 6 Bulan',
  'Per Tahun'
];

const DURASI_PRESETS = [
  { label: 'Berkelanjutan (Tanpa Batas)', months: null, days: null },
  { label: '7 Hari Lagi', months: null, days: 7 },
  { label: '14 Hari Lagi', months: null, days: 14 },
  { label: '30 Hari Lagi', months: null, days: 30 },
  { label: '1 Bulan Lagi', months: 1, days: null },
  { label: '2 Bulan Lagi', months: 2, days: null },
  { label: '3 Bulan Lagi', months: 3, days: null },
  { label: '6 Bulan Lagi', months: 6, days: null },
  { label: '1 Tahun (12 Bulan)', months: 12, days: null }
];

export default function BiayaTetapView({ onDataChange }) {
  const [dataVersion, setDataVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe ke database MongoDB pusat (The One and Only)
  useEffect(() => {
    const unsub = UnifiedExpenseDB.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    UnifiedExpenseDB.fetchAll();
    return unsub;
  }, []);

  // Form states
  const [nama, setNama] = useState('');
  const [nominal, setNominal] = useState('');
  const [skema, setSkema] = useState('Per Hari');
  const [durasiLabel, setDurasiLabel] = useState('Berkelanjutan (Tanpa Batas)');
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().split('T')[0]);
  const [keterangan, setKeterangan] = useState('');

  // Load items where kategori === 'tetap'
  const items = useMemo(() => {
    const all = UnifiedExpenseDB.getAll();
    return all.filter(item => item.kategori === 'tetap');
  }, [dataVersion]);

  // Calculate next due date and remaining duration for an item
  const getScheduleMeta = (item) => {
    const startDate = new Date(item.tanggal || new Date());
    const now = new Date();
    
    // Compute Next Due Date
    const nextDue = new Date(startDate);
    while (nextDue <= now) {
      if (item.frekuensi === 'Per Hari') {
        nextDue.setDate(nextDue.getDate() + 1);
      } else if (item.frekuensi === 'Tiap 15 Hari') {
        nextDue.setDate(nextDue.getDate() + 15);
      } else if (item.frekuensi === 'Per Minggu') {
        nextDue.setDate(nextDue.getDate() + 7);
      } else if (item.frekuensi === 'Tiap 2 Bulan') {
        nextDue.setMonth(nextDue.getMonth() + 2);
      } else if (item.frekuensi === 'Per 3 Bulan') {
        nextDue.setMonth(nextDue.getMonth() + 3);
      } else if (item.frekuensi === 'Per 6 Bulan') {
        nextDue.setMonth(nextDue.getMonth() + 6);
      } else if (item.frekuensi === 'Per Tahun') {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      } else {
        // Default Per Bulan
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
    }

    const nextDueStr = nextDue.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // Compute Duration Info
    let durasiInfo = item.durasi || 'Berkelanjutan';
    let status = 'Aktif';
    let statusColor = 'bg-emerald-100 text-emerald-800';

    if (item.endDate) {
      const end = new Date(item.endDate);
      const diffMs = end - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        durasiInfo = 'Selesai';
        status = 'Selesai';
        statusColor = 'bg-slate-100 text-slate-600';
      } else if (diffDays <= 30) {
        durasiInfo = `Sisa ${diffDays} hari lagi (${end.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })})`;
        status = 'Mendekati Akhir';
        statusColor = 'bg-amber-100 text-amber-800';
      } else {
        const diffMonths = Math.ceil(diffDays / 30);
        durasiInfo = `Sisa ${diffMonths} bulan lagi (${end.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })})`;
      }
    }

    return { nextDueStr, durasiInfo, status, statusColor };
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const cleanNominal = parseInt(String(nominal).replace(/\D/g, ''), 10) || 0;
    if (!nama || cleanNominal <= 0) {
      alert('Mohon isi nama pengeluaran dan nominal biaya yang valid!');
      return;
    }

    const selectedDurasiObj = DURASI_PRESETS.find(d => d.label === durasiLabel);
    let calculatedEndDate = null;
    if (selectedDurasiObj) {
      if (selectedDurasiObj.months) {
        const d = new Date(tanggalMulai);
        d.setMonth(d.getMonth() + selectedDurasiObj.months);
        calculatedEndDate = d.toISOString().split('T')[0];
      } else if (selectedDurasiObj.days) {
        const d = new Date(tanggalMulai);
        d.setDate(d.getDate() + selectedDurasiObj.days);
        calculatedEndDate = d.toISOString().split('T')[0];
      }
    }

    setIsSubmitting(true);
    try {
      await UnifiedExpenseDB.create({
        tanggal: tanggalMulai,
        kategori: 'tetap',
        nama_item: nama.trim(),
        nominal: cleanNominal,
        karyawan: 'Operasional',
        frekuensi: skema,
        durasi: durasiLabel,
        endDate: calculatedEndDate,
        keterangan: keterangan.trim() || '-'
      });

      setNama('');
      setNominal('');
      setKeterangan('');
      setDurasiLabel('Berkelanjutan (Tanpa Batas)');
      setShowModal(false);
      setDataVersion(v => v + 1);
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Gagal menyimpan biaya tetap:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm('Hapus biaya tetap ini dari daftar dan database?')) return;
    try {
      await UnifiedExpenseDB.delete(id);
      setDataVersion(v => v + 1);
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Gagal menghapus biaya tetap:', err);
    }
  };

  const filteredItems = items.filter(item => {
    if (!search) return true;
    return item.nama_item.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 select-none">
      {/* Action Header: 1 Tombol Tambah + Search Bar Responsif */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari biaya tetap..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 shadow-2xs"
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="h-11 sm:h-10 px-5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>Tambah Biaya Tetap Baru</span>
        </button>
      </div>

      {/* MOBILE-FIRST: CARD LIST UNTUK HP (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
            Belum ada komitmen biaya tetap.
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemId = item._id || item.id;
            const meta = getScheduleMeta(item);

            return (
              <div
                key={itemId}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${meta.statusColor}`}>
                        {meta.status}
                      </span>
                      <span className="bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        {item.frekuensi || 'Per Bulan'}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm leading-snug">{item.nama_item}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-blue-700 block">
                      {formatRupiah(item.nominal)}
                    </span>
                  </div>
                </div>

                {/* Schedule Info Grid on Mobile */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Jatuh Tempo:</span>
                    <span className="font-bold text-slate-800">{meta.nextDueStr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Durasi / Sisa:</span>
                    <span className="font-bold text-slate-800">{meta.durasiInfo}</span>
                  </div>
                </div>

                {/* Bottom Action on Mobile */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {item.keterangan && item.keterangan !== '-' ? item.keterangan : 'Biaya rutin'}
                  </span>
                  <button
                    onClick={() => handleDelete(itemId)}
                    className="p-2 text-slate-400 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP/TABLET TABLE (md+) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-black text-slate-900">Biaya Tetap Rutin Berjalan</h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filteredItems.length} Komitmen Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4">Nama Pengeluaran</th>
                <th className="p-4 text-right">Biaya / Harga</th>
                <th className="p-4">Skema Bayar</th>
                <th className="p-4">Jatuh Tempo</th>
                <th className="p-4">Durasi / Batas Waktu</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-400 font-bold">
                    Belum ada data biaya tetap yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const itemId = item._id || item.id;
                  const meta = getScheduleMeta(item);

                  return (
                    <tr key={itemId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 text-sm">{item.nama_item}</p>
                        {item.keterangan && item.keterangan !== '-' && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.keterangan}</p>
                        )}
                      </td>
                      <td className="p-4 text-right font-black text-blue-700 text-sm">
                        {formatRupiah(item.nominal)}
                      </td>
                      <td className="p-4">
                        <span className="bg-blue-50 text-blue-800 border border-blue-100 px-2.5 py-1 rounded-lg font-bold text-[10px]">
                          {item.frekuensi || 'Per Bulan'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {meta.nextDueStr}
                      </td>
                      <td className="p-4 font-bold text-slate-600">
                        {meta.durasiInfo}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-black text-[10px] ${meta.statusColor}`}>
                          {meta.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(itemId)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Biaya Tetap"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form: Mobile-Optimized Bottom-Sheet / Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base sm:text-lg font-black text-slate-900">Tambah Biaya Tetap Baru</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-bold">
              {/* Presets Cepat */}
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                  Pilihan Cepat
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pb-1">
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNama(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer active:scale-95 ${
                        nama === p 
                          ? 'bg-blue-600 text-white font-black' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Pengeluaran */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Nama Pengeluaran / Komitmen
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sewa Kios, Gaji Karyawan, Listrik..."
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-bold text-sm outline-none focus:border-emerald-600"
                />
              </div>

              {/* Biaya / Harga */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Biaya / Nominal Bayar (Rp)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Rp 0"
                  value={nominal ? formatRupiah(parseInt(String(nominal).replace(/\D/g, ''), 10) || 0) : ''}
                  onChange={(e) => setNominal(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-black text-base outline-none focus:border-emerald-600"
                />
              </div>

              {/* Skema / Rutin Bayar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 uppercase tracking-wider mb-1">
                    Skema / Rutin Bayar
                  </label>
                  <select
                    value={skema}
                    onChange={(e) => setSkema(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {SKEMA_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Durasi / Sampai Kapan */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Durasi / Sampai Kapan Bayarnya
                </label>
                <select
                  value={durasiLabel}
                  onChange={(e) => setDurasiLabel(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {DURASI_PRESETS.map(d => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Catatan tambahan bila ada..."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  Simpan Biaya Tetap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
