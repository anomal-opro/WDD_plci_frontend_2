import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, ArrowRight, Eye, Trash2, Download, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExpenseVisualChart from '../components/ExpenseVisualChart';
import ReceiptLightboxModal from '../components/ReceiptLightboxModal';
import { formatRupiah } from '../shared/utils';
import { BRANCH_INFO } from '../shared/constants';
import { UnifiedExpenseDB } from '../db/unifiedExpenses';

export default function PengeluaranView({ onRefresh }) {
  // Hierarchical Navigation States: 'yearly' | 'monthly' | 'daily'
  const [hierarchyLevel, setHierarchyLevel] = useState('yearly');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Modal Lightbox Struk
  const [lightboxItem, setLightboxItem] = useState(null);

  // Internal data version trigger
  const [dataVersion, setDataVersion] = useState(0);

  // Subscribe ke live MongoDB database pusat
  useEffect(() => {
    const unsub = UnifiedExpenseDB.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    UnifiedExpenseDB.fetchAll();
    return unsub;
  }, []);

  // Load hierarchical dataset from UnifiedExpenseDB
  const hierarchicalYears = useMemo(() => {
    return UnifiedExpenseDB.getHierarchy();
  }, [dataVersion]);

  // Overall totals across all time
  const grandStats = useMemo(() => {
    let grand = 0;
    let bahan = 0;
    let tetap = 0;
    let variabel = 0;
    let count = 0;

    hierarchicalYears.forEach(y => {
      grand += y.grandTotal;
      bahan += y.bahanBaku;
      tetap += y.tetap;
      variabel += y.variabel;
      count += y.count;
    });

    return { grand, bahan, tetap, variabel, count };
  }, [hierarchicalYears]);

  // Sinkronisasi otomatis selectedYear, selectedMonth, selectedDay saat hierarchicalYears diperbarui
  useEffect(() => {
    if (selectedYear) {
      const refreshedYear = hierarchicalYears.find(y => y.year === selectedYear.year);
      if (refreshedYear) {
        setSelectedYear(refreshedYear);
        if (selectedMonth) {
          const refreshedMonth = refreshedYear.months[selectedMonth.month];
          if (refreshedMonth) {
            setSelectedMonth(refreshedMonth);
            if (selectedDay) {
              const refreshedDay = refreshedMonth.days[selectedDay.dateStr];
              if (refreshedDay) {
                setSelectedDay(refreshedDay);
              } else {
                const days = Object.values(refreshedMonth.days).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
                setSelectedDay(days.length > 0 ? days[0] : null);
              }
            }
          }
        }
      }
    }
  }, [hierarchicalYears]);

  // Admin delete log (permanent hard delete from MongoDB database)
  const handleDeleteLog = async (log) => {
    if (!log) return;
    const isProrated = Boolean(log.isProrated);
    const targetId = isProrated ? (log.sourceId || log._id) : (log._id || log.id);
    if (!targetId) return;

    const confirmMsg = isProrated
      ? `Biaya Tetap "${log.nama_item}" adalah biaya rutin bulanan. Menghapus ini akan menghapus data master Biaya Tetap dari database secara permanen. Lanjutkan?`
      : `Hapus transaksi pengeluaran "${log.nama_item}" secara permanen dari database?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await UnifiedExpenseDB.delete(targetId);
      setDataVersion(v => v + 1);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Gagal menghapus log pengeluaran:', e);
    }
  };

  // Export PDF Report for Admin
  const exportPDF = (title, items) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Laporan Pengeluaran: ${title}`, 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cabang: ${BRANCH_INFO.name}`, 14, 28);
    const totalSum = items.reduce((acc, it) => acc + (Number(it.nominal) || 0), 0);
    doc.text(`Total: ${formatRupiah(totalSum)} (${items.length} item)`, 14, 34);

    const tableColumn = ['No', 'Tanggal', 'Item', 'Kategori', 'Nominal'];
    const tableRows = items.map((it, idx) => [
      idx + 1,
      it.tanggal,
      it.nama_item + (it.keterangan ? ` (${it.keterangan})` : ''),
      it.kategoriLabel || it.kategori,
      formatRupiah(it.nominal)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [0, 122, 85] }
    });

    doc.save(`Pengeluaran_${title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-20 select-none">
      
      {/* =======================================================================
          LEVEL 3: DAILY VIEW & DETAIL TRANSAKSI
      ======================================================================== */}
      {hierarchyLevel === 'daily' && selectedDay && selectedMonth && selectedYear ? (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Top Bar Harian: Responsif HP & Desktop */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setHierarchyLevel('monthly');
                  setSelectedDay(null);
                }}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors cursor-pointer"
                title="Kembali"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                {selectedDay.dateStr}
              </h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatRupiah(selectedDay.grandTotal)}
              </span>
              <button
                onClick={() => exportPDF(`Tanggal_${selectedDay.dateStr}`, selectedDay.logs)}
                className="px-3.5 sm:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Quick Day Switcher Pills */}
          {selectedMonth && Object.keys(selectedMonth.days).length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {Object.values(selectedMonth.days)
                .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
                .map((dayNode) => {
                  const isActive = dayNode.dateStr === selectedDay.dateStr;
                  return (
                    <button
                      key={dayNode.dateStr}
                      onClick={() => setSelectedDay(dayNode)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-emerald-700 text-white shadow-xs' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {dayNode.dateStr} ({formatRupiah(dayNode.grandTotal)})
                    </button>
                  );
                })}
            </div>
          )}

          {/* Visual Chart 3 Warna */}
          <ExpenseVisualChart
            bahanBaku={selectedDay.bahanBaku}
            tetap={selectedDay.tetap}
            variabel={selectedDay.variabel}
          />

          {/* MOBILE CARD LIST (< md) */}
          <div className="block md:hidden space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-black text-slate-900">Daftar Transaksi</h3>
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                {selectedDay.logs.length} Item
              </span>
            </div>

            {selectedDay.logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
                Tidak ada entri log untuk tanggal ini.
              </div>
            ) : (
              selectedDay.logs.map((log) => {
                const logId = log._id || log.id;
                const catBadge = log.kategori === 'bahan_baku'
                  ? 'bg-emerald-100 text-emerald-800'
                  : log.kategori === 'tetap'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800';

                return (
                  <div
                    key={logId}
                    className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase ${catBadge}`}>
                          {log.kategoriLabel || log.kategori}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm leading-snug mt-1">
                          {log.nama_item}
                        </h4>
                        {log.keterangan && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{log.keterangan}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-slate-900 block">
                          {formatRupiah(log.nominal)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                      <div>
                        {log.attachment ? (
                          <button
                            onClick={() => setLightboxItem(log)}
                            className="px-3 py-1.5 bg-emerald-50 active:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>Lihat Struk</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Tanpa Struk</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteLog(log)}
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

          {/* DESKTOP TABLE (md+) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-black text-slate-900">Detail Transaksi</h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {selectedDay.logs.length} Item
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-12 text-center">No</th>
                    <th className="p-4">Item</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4 text-right">Nominal</th>
                    <th className="p-4 text-center">Struk</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDay.logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">
                        Tidak ada entri log untuk tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    selectedDay.logs.map((log, idx) => {
                      const logId = log._id || log.id;
                      const catBadge = log.kategori === 'bahan_baku'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.kategori === 'tetap'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800';

                      return (
                        <tr key={logId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-4">
                            <p className="font-extrabold text-slate-900 text-sm">{log.nama_item}</p>
                            {log.keterangan && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{log.keterangan}</p>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${catBadge}`}>
                              {log.kategoriLabel || log.kategori}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-slate-900 text-sm">
                            {formatRupiah(log.nominal)}
                          </td>
                          <td className="p-4 text-center">
                            {log.attachment ? (
                              <button
                                onClick={() => setLightboxItem(log)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Lihat Struk"
                              >
                                <Eye size={14} />
                                <span>Lihat Struk</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Tanpa Struk</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteLog(log)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus"
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
        </div>
      ) : hierarchyLevel === 'monthly' && selectedYear ? (
        /* ===================================================================
            LEVEL 2: MONTHLY VIEW (DRILL-DOWN DARI YEARLY)
        ==================================================================== */
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Top Bar Bulanan */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setHierarchyLevel('yearly');
                  setSelectedYear(null);
                }}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors cursor-pointer"
                title="Kembali"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                Tahun {selectedYear.year}
              </h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatRupiah(selectedYear.grandTotal)}
              </span>
              <button
                onClick={() => {
                  const allYearLogs = [];
                  Object.values(selectedYear.months).forEach(m => {
                    Object.values(m.days).forEach(d => {
                      allYearLogs.push(...d.logs);
                    });
                  });
                  exportPDF(`Tahun_${selectedYear.year}`, allYearLogs);
                }}
                className="px-3.5 sm:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Visual Chart 3 Warna */}
          <ExpenseVisualChart
            bahanBaku={selectedYear.bahanBaku}
            tetap={selectedYear.tetap}
            variabel={selectedYear.variabel}
          />

          {/* Grid Bulan Responsif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Object.values(selectedYear.months)
              .sort((a, b) => a.monthIndex - b.monthIndex)
              .map((m) => {
                return (
                  <div
                    key={m.month}
                    onClick={() => {
                      setSelectedMonth(m);
                      const daysArr = Object.values(m.days).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
                      if (daysArr.length > 0) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const preferred = m.days[todayStr] || daysArr[0];
                        setSelectedDay(preferred);
                      }
                      setHierarchyLevel('daily');
                    }}
                    className="bg-white hover:bg-slate-50/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-emerald-600 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {m.month}
                        </h4>
                        <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-700 group-hover:text-white text-slate-400 transition-colors">
                          <ArrowRight size={16} />
                        </div>
                      </div>

                      {/* 3 Categories Breakdown in Month */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center bg-emerald-50/60 px-3 py-1.5 rounded-xl border border-emerald-100">
                          <span className="font-bold text-emerald-800">Bahan Baku</span>
                          <span className="font-black text-emerald-700">{formatRupiah(m.bahanBaku)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-blue-50/60 px-3 py-1.5 rounded-xl border border-blue-100">
                          <span className="font-bold text-blue-800">Biaya Tetap</span>
                          <span className="font-black text-blue-700">{formatRupiah(m.tetap)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-amber-50/60 px-3 py-1.5 rounded-xl border border-amber-100">
                          <span className="font-bold text-amber-800">Biaya Variabel</span>
                          <span className="font-black text-amber-700">{formatRupiah(m.variabel)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Total</span>
                      <span className="text-base font-black text-slate-900">{formatRupiah(m.grandTotal)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* ===================================================================
            LEVEL 1: YEARLY VIEW (DEFAULT ROOT VIEW)
        ==================================================================== */
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          
          {/* Visual Chart 3 Warna Langsung di Paling Atas */}
          <ExpenseVisualChart
            bahanBaku={grandStats.bahan}
            tetap={grandStats.tetap}
            variabel={grandStats.variabel}
          />

          {/* Grid Kartu Tahun Responsif / Empty State */}
          {hierarchicalYears.length === 0 ? (
            <div className="text-center py-16 sm:py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base sm:text-lg font-bold text-slate-700">Belum Ada Catatan Pengeluaran</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Data pengeluaran (Biaya Bahan Baku, Variabel, dan Biaya Tetap) yang diinput akan muncul di sini secara terstruktur per tahun, bulan, dan hari.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {hierarchicalYears.map((yearData) => {
                return (
                  <div
                    key={yearData.year}
                    onClick={() => {
                      setSelectedYear(yearData);
                      setHierarchyLevel('monthly');
                    }}
                    className="bg-white hover:bg-slate-50/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-emerald-600 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          Tahun {yearData.year}
                        </h4>
                        <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-700 group-hover:text-white text-slate-400 transition-colors">
                          <ArrowRight size={18} />
                        </div>
                      </div>

                      {/* 3 Category Aggregates for the Year */}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        <div className="bg-emerald-50/80 p-2.5 sm:p-3 rounded-2xl border border-emerald-100">
                          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase block">Bahan Baku</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5 block truncate">
                            {formatRupiah(yearData.bahanBaku)}
                          </span>
                        </div>
                        <div className="bg-blue-50/80 p-2.5 sm:p-3 rounded-2xl border border-blue-100">
                          <span className="text-[9px] sm:text-[10px] font-bold text-blue-800 uppercase block">Biaya Tetap</span>
                          <span className="text-xs sm:text-sm font-black text-blue-700 mt-0.5 block truncate">
                            {formatRupiah(yearData.tetap)}
                          </span>
                        </div>
                        <div className="bg-amber-50/80 p-2.5 sm:p-3 rounded-2xl border border-amber-100">
                          <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase block">Variabel</span>
                          <span className="text-xs sm:text-sm font-black text-amber-700 mt-0.5 block truncate">
                            {formatRupiah(yearData.variabel)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3.5 mt-4 sm:mt-5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Total</span>
                      <span className="text-base sm:text-lg font-black text-slate-900">{formatRupiah(yearData.grandTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Receipt Attachment Modal */}
      {lightboxItem && (
        <ReceiptLightboxModal
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
}
