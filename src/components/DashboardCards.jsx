import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Building2, 
  Layers, 
  ArrowRight, 
  Lock, 
  TrendingDown, 
  Database, 
  Sparkles,
  Calendar,
  Wallet
} from 'lucide-react';
import { BahanBakuDB, BiayaTetapDB, BiayaVariabelDB, formatRupiah } from '../db/db';

export default function DashboardCards({ onSelectCard, onLock, onOpenSqlModal }) {
  const [stats, setStats] = useState({
    bahanBakuTotal: 0,
    bahanBakuCount: 0,
    biayaTetapTotal: 0,
    biayaTetapCount: 0,
    biayaVariabelTotal: 0,
    biayaVariabelCount: 0,
    grandTotal: 0
  });

  const loadStats = () => {
    const bahan = BahanBakuDB.getAll();
    const tetap = BiayaTetapDB.getAll();
    const variabel = BiayaVariabelDB.getAll();

    const bahanTotal = bahan.reduce((s, x) => s + (Number(x.total_biaya) || 0), 0);
    const tetapTotal = tetap.reduce((s, x) => s + (Number(x.jumlah_biaya) || 0), 0);
    const variabelTotal = variabel.reduce((s, x) => s + (Number(x.total_biaya) || 0), 0);

    setStats({
      bahanBakuTotal: bahanTotal,
      bahanBakuCount: bahan.length,
      biayaTetapTotal: tetapTotal,
      biayaTetapCount: tetap.length,
      biayaVariabelTotal: variabelTotal,
      biayaVariabelCount: variabel.length,
      grandTotal: bahanTotal + tetapTotal + variabelTotal
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  const cards = [
    {
      id: 'bahan_baku',
      title: 'Biaya Bahan Baku',
      subtitle: 'Tabel: biaya_bahan_baku',
      description: 'Pencatatan pembelian beras, daging, ayam, sayur, bumbu & bahan masak.',
      tag: 'Bahan Makanan & Minuman',
      icon: ShoppingBag,
      gradient: 'from-amber-500 to-orange-600',
      shadowColor: 'hover:shadow-amber-500/25',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
      count: stats.bahanBakuCount,
      total: stats.bahanBakuTotal,
      primaryActionText: 'Kelola Bahan Baku'
    },
    {
      id: 'biaya_tetap',
      title: 'Biaya Tetap / Rutin',
      subtitle: 'Tabel: biaya_tetap',
      description: 'Pengeluaran periodik terjadwal seperti sewa ruko, gaji karyawan, dan fasilitas.',
      tag: 'Operasional Rutin',
      icon: Building2,
      gradient: 'from-emerald-500 to-teal-700',
      shadowColor: 'hover:shadow-emerald-500/25',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      count: stats.biayaTetapCount,
      total: stats.biayaTetapTotal,
      primaryActionText: 'Kelola Biaya Tetap'
    },
    {
      id: 'biaya_variabel',
      title: 'Biaya Variabel',
      subtitle: 'Tabel: biaya_variabel',
      description: 'Pengeluaran fluktuatif harian seperti tabung gas LPG, kemasan takeaway, & token listrik.',
      tag: 'Operasional Dinamis',
      icon: Layers,
      gradient: 'from-blue-600 to-indigo-700',
      shadowColor: 'hover:shadow-blue-500/25',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
      count: stats.biayaVariabelCount,
      total: stats.biayaVariabelTotal,
      primaryActionText: 'Kelola Biaya Variabel'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner Ringkasan Keuangan Global */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 mb-10 shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-slate-400 text-sm font-medium">Akumulasi Seluruh Biaya Terdaftar</p>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
                {formatRupiah(stats.grandTotal)}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Total data:{' '}
                <span className="text-white font-semibold">
                  {stats.bahanBakuCount + stats.biayaTetapCount + stats.biayaVariabelCount} transaksi
                </span>{' '}
                tersebar di 3 modul kategori.
              </p>
            </div>

            {/* Quick breakdown mini cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                <span className="text-[11px] text-amber-300 block font-medium">Bahan Baku</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-0.5">
                  {formatRupiah(stats.bahanBakuTotal)}
                </span>
                <span className="text-[10px] text-slate-400">{stats.bahanBakuCount} item</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                <span className="text-[11px] text-emerald-300 block font-medium">Biaya Tetap</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-0.5">
                  {formatRupiah(stats.biayaTetapTotal)}
                </span>
                <span className="text-[10px] text-slate-400">{stats.biayaTetapCount} item</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                <span className="text-[11px] text-blue-300 block font-medium">Variabel</span>
                <span className="text-sm sm:text-base font-bold text-white block mt-0.5">
                  {formatRupiah(stats.biayaVariabelTotal)}
                </span>
                <span className="text-[10px] text-slate-400">{stats.biayaVariabelCount} item</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 CARD PILIHAN UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => onSelectCard(card.id)}
                className={`group relative bg-white border border-slate-200 rounded-3xl p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${card.shadowColor} cursor-pointer flex flex-col justify-between`}
              >
                {/* Header Card */}
                <div>

                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                    {card.title}
                  </h3>
                  
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>

                {/* Footer Data & Call to Action */}
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Total Tercatat</span>
                      <span className="text-lg font-bold text-slate-900 block">
                        {formatRupiah(card.total)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-medium block">Data Tersimpan</span>
                      <span className="text-sm font-bold text-slate-700 block">
                        {card.count} baris
                      </span>
                    </div>
                  </div>

                  <div className="w-full py-3 px-4 rounded-xl bg-slate-100 group-hover:bg-slate-900 text-slate-700 group-hover:text-white font-semibold text-sm flex items-center justify-between transition-all duration-200">
                    <span>{card.primaryActionText}</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
