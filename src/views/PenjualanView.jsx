import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Download, 
  Trash2, Printer, CheckSquare, Square, Eye, FileText, 
  Calendar, Clock, DollarSign, AlertCircle, ShoppingBag, X,
  CheckCircle, ListFilter, CreditCard, Wallet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, parseYearMonthDate, parseItemsString } from '../shared/utils';
import { API_URL, BRANCH_INFO } from '../shared/constants';

export default function PenjualanView({ rawData, onRefresh }) {
  // Navigation states: 'yearly' | 'monthly' | 'daily'
  const [viewLevel, setViewLevel] = useState('yearly');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Expanded year accordion
  const [expandedYears, setExpandedYears] = useState({});

  // Sorting
  const [sortType, setSortType] = useState('chronological'); // 'chronological' | 'highest'

  // Multi-select state in daily view
  const [selectedIds, setSelectedIds] = useState([]);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // Order Detail Modal
  const [detailModalItem, setDetailModalItem] = useState(null);

  // 1. Filter transaksi khusus PLCI Kantin SMB & Penjualan (bukan UNPAID, totalPengeluaran === 0)
  const salesData = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    return rawData.filter(item => {
      const isTargetBranch = item.sheet === BRANCH_INFO.sheetName || item.cabang === BRANCH_INFO.sheetName;
      const isNotUnpaid = !item.jenisPengeluaran || !item.jenisPengeluaran.includes('[UNPAID]');
      const isSales = (Number(item.totalPengeluaran) || 0) === 0;
      return isTargetBranch && isNotUnpaid && isSales;
    });
  }, [rawData]);

  // Helper get nominal income
  const getIncome = (t) => {
    const total = (Number(t.cash) || 0) + (Number(t.bca) || 0) + (Number(t.gofood) || 0) + (Number(t.qris) || 0);
    return total > 0 ? total : (Number(t.totalPendapatan) || Number(t.total) || 0);
  };

  // 2. Grouping Tahunan -> Bulanan -> Harian
  const groupedYears = useMemo(() => {
    const yearsMap = {};

    salesData.forEach(item => {
      const { year, month, monthIndex, day, fullDateStr } = parseYearMonthDate(item.tanggal, item.createdAt);
      const income = getIncome(item);
      const isDeleted = Boolean(item.isDeleted);

      if (!yearsMap[year]) {
        yearsMap[year] = {
          year,
          totalIncome: 0,
          cashTotal: 0,
          bcaTotal: 0,
          qrisTotal: 0,
          months: {},
        };
      }

      if (!isDeleted) {
        yearsMap[year].totalIncome += income;
        yearsMap[year].cashTotal += Number(item.cash) || 0;
        yearsMap[year].bcaTotal += Number(item.bca) || 0;
        yearsMap[year].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);
      }

      if (!yearsMap[year].months[month]) {
        yearsMap[year].months[month] = {
          year,
          month,
          monthIndex,
          totalIncome: 0,
          cashTotal: 0,
          bcaTotal: 0,
          qrisTotal: 0,
          transactionCount: 0,
          days: {},
        };
      }

      if (!isDeleted) {
        yearsMap[year].months[month].totalIncome += income;
        yearsMap[year].months[month].cashTotal += Number(item.cash) || 0;
        yearsMap[year].months[month].bcaTotal += Number(item.bca) || 0;
        yearsMap[year].months[month].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);
        yearsMap[year].months[month].transactionCount += 1;
      }

      if (!yearsMap[year].months[month].days[fullDateStr]) {
        yearsMap[year].months[month].days[fullDateStr] = {
          dateStr: fullDateStr,
          day,
          month,
          year,
          totalIncome: 0,
          cashTotal: 0,
          bcaTotal: 0,
          qrisTotal: 0,
          transactions: [],
        };
      }

      if (!isDeleted) {
        yearsMap[year].months[month].days[fullDateStr].totalIncome += income;
        yearsMap[year].months[month].days[fullDateStr].cashTotal += Number(item.cash) || 0;
        yearsMap[year].months[month].days[fullDateStr].bcaTotal += Number(item.bca) || 0;
        yearsMap[year].months[month].days[fullDateStr].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);
      }

      yearsMap[year].months[month].days[fullDateStr].transactions.push(item);
    });

    const sortedYears = Object.values(yearsMap).sort((a, b) => parseInt(b.year) - parseInt(a.year));
    // Default open latest year
    if (sortedYears.length > 0 && Object.keys(expandedYears).length === 0) {
      setExpandedYears({ [sortedYears[0].year]: true });
    }
    return sortedYears;
  }, [salesData, expandedYears]);

  // Handle single soft delete
  const handleSoftDelete = async (id) => {
    if (!window.confirm("Pindahkan transaksi ini ke kotak SAMPAH?")) return;
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) {
      alert("Gagal memindahkan ke sampah");
    }
  };

  // Handle single hard delete
  const handleHardDelete = async (id) => {
    if (!window.confirm("🚨 PERINGATAN: Hapus transaksi ini secara PERMANEN? Data tidak dapat dipulihkan!")) return;
    try {
      await fetch(`${API_URL}/hard/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) {
      alert("Gagal menghapus permanen");
    }
  };

  // Handle Bulk Delete
  const handleBulkAction = async (isHard) => {
    if (selectedIds.length === 0) return;
    const msg = isHard 
      ? `🚨 Hapus ${selectedIds.length} transaksi terpilih secara PERMANEN?`
      : `Pindahkan ${selectedIds.length} transaksi terpilih ke SAMPAH?`;
    if (!window.confirm(msg)) return;

    setIsProcessingDelete(true);
    try {
      await fetch(`${API_URL}/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, isHardDelete: isHard })
      });
      setSelectedIds([]);
      onRefresh();
    } catch (e) {
      alert("Gagal memproses penghapusan massal");
    } finally {
      setIsProcessingDelete(false);
    }
  };

  // PDF Generators
  const exportYearlyPDF = (yearData) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Laporan Penjualan Tahunan: ${yearData.year}`, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Cabang: ${BRANCH_INFO.name}`, 14, 28);
    doc.text(`Total Omzet: ${formatRupiah(yearData.totalIncome)}`, 14, 34);
    doc.text(`Metode: CASH: ${formatRupiah(yearData.cashTotal)} | BCA: ${formatRupiah(yearData.bcaTotal)} | QRIS: ${formatRupiah(yearData.qrisTotal)}`, 14, 40);

    const tableColumn = ["Bulan", "Jumlah Transaksi", "CASH", "BCA", "QRIS", "Total Omzet"];
    const sortedMonths = Object.values(yearData.months).sort((a, b) => a.monthIndex - b.monthIndex);
    const tableRows = sortedMonths.map(m => [
      m.month.toUpperCase(),
      m.transactionCount,
      formatRupiah(m.cashTotal),
      formatRupiah(m.bcaTotal),
      formatRupiah(m.qrisTotal),
      formatRupiah(m.totalIncome)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] }
    });
    doc.save(`Laporan_Penjualan_Tahun_${yearData.year}_${BRANCH_INFO.sheetName}.pdf`);
  };

  const exportMonthlyPDF = (monthData) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Laporan Penjualan Bulanan: ${monthData.month} ${monthData.year}`, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Cabang: ${BRANCH_INFO.name}`, 14, 28);
    doc.text(`Total Omzet: ${formatRupiah(monthData.totalIncome)}`, 14, 34);
    doc.text(`Metode: CASH: ${formatRupiah(monthData.cashTotal)} | BCA: ${formatRupiah(monthData.bcaTotal)} | QRIS: ${formatRupiah(monthData.qrisTotal)}`, 14, 40);

    const tableColumn = ["Tanggal", "Transaksi", "CASH", "BCA", "QRIS", "Total Omzet"];
    const dayList = Object.values(monthData.days);
    const tableRows = dayList.map(d => [
      d.dateStr,
      d.transactions.filter(t => !t.isDeleted).length,
      formatRupiah(d.cashTotal),
      formatRupiah(d.bcaTotal),
      formatRupiah(d.qrisTotal),
      formatRupiah(d.totalIncome)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] }
    });
    doc.save(`Laporan_Penjualan_${monthData.month}_${monthData.year}_${BRANCH_INFO.sheetName}.pdf`);
  };

  const exportDailyPDF = (dayData) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Laporan Rincian Penjualan: ${dayData.dateStr}`, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Cabang: ${BRANCH_INFO.name}`, 14, 28);
    doc.text(`Total Omzet: ${formatRupiah(dayData.totalIncome)}`, 14, 34);
    doc.text(`Metode: CASH: ${formatRupiah(dayData.cashTotal)} | BCA: ${formatRupiah(dayData.bcaTotal)} | QRIS: ${formatRupiah(dayData.qrisTotal)}`, 14, 40);

    const tableColumn = ["Waktu", "Status", "Rincian Item", "Print", "Metode", "Nominal"];
    const validTransactions = dayData.transactions.filter(t => !t.isDeleted);
    const tableRows = validTransactions.map(t => {
      const time = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
      let method = 'CASH';
      if ((t.bca || 0) > 0) method = 'BCA';
      else if ((t.gofood || 0) > 0 || (t.qris || 0) > 0) method = 'QRIS';

      return [
        time,
        'Lunas',
        (t.jenisPengeluaran || '').replace(/\[[^\]]+\]/g, '').trim(),
        String(t.printCount || 0),
        method,
        formatRupiah(getIncome(t))
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] }
    });
    doc.save(`Laporan_Harian_${dayData.dateStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  // Helper detect payment method badge
  const renderPayBadge = (t) => {
    if ((Number(t.bca) || 0) > 0) {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800">BCA</span>;
    }
    if ((Number(t.gofood) || 0) > 0 || (Number(t.qris) || 0) > 0) {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800">QRIS</span>;
    }
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">CASH</span>;
  };

  // ===========================================================================
  // SUB-VIEW 3: DETAIL TRANSAKSI HARIAN
  // ===========================================================================
  if (viewLevel === 'daily' && selectedDay) {
    const transactions = selectedDay.transactions || [];
    const isAllSelected = transactions.length > 0 && selectedIds.length === transactions.length;

    const handleToggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedIds([]);
      } else {
        setSelectedIds(transactions.map(t => t._id));
      }
    };

    const handleToggleSelect = (id) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6 pb-20">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setViewLevel('monthly'); setSelectedIds([]); }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors cursor-pointer"
              title="Kembali ke Rekap Bulanan"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Detail Harian</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{selectedDay.dateStr}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Hari Ini</span>
              <span className="text-xl font-black text-emerald-700">{formatRupiah(selectedDay.totalIncome)}</span>
            </div>
            <button
              onClick={() => exportDailyPDF(selectedDay)}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>Cetak PDF</span>
            </button>
          </div>
        </div>

        {/* Daily Summary Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">CASH</span>
            <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatRupiah(selectedDay.cashTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">BCA</span>
            <p className="text-base sm:text-lg font-black text-blue-700 mt-0.5">{formatRupiah(selectedDay.bcaTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">QRIS</span>
            <p className="text-base sm:text-lg font-black text-purple-700 mt-0.5">{formatRupiah(selectedDay.qrisTotal)}</p>
          </div>
        </div>

        {/* Transactions Table Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <button onClick={handleToggleSelectAll} className="cursor-pointer text-slate-600 hover:text-emerald-700">
                      {isAllSelected ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="p-4">Waktu</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Keterangan Belanja</th>
                  <th className="p-4 text-center">Cetak</th>
                  <th className="p-4">Metode</th>
                  <th className="p-4 text-right">Nominal</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-10 text-center text-slate-400 font-bold">
                      Tidak ada transaksi tercatat untuk hari ini.
                    </td>
                  </tr>
                ) : (
                  transactions.map(item => {
                    const isDeleted = Boolean(item.isDeleted);
                    const isSelected = selectedIds.includes(item._id);
                    const time = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                    const income = getIncome(item);

                    return (
                      <tr 
                        key={item._id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isDeleted ? 'bg-red-50/50 opacity-70' : isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center">
                          <button onClick={() => handleToggleSelect(item._id)} className="cursor-pointer">
                            {isSelected ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} className="text-slate-400" />}
                          </button>
                        </td>

                        {/* Waktu */}
                        <td className="p-4 font-mono text-xs font-semibold text-slate-600">
                          {time}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          {isDeleted ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                              SAMPAH
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              LUNAS
                            </span>
                          )}
                        </td>

                        {/* Keterangan Belanja (Clickable to view Order Details) */}
                        <td 
                          onClick={() => setDetailModalItem(item)}
                          className={`p-4 max-w-xs truncate cursor-pointer font-bold ${
                            isDeleted ? 'line-through text-slate-400' : 'text-slate-800 hover:text-emerald-700 hover:underline'
                          }`}
                          title="Klik untuk lihat rincian struk"
                        >
                          {item.jenisPengeluaran || 'Transaksi Kasir'}
                        </td>

                        {/* Jumlah Cetak */}
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Printer size={12} />
                            <span>{item.printCount || 0}x</span>
                          </span>
                        </td>

                        {/* Metode Bayar */}
                        <td className="p-4">
                          {renderPayBadge(item)}
                        </td>

                        {/* Nominal */}
                        <td className={`p-4 text-right font-black ${isDeleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {formatRupiah(income)}
                        </td>

                        {/* Aksi */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol Lihat Detail */}
                            <button
                              onClick={() => setDetailModalItem(item)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Rincian Pesanan"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Tombol Hapus Sementara atau Permanen */}
                            {!isDeleted ? (
                              <button
                                onClick={() => handleSoftDelete(item._id)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 bg-slate-100 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Pindahkan ke Sampah"
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleHardDelete(item._id)}
                                className="px-2 py-1 text-[11px] font-bold text-red-600 hover:text-white bg-red-100 hover:bg-red-600 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Permanen Dari Database"
                              >
                                Permanen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Multi-select Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
            <span className="text-xs font-bold text-emerald-400">
              {selectedIds.length} Transaksi Terpilih
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              onClick={() => handleBulkAction(false)}
              disabled={isProcessingDelete}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors active:scale-95"
            >
              Hapus Sementara
            </button>
            <button
              onClick={() => handleBulkAction(true)}
              disabled={isProcessingDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors active:scale-95"
            >
              Hapus Permanen
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              title="Batal Pilih"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Order Detail Modal */}
        {detailModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                    Detail Struk Pesanan
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {detailModalItem.tanggal}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Waktu: {detailModalItem.createdAt ? new Date(detailModalItem.createdAt).toLocaleTimeString('id-ID') : '-'}
                  </p>
                </div>
                <button
                  onClick={() => setDetailModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Parsed items */}
              {(() => {
                const parsed = parseItemsString(detailModalItem.jenisPengeluaran);
                return (
                  <div className="space-y-4">
                    {parsed.orderType && (
                      <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-500">Tipe Pesanan:</span>
                        <span className="text-slate-900 uppercase">{parsed.orderType}</span>
                      </div>
                    )}

                    <div className="border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Item Menu</p>
                      {parsed.realItems.length > 0 ? (
                        <div className="space-y-2">
                          {parsed.realItems.map((it, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="font-extrabold text-slate-800">{it.main}</p>
                              {it.sub.length > 0 && (
                                <p className="text-xs text-slate-500 pl-2">⤷ {it.sub.join(' • ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-700 font-semibold">{detailModalItem.jenisPengeluaran}</p>
                      )}
                    </div>

                    {parsed.note && (
                      <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 font-medium border border-amber-200/50">
                        <span className="font-bold block">Catatan Pelanggan:</span>
                        {parsed.note}
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total Transaksi</span>
                      <span className="text-xl font-black text-emerald-700">{formatRupiah(getIncome(detailModalItem))}</span>
                    </div>

                    <div className="text-xs text-slate-400 flex justify-between">
                      <span>Status: {detailModalItem.isDeleted ? 'Sampah' : 'Lunas'}</span>
                      <span>Print Struk: {detailModalItem.printCount || 0} kali</span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setDetailModalItem(null)}
                className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 cursor-pointer active:scale-95 transition-all"
              >
                TUTUP
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // SUB-VIEW 2: REKAP BULANAN
  // ===========================================================================
  if (viewLevel === 'monthly' && selectedMonth) {
    const daysList = Object.values(selectedMonth.days).sort((a, b) => {
      return parseInt(b.day) - parseInt(a.day);
    });

    return (
      <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewLevel('yearly')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors cursor-pointer"
              title="Kembali ke Grid Tahunan"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rekap Bulanan</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{selectedMonth.month} {selectedMonth.year}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Omzet Bulan Ini</span>
              <span className="text-xl font-black text-emerald-700">{formatRupiah(selectedMonth.totalIncome)}</span>
            </div>
            <button
              onClick={() => exportMonthlyPDF(selectedMonth)}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>Cetak PDF Bulanan</span>
            </button>
          </div>
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">CASH</span>
            <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatRupiah(selectedMonth.cashTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">BCA</span>
            <p className="text-base sm:text-lg font-black text-blue-700 mt-0.5">{formatRupiah(selectedMonth.bcaTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase">QRIS</span>
            <p className="text-base sm:text-lg font-black text-purple-700 mt-0.5">{formatRupiah(selectedMonth.qrisTotal)}</p>
          </div>
        </div>

        {/* Days List Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4 text-center">Jumlah Transaksi</th>
                  <th className="p-4 text-right">CASH</th>
                  <th className="p-4 text-right">BCA</th>
                  <th className="p-4 text-right">QRIS</th>
                  <th className="p-4 text-right">Total Pendapatan</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daysList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-slate-400 font-bold">
                      Belum ada transaksi di bulan ini.
                    </td>
                  </tr>
                ) : (
                  daysList.map(d => {
                    const validCount = d.transactions.filter(t => !t.isDeleted).length;
                    return (
                      <tr 
                        key={d.dateStr}
                        onClick={() => { setSelectedDay(d); setViewLevel('daily'); }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                          <Calendar size={15} className="text-emerald-600" />
                          <span>{d.dateStr}</span>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-600">
                          {validCount} Transaksi
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-700">
                          {formatRupiah(d.cashTotal)}
                        </td>
                        <td className="p-4 text-right font-semibold text-blue-700">
                          {formatRupiah(d.bcaTotal)}
                        </td>
                        <td className="p-4 text-right font-semibold text-purple-700">
                          {formatRupiah(d.qrisTotal)}
                        </td>
                        <td className="p-4 text-right font-black text-emerald-700">
                          {formatRupiah(d.totalIncome)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            className="p-1.5 bg-slate-100 group-hover:bg-emerald-700 text-slate-600 group-hover:text-white rounded-lg transition-colors"
                            title="Buka Detail Transaksi Harian"
                          >
                            <ArrowRight size={15} />
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
    );
  }

  // ===========================================================================
  // SUB-VIEW 1: GRID TAHUNAN (DEFAULT)
  // ===========================================================================
  return (
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
      {groupedYears.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-xs">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-700">Belum Ada Riwayat Penjualan</h3>
          <p className="text-xs text-slate-400 mt-1">Transaksi penjualan dari kasir akan muncul di sini setelah tersinkron.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedYears.map(yearData => {
            const isExpanded = expandedYears[yearData.year] !== false;
            let monthList = Object.values(yearData.months);
            if (sortType === 'chronological') {
              monthList.sort((a, b) => b.monthIndex - a.monthIndex);
            } else {
              monthList.sort((a, b) => b.totalIncome - a.totalIncome);
            }

            return (
              <div key={yearData.year} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
                {/* Year Header Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-5 mb-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedYears(prev => ({ ...prev, [yearData.year]: !isExpanded }))}
                      className="flex items-center gap-2 group cursor-pointer"
                    >
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Tahun {yearData.year}
                      </h2>
                      <div className="p-1 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-600 transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      Total: {formatRupiah(yearData.totalIncome)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span>CASH: <b className="text-slate-800">{formatRupiah(yearData.cashTotal)}</b></span>
                      <span>•</span>
                      <span>BCA: <b className="text-blue-700">{formatRupiah(yearData.bcaTotal)}</b></span>
                      <span>•</span>
                      <span>QRIS: <b className="text-purple-700">{formatRupiah(yearData.qrisTotal)}</b></span>
                    </div>

                    <button
                      onClick={() => exportYearlyPDF(yearData)}
                      className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Cetak PDF {yearData.year}</span>
                    </button>
                  </div>
                </div>

                {/* Months Grid */}
                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {monthList.map(m => (
                      <div
                        key={m.month}
                        onClick={() => { setSelectedMonth(m); setViewLevel('monthly'); }}
                        className="bg-slate-50/80 hover:bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-emerald-600 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-black text-slate-900 text-lg group-hover:text-emerald-700 transition-colors">
                              {m.month}
                            </h3>
                            <div className="p-1.5 bg-white rounded-lg text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all shadow-2xs">
                              <ArrowRight size={16} />
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-500">
                              <span>Transaksi:</span>
                              <span className="font-bold text-slate-800">{m.transactionCount} nota</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>CASH:</span>
                              <span className="font-semibold text-slate-700">{formatRupiah(m.cashTotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>BCA:</span>
                              <span className="font-semibold text-blue-700">{formatRupiah(m.bcaTotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>QRIS:</span>
                              <span className="font-semibold text-purple-700">{formatRupiah(m.qrisTotal)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-3 mt-4 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Omzet Bulan</span>
                          <span className="font-black text-emerald-700 text-base">{formatRupiah(m.totalIncome)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
