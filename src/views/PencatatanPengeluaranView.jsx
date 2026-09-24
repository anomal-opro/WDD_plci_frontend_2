import React, { useState } from 'react';
import { ShoppingBag, Wrench, Building2 } from 'lucide-react';
import BiayaBahanBakuView from '../components/BiayaBahanBakuView';
import BiayaVariabelView from '../components/BiayaVariabelView';
import BiayaTetapView from '../components/BiayaTetapView';
import ReceiptLightboxModal from '../components/ReceiptLightboxModal';

export default function PencatatanPengeluaranView() {
  // Active Sub-Tab: 'bahan_baku' | 'variabel' | 'tetap'
  const [activeSubTab, setActiveSubTab] = useState('bahan_baku');

  // Modal Struk Lightbox
  const [lightboxItem, setLightboxItem] = useState(null);

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-20 select-none">
      {/* Mobile-Optimized Sub-Kategori Tab Switcher */}
      <div className="bg-white p-2 sm:p-3 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl sm:rounded-2xl w-full">
          <button
            onClick={() => setActiveSubTab('bahan_baku')}
            className={`py-2.5 sm:py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 ${
              activeSubTab === 'bahan_baku'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <ShoppingBag size={16} />
            <span>Bahan Baku</span>
          </button>

          <button
            onClick={() => setActiveSubTab('variabel')}
            className={`py-2.5 sm:py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 ${
              activeSubTab === 'variabel'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Wrench size={16} />
            <span>Variabel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tetap')}
            className={`py-2.5 sm:py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 ${
              activeSubTab === 'tetap'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 size={16} />
            <span>Biaya Tetap</span>
          </button>
        </div>
      </div>

      {/* Render Sub-View Terpilih */}
      {activeSubTab === 'bahan_baku' && (
        <BiayaBahanBakuView
          onOpenReceipt={(item) => setLightboxItem(item)}
        />
      )}

      {activeSubTab === 'variabel' && (
        <BiayaVariabelView
          onOpenReceipt={(item) => setLightboxItem(item)}
        />
      )}

      {activeSubTab === 'tetap' && (
        <BiayaTetapView />
      )}

      {/* Lightbox Modal Pratinjau Struk */}
      {lightboxItem && (
        <ReceiptLightboxModal
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
}
