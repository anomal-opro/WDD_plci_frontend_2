import React from 'react';
import { X, Download, FileText, CheckCircle2, User, Calendar, Tag } from 'lucide-react';
import { formatRupiah } from '../shared/utils';

export default function ReceiptLightboxModal({ item, onClose }) {
  if (!item) return null;

  const categoryStyles = {
    bahan_baku: { label: 'Bahan Baku', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    tetap: { label: 'Biaya Tetap', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
    variabel: { label: 'Biaya Variabel', bg: 'bg-amber-100 text-amber-800 border-amber-300' }
  };

  const currentStyle = categoryStyles[item.kategori] || categoryStyles.variabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
          <div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${currentStyle.bg}`}>
              {currentStyle.label}
            </span>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              Lampiran Bukti Pengeluaran
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Image Container */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-center min-h-[260px] overflow-hidden">
            {item.attachment ? (
              <img
                src={item.attachment}
                alt="Bukti Struk"
                className="max-h-[380px] w-auto object-contain rounded-xl shadow-xs"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <FileText size={48} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">Tidak ada file lampiran struk untuk pengeluaran ini.</p>
              </div>
            )}
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Tag size={14} className="text-slate-400" /> Item
              </span>
              <span className="font-extrabold text-slate-900">{item.nama_item}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" /> Tanggal
              </span>
              <span className="font-bold text-slate-700">{item.tanggal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <User size={14} className="text-slate-400" /> Penginput
              </span>
              <span className="font-bold text-slate-700">{item.karyawan || 'Staff'}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="text-slate-500 font-bold">Nominal</span>
              <span className="text-base font-black text-emerald-700">{formatRupiah(item.nominal)}</span>
            </div>
            {item.keterangan && (
              <div className="pt-1 text-[11px] text-slate-500">
                <span className="font-bold">Catatan:</span> {item.keterangan}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3 shrink-0">
          {item.attachment && (
            <a
              href={item.attachment}
              download={`Struk_${item.tanggal}_${item.nama_item.replace(/\s+/g, '_')}.png`}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={15} />
              <span>Unduh Struk</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
