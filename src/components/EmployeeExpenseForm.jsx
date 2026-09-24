import React, { useState } from 'react';
import { Plus, Upload, Trash2, Eye, FileText, CheckCircle2, AlertCircle, Clock, User, Calendar, Tag } from 'lucide-react';
import { formatRupiah } from '../shared/utils';
import { UnifiedExpenseDB } from '../db/unifiedExpenses';

export default function EmployeeExpenseForm({ onRecordAdded, onOpenReceipt }) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: 'bahan_baku', // 'bahan_baku' | 'tetap' | 'variabel'
    nama_item: '',
    nominal: '',
    karyawan: 'Ahmad Dani',
    keterangan: '',
    attachment: null,
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Handle File Upload (Receipt Image)
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData(prev => ({ ...prev, attachment: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, attachment: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nama_item || !formData.nominal) {
      alert('Harap isi nama item dan nominal pengeluaran!');
      return;
    }

    setIsSubmitting(true);
    const cleanNominal = parseInt(String(formData.nominal).replace(/\D/g, ''), 10) || 0;

    UnifiedExpenseDB.create({
      tanggal: formData.tanggal,
      kategori: formData.kategori,
      nama_item: formData.nama_item,
      nominal: cleanNominal,
      karyawan: formData.karyawan,
      attachment: formData.attachment,
      keterangan: formData.keterangan
    });

    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 3000);

    // Reset Form
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      kategori: 'bahan_baku',
      nama_item: '',
      nominal: '',
      karyawan: formData.karyawan,
      keterangan: '',
      attachment: null,
    });
    setImagePreview(null);
    setIsSubmitting(false);

    if (onRecordAdded) onRecordAdded();
  };

  // Personal History of this employee
  const employeeHistory = UnifiedExpenseDB.getByEmployee(formData.karyawan);

  return (
    <div className="space-y-8 select-none">
      {/* 1. Form Input Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs max-w-3xl mx-auto">
        <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              Form Pengajuan Karyawan
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">Catat Pengeluaran Baru</h3>
          </div>
          {successNotice && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
              <CheckCircle2 size={16} />
              <span>Pengeluaran Berhasil Dicatat!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                <span className="text-red-500 mr-1">*</span>Tanggal Transaksi
              </label>
              <input
                type="date"
                required
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {/* Nama Karyawan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                <span className="text-red-500 mr-1">*</span>Nama Penginput / Karyawan
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Ahmad Dani"
                value={formData.karyawan}
                onChange={(e) => setFormData({ ...formData, karyawan: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Kategori Dropdown Strictly 3 Types */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              <span className="text-red-500 mr-1">*</span>Kategori Pengeluaran
            </label>
            <select
              value={formData.kategori}
              onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white cursor-pointer"
            >
              <option value="bahan_baku">1. Biaya Bahan Baku (Raw Material: Lele, Ayam, Minyak, Beras, Bumbu)</option>
              <option value="tetap">2. Biaya Tetap (Fixed Cost: Sewa Kios, Gaji Staf, Langganan)</option>
              <option value="variabel">3. Biaya Variabel (Variable Cost: Gas Elpiji, Plastik, Es Batu, Operasional)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama / Deskripsi Item */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                <span className="text-red-500 mr-1">*</span>Nama Pengeluaran / Item
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Ikan Lele 35kg, Refill Gas"
                value={formData.nama_item}
                onChange={(e) => setFormData({ ...formData, nama_item: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                <span className="text-red-500 mr-1">*</span>Nominal / Jumlah (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                <input
                  type="text"
                  required
                  placeholder="0"
                  value={formData.nominal}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setFormData({
                      ...formData,
                      nominal: raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : ''
                    });
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-base font-black text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Lampiran Bukti / Struk File Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Lampiran Bukti Nota / Foto Struk (Attachment)
            </label>
            {imagePreview ? (
              <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Preview Nota"
                  className="w-20 h-20 object-cover rounded-xl border border-slate-300"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-800">Foto Bukti Berhasil Dimuat</p>
                  <p className="text-[11px] text-slate-400">Struk akan tersimpan bersama transaksi</p>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Hapus Foto</span>
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50/60 hover:bg-emerald-50/20 transition-colors">
                <Upload size={24} className="text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">Pilih / Ambil Foto Struk</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Format JPG/PNG/WebP, Maks. 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Keterangan Tambahan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan rincian vendor, nomor nota, dsb."
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          {/* Tombol Simpan */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm rounded-xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              <span>{isSubmitting ? 'MENYIMPAN PENGELUARAN...' : 'KIRIM PENGELUARAN'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Personal History Section (Riwayat Pengeluaran Saya) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs max-w-4xl mx-auto">
        <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Riwayat Saya</span>
            <h4 className="text-lg font-black text-slate-900 mt-0.5">
              Daftar Pengeluaran oleh {formData.karyawan || 'Staff'}
            </h4>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {employeeHistory.length} Transaksi Tercatat
          </span>
        </div>

        {employeeHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold">Belum ada pengeluaran yang diajukan oleh {formData.karyawan}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Nama Item</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5 text-right">Nominal</th>
                  <th className="p-3.5 text-center">Struk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeHistory.map((item) => {
                  const catBadge = item.kategori === 'bahan_baku'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.kategori === 'tetap'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-700">{item.tanggal}</td>
                      <td className="p-3.5 font-extrabold text-slate-900">{item.nama_item}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${catBadge}`}>
                          {item.kategoriLabel}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        {formatRupiah(item.nominal)}
                      </td>
                      <td className="p-3.5 text-center">
                        {item.attachment ? (
                          <button
                            onClick={() => onOpenReceipt(item)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Lihat Struk"
                          >
                            <Eye size={13} />
                            <span>Lihat</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
