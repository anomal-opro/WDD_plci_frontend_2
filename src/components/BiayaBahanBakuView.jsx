import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Eye, X, Search, UploadCloud } from 'lucide-react';
import { formatRupiah } from '../shared/utils';
import { UnifiedExpenseDB } from '../db/unifiedExpenses';

const PRESETS = [
  { name: 'Ikan Lele Segar', unit: 'kg' },
  { name: 'Ayam Broiler', unit: 'ekor' },
  { name: 'Bebek Segar', unit: 'ekor' },
  { name: 'Cabai Rawit Merah', unit: 'kg' },
  { name: 'Beras Ramos', unit: 'karung' },
  { name: 'Minyak Sawit', unit: 'liter' },
  { name: 'Bumbu Sambal', unit: 'pack' },
  { name: 'Kol & Lalapan', unit: 'kg' },
  { name: 'Tahu & Tempe', unit: 'papan' },
  { name: 'Telur Ayam', unit: 'kg' }
];

const SATUAN_OPTIONS = ['kg', 'ekor', 'liter', 'karung', 'pack', 'papan', 'ikat', 'pcs'];

export default function BiayaBahanBakuView({ onDataChange, onOpenReceipt }) {
  const [dataVersion, setDataVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State (Tanpa nama staf)
  const [namaBahan, setNamaBahan] = useState('');
  const [kuantitas, setKuantitas] = useState('');
  const [satuan, setSatuan] = useState('kg');
  const [totalBiaya, setTotalBiaya] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [attachment, setAttachment] = useState(null);
  const [keterangan, setKeterangan] = useState('');

  // Load items where kategori === 'bahan_baku'
  const items = useMemo(() => {
    const all = UnifiedExpenseDB.getAll();
    return all.filter(item => item.kategori === 'bahan_baku');
  }, [dataVersion]);

  // Handle Photo/Struk upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (p) => {
    setNamaBahan(p.name);
    setSatuan(p.unit);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const cleanNominal = parseInt(String(totalBiaya).replace(/\D/g, ''), 10) || 0;
    if (!namaBahan || cleanNominal <= 0) {
      alert('Mohon isi nama bahan baku dan total biaya belanja!');
      return;
    }

    const qtyNum = parseFloat(kuantitas) || 1;
    const descNote = keterangan.trim() 
      ? `${kuantitas ? `${qtyNum} ${satuan} • ` : ''}${keterangan.trim()}` 
      : (kuantitas ? `${qtyNum} ${satuan}` : '');

    UnifiedExpenseDB.create({
      tanggal,
      kategori: 'bahan_baku',
      nama_item: namaBahan.trim(),
      nominal: cleanNominal,
      karyawan: 'Operasional',
      attachment,
      keterangan: descNote,
      kuantitas: qtyNum,
      satuan
    });

    // Reset Form & Close
    setNamaBahan('');
    setKuantitas('');
    setTotalBiaya('');
    setKeterangan('');
    setAttachment(null);
    setShowModal(false);
    setDataVersion(v => v + 1);
    if (onDataChange) onDataChange();
  };

  const handleDelete = (id) => {
    if (!window.confirm('Hapus catatan bahan baku ini?')) return;
    UnifiedExpenseDB.delete(id);
    setDataVersion(v => v + 1);
    if (onDataChange) onDataChange();
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
            placeholder="Cari bahan baku..."
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
          <span>Catat Bahan Baku Baru</span>
        </button>
      </div>

      {/* MOBILE-FIRST: CARD LIST UNTUK HP (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
            Belum ada catatan bahan baku.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-black text-slate-900 text-sm leading-snug">{item.nama_item}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold text-slate-400">{item.tanggal}</span>
                    {item.keterangan && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {item.keterangan}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-black text-emerald-700 block">
                    {formatRupiah(item.nominal)}
                  </span>
                </div>
              </div>

              {/* Bottom Action on Mobile */}
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                <div>
                  {item.attachment ? (
                    <button
                      onClick={() => onOpenReceipt && onOpenReceipt(item)}
                      className="px-3 py-1.5 bg-emerald-50 active:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye size={14} />
                      <span>Lihat Struk</span>
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Tanpa Struk</span>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-slate-400 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  title="Hapus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP/TABLET TABLE (md+) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-black text-slate-900">Riwayat Pembelian Bahan Baku</h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filteredItems.length} Transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Nama Bahan Baku</th>
                <th className="p-4 text-right">Total Biaya</th>
                <th className="p-4 text-center">Bukti Struk</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">
                    Belum ada riwayat pembelian bahan baku.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-4 font-bold text-slate-800">{item.tanggal}</td>
                    <td className="p-4">
                      <p className="font-extrabold text-slate-900 text-sm">{item.nama_item}</p>
                      {item.keterangan && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.keterangan}</p>
                      )}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-700 text-sm">
                      {formatRupiah(item.nominal)}
                    </td>
                    <td className="p-4 text-center">
                      {item.attachment ? (
                        <button
                          onClick={() => onOpenReceipt && onOpenReceipt(item)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>Lihat Struk</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Tanpa Struk</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input: Mobile-Optimized Bottom-Sheet / Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base sm:text-lg font-black text-slate-900">Catat Belanja Bahan Baku</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-bold">
              {/* Presets 1-Klik Bahan Baku (Touch-friendly chips) */}
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                  Pilihan Cepat
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pb-1">
                  {PRESETS.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer active:scale-95 ${
                        namaBahan === p.name
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Bahan */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Nama Bahan Baku
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ikan Lele, Ayam Potong..."
                  value={namaBahan}
                  onChange={(e) => setNamaBahan(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-bold text-sm outline-none focus:border-emerald-600"
                />
              </div>

              {/* Kuantitas & Satuan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 uppercase tracking-wider mb-1">
                    Jumlah / Kuantitas
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Contoh: 10"
                    value={kuantitas}
                    onChange={(e) => setKuantitas(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-bold text-sm outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 uppercase tracking-wider mb-1">
                    Satuan
                  </label>
                  <select
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {SATUAN_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Total Belanja (Langsung Ketik Total) */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Total Biaya Belanja (Rp)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Rp 0"
                  value={totalBiaya ? formatRupiah(parseInt(String(totalBiaya).replace(/\D/g, ''), 10) || 0) : ''}
                  onChange={(e) => setTotalBiaya(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-black text-base outline-none focus:border-emerald-600"
                />
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Belanja
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-emerald-600"
                />
              </div>

              {/* Upload Foto Struk / Nota */}
              <div>
                <label className="block text-slate-700 uppercase tracking-wider mb-1">
                  Foto Nota / Struk (Opsional)
                </label>
                {attachment ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-300 bg-emerald-50/50 p-2 flex items-center justify-between">
                    <img src={attachment} alt="Preview Struk" className="h-14 w-14 object-cover rounded-xl border border-slate-200" />
                    <span className="text-xs text-emerald-800 font-bold">Struk terlampir</span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/60 active:bg-emerald-50">
                    <UploadCloud size={22} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-600">Klik untuk upload foto struk</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
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
                  Simpan Bahan Baku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
