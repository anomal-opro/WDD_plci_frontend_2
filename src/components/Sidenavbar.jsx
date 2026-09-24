import React, { useState } from 'react';
import { TrendingUp, TrendingDown, PieChart, LogOut, ChevronLeft, ChevronRight, Menu, X, Wallet } from 'lucide-react';

export default function Sidenavbar({ currentTab, onSwitchTab, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modul Input Pengeluaran (Di bagian atas)
  const topItem = {
    id: 'input_pengeluaran',
    label: 'Pengeluaran',
    sublabel: 'Input',
    icon: Wallet,
  };

  // Modul Rekapitulasi / Laporan (Di bawah divider)
  const reportItems = [
    {
      id: 'penjualan',
      label: 'Penjualan',
      sublabel: 'Omzet',
      icon: TrendingUp,
    },
    {
      id: 'pengeluaran',
      label: 'Rekap Biaya',
      sublabel: 'Biaya',
      icon: TrendingDown,
    },
    {
      id: 'keuangan',
      label: 'Keuangan',
      sublabel: 'P&L',
      icon: PieChart,
    },
  ];

  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          onSwitchTab(item.id);
          setIsMobileOpen(false);
        }}
        title={item.label}
        className={`group relative w-13 h-13 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer ${
          isActive
            ? 'bg-white text-emerald-700 shadow-lg shadow-emerald-900/40 scale-105 font-bold'
            : 'text-emerald-100/75 hover:text-white hover:bg-white/15 active:scale-95'
        }`}
      >
        <Icon size={22} className="transition-transform group-hover:scale-110" />
        <span className="text-[9px] font-extrabold tracking-wider leading-none opacity-90">
          {item.sublabel}
        </span>

        {/* Active Left Pill Indicator */}
        {isActive && (
          <span className="absolute -left-2.5 w-1.5 h-7 bg-white rounded-r-full shadow-glow" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* MOBILE FLOATING TOGGLE BUTTON (Visible only on small screens < md) */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-700/30 active:scale-95 transition-all flex items-center justify-center border border-emerald-500 cursor-pointer"
          title="Toggle Navigation"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        />
      )}

      {/* DESKTOP COLLAPSED FLOATING TRIGGER BUTTON (Positioned at the BOTTOM LEFT when collapsed) */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="hidden md:flex fixed bottom-6 left-4 z-50 items-center justify-center w-11 h-11 rounded-2xl bg-emerald-700 text-white border border-emerald-500 shadow-xl hover:bg-emerald-800 active:scale-90 transition-all duration-300 group cursor-pointer"
          title="Tampilkan Navigation Sidebar"
        >
          <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* MAIN SIDENAVBAR CONTAINER */}
      <aside
        className={`
          fixed md:relative top-0 left-0 h-full z-50 select-none
          bg-emerald-700 text-white flex flex-col justify-between py-6 px-2
          shadow-2xl border-r border-emerald-600/40 transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-24' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-0 md:py-0 md:px-0 md:border-none md:overflow-hidden opacity-0 md:opacity-0 pointer-events-none' : 'md:w-20 lg:w-24 md:opacity-100 md:pointer-events-auto'}
        `}
      >
        {/* TOP SECTION: BRAND LOGO & NAV ITEMS */}
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo Badge */}
          <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/25 shadow-inner group hover:scale-105 transition-transform duration-300 cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-white text-emerald-700 font-black text-xl flex items-center justify-center shadow-md">
              P
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-3 mt-1 w-full items-center">
            {/* 1. Item Pengeluaran (Di Bagian Atas) */}
            {renderNavButton(topItem)}

            {/* Divider Line Kecil & Simple */}
            <div className="w-10 h-px bg-white/25 my-1" />

            {/* 2. Item Rekapitulasi (Penjualan, Rekap Biaya, Keuangan) */}
            {reportItems.map((item) => renderNavButton(item))}
          </nav>
        </div>

        {/* BOTTOM SECTION: HIDE/SHOW TOGGLE + LOGOUT BUTTON */}
        <div className="w-full flex flex-col items-center gap-3 mt-auto pt-4 border-t border-emerald-600/40">
          {/* Hide/Collapse Sidebar Toggle Button */}
          <button
            onClick={() => setIsCollapsed(true)}
            title="Sembunyikan Sidebar"
            className="group relative w-13 h-10 rounded-xl flex items-center justify-center text-emerald-100/80 hover:text-white hover:bg-white/15 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="sr-only">Hide Sidebar</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              setIsMobileOpen(false);
              onLogout();
            }}
            title="Kunci Akses / Logout"
            className="group relative w-13 h-13 rounded-2xl flex flex-col items-center justify-center gap-1 text-emerald-100/75 hover:text-red-200 hover:bg-red-500/30 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            <LogOut size={20} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="text-[9px] font-extrabold tracking-wider leading-none">Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
