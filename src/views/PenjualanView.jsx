import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Download, 
  Trash2, Printer, CheckSquare, Square, Eye, FileText, 
  Calendar, Clock, DollarSign, AlertCircle, ShoppingBag, X,
  CheckCircle, ListFilter, CreditCard, Wallet, Boxes, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, parseYearMonthDate, parseItemsString } from '../shared/utils';
import { API_URL, BRANCH_INFO, DAILY_STOCKS_URL } from '../shared/constants';

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

  // Data Stok Harian & Data Item Terjual Modals (Requirement 1A & 1B)
  const [dailyStockModal, setDailyStockModal] = useState({ isOpen: false, day: null, data: [], isLoading: false });
  const [soldItemsModal, setSoldItemsModal] = useState({ isOpen: false, day: null, items: [] });

  // Hitung total quantity item terjual dari seluruh transaksi pada suatu hari (Quantity Based!)
  const calculateDaySoldItems = (transactions) => {
    if (!Array.isArray(transactions)) return [];
    const itemMap = {};

    transactions.forEach(tx => {
      if (tx.isDeleted) return;
      if (tx.jenisPengeluaran && tx.jenisPengeluaran.includes('[UNPAID]')) return;
      if ((Number(tx.totalPengeluaran) || 0) > 0) return;

      // 1. Structured items (jika tersedia dari kasir baru)
      if (Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach(i => {
          const name = (i.name || '').trim();
          if (!name) return;
          const qty = Number(i.qty) || 1;
          const price = Number(i.price) || 0;
          if (!itemMap[name]) {
            itemMap[name] = { name, totalQty: 0, totalPrice: 0 };
          }
          itemMap[name].totalQty += qty;
          itemMap[name].totalPrice += price * qty;
        });
        return;
      }

      // 2. Parse dari string jenisPengeluaran (fallback & legacy)
      const cleanInput = (tx.jenisPengeluaran || '').replace(/^(?:\[[^\]]+\]\s*)*/, '');
      const parts = cleanInput.split(',').map(p => p.trim()).filter(Boolean);

      parts.forEach(part => {
        if (part.startsWith('**') || part.startsWith('++')) return;
        const main = part.split('::')[0].trim();
        const match = main.match(/^(\d+)\s*x\s+(.+)$/i);
        if (match) {
          const qty = parseInt(match[1], 10) || 1;
          const name = match[2].trim();
          if (!itemMap[name]) {
            itemMap[name] = { name, totalQty: 0, totalPrice: 0 };
          }
          itemMap[name].totalQty += qty;
        } else if (main) {
          const name = main.trim();
          if (!itemMap[name]) {
            itemMap[name] = { name, totalQty: 0, totalPrice: 0 };
          }
          itemMap[name].totalQty += 1;
        }
      });
    });

    return Object.values(itemMap).sort((a, b) => b.totalQty - a.totalQty);
  };

  const handleOpenDailyStockModal = async (day) => {
    setDailyStockModal({ isOpen: true, day, data: [], isLoading: true });
    try {
      const res = await fetch(`${DAILY_STOCKS_URL}?sheet=${encodeURIComponent(BRANCH_INFO.sheetName)}&tanggal=${encodeURIComponent(day.dateStr)}`);
      if (res.ok) {
        const json = await res.json();
        setDailyStockModal(prev => ({
          ...prev,
          data: Array.isArray(json.data) ? json.data : [],
          isLoading: false
        }));
      } else {
        setDailyStockModal(prev => ({ ...prev, data: [], isLoading: false }));
      }
    } catch (err) {
      console.warn('Gagal memuat data stok harian:', err);
      setDailyStockModal(prev => ({ ...prev, data: [], isLoading: false }));
    }
  };

  const handleOpenSoldItemsModal = (day) => {
    const items = calculateDaySoldItems(day.transactions || []);
    setSoldItemsModal({ isOpen: true, day, items });
  };

  // 1. Filter transaksi khusus PLCI Kantin SMB & Penjualan (bukan UNPAID, totalPengeluaran === 0, bukan deleted)
  const salesData = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    return rawData.filter(item => {
      const isTargetBranch = item.sheet === BRANCH_INFO.sheetName || item.cabang === BRANCH_INFO.sheetName;
      const isNotUnpaid = !item.jenisPengeluaran || !item.jenisPengeluaran.includes('[UNPAID]');
      const isSales = (Number(item.totalPengeluaran) || 0) === 0;
      const notDeleted = !item.isDeleted;
      return isTargetBranch && isNotUnpaid && isSales && notDeleted;
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

      yearsMap[year].totalIncome += income;
      yearsMap[year].cashTotal += Number(item.cash) || 0;
      yearsMap[year].bcaTotal += Number(item.bca) || 0;
      yearsMap[year].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);

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

      yearsMap[year].months[month].totalIncome += income;
      yearsMap[year].months[month].cashTotal += Number(item.cash) || 0;
      yearsMap[year].months[month].bcaTotal += Number(item.bca) || 0;
      yearsMap[year].months[month].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);
      yearsMap[year].months[month].transactionCount += 1;

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

      yearsMap[year].months[month].days[fullDateStr].totalIncome += income;
      yearsMap[year].months[month].days[fullDateStr].cashTotal += Number(item.cash) || 0;
      yearsMap[year].months[month].days[fullDateStr].bcaTotal += Number(item.bca) || 0;
      yearsMap[year].months[month].days[fullDateStr].qrisTotal += (Number(item.gofood) || Number(item.qris) || 0);
      yearsMap[year].months[month].days[fullDateStr].transactions.push(item);
    });

    const sortedYears = Object.values(yearsMap).sort((a, b) => parseInt(b.year) - parseInt(a.year));
    // Default open latest year
    if (sortedYears.length > 0 && Object.keys(expandedYears).length === 0) {
      setExpandedYears({ [sortedYears[0].year]: true });
    }
    return sortedYears;
  }, [salesData, expandedYears]);

  // Handle single permanent delete directly from MongoDB
  const handleDeleteTransaction = async (id) => {
    if (!id) return;
    if (!window.confirm("Hapus transaksi penjualan ini secara permanen dari database MongoDB?")) return;
    try {
      await fetch(`${API_URL}/hard/${id}`, { method: 'DELETE' });
      if (onRefresh) onRefresh();
    } catch (e) {
      alert("Gagal menghapus transaksi dari database");
    }
  };

  // Handle Bulk Permanent Delete from MongoDB
  const handleBulkAction = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`🚨 Hapus ${selectedIds.length} transaksi terpilih secara PERMANEN dari database MongoDB?`)) return;

    setIsProcessingDelete(true);
    try {
      await fetch(`${API_URL}/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, isHardDelete: true })
      });
      setSelectedIds([]);
      if (onRefresh) onRefresh();
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
      d.transactions.length,
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
    const validTransactions = dayData.transactions;
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

        {/* Daily Summary Stats (5 Cards: Cash, BCA, QRIS, Data Stok Hari Ini, Data Item Terjual) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">CASH</span>
            <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{formatRupiah(selectedDay.cashTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">BCA</span>
            <p className="text-base sm:text-lg font-black text-blue-700 mt-0.5">{formatRupiah(selectedDay.bcaTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">QRIS</span>
            <p className="text-base sm:text-lg font-black text-purple-700 mt-0.5">{formatRupiah(selectedDay.qrisTotal)}</p>
          </div>

          {/* CARD 4: DATA STOK HARI INI (REQUIREMENT 1A) */}
          <button
            type="button"
            onClick={() => handleOpenDailyStockModal(selectedDay)}
            className="bg-white hover:bg-emerald-50/60 p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-300 text-left transition-all active:scale-95 cursor-pointer shadow-2xs group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1 group-hover:underline">
                <Boxes size={12} /> Data Stok
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                Detail →
              </span>
            </div>
            <p className="text-sm sm:text-base font-black text-emerald-800 mt-1">
              Data Stok Hari Ini
            </p>
          </button>

          {/* CARD 5: DATA ITEM TERJUAL (REQUIREMENT 1B) */}
          {(() => {
            const soldList = calculateDaySoldItems(selectedDay.transactions || []);
            const totalQty = soldList.reduce((acc, curr) => acc + curr.totalQty, 0);
            return (
              <button
                type="button"
                onClick={() => handleOpenSoldItemsModal(selectedDay)}
                className="bg-white hover:bg-amber-50/60 p-4 rounded-2xl border border-slate-200/80 hover:border-amber-300 text-left transition-all active:scale-95 cursor-pointer shadow-2xs group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1 group-hover:underline">
                    <ShoppingBag size={12} /> Terjual
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                    {totalQty} Pcs →
                  </span>
                </div>
                <p className="text-sm sm:text-base font-black text-amber-800 mt-1">
                  Data Item Terjual
                </p>
              </button>
            );
          })()}
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
                          isSelected ? 'bg-emerald-50/40' : ''
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
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            LUNAS
                          </span>
                        </td>

                        {/* Keterangan Belanja (Clickable to view Order Details) */}
                        <td 
                          onClick={() => setDetailModalItem(item)}
                          className="p-4 max-w-xs truncate cursor-pointer font-bold text-slate-800 hover:text-emerald-700 hover:underline"
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
                        <td className="p-4 text-right font-black text-slate-900">
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

                            {/* Tombol Hapus Permanen */}
                            <button
                              onClick={() => handleDeleteTransaction(item._id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Permanen Dari Database"
                            >
                              <Trash2 size={15} />
                            </button>
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
              onClick={handleBulkAction}
              disabled={isProcessingDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 size={14} />
              <span>Hapus Permanen</span>
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
                      <span>Status: Lunas</span>
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

        {/* MODAL 1: DATA STOK HARI INI (REQUIREMENT 1A) */}
        {dailyStockModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center font-black">
                    <Boxes size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Data Stok Hari Ini</h3>
                    <p className="text-xs text-slate-500 font-bold">{dailyStockModal.day?.dateStr}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDailyStockModal({ isOpen: false, day: null, data: [], isLoading: false })}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {dailyStockModal.isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-bold">Memuat data audit stok...</span>
                  </div>
                ) : dailyStockModal.data.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                    <Boxes size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    Tidak ada rekaman data stok harian tersinkronisasi untuk tanggal ini.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyStockModal.data.map((item, idx) => {
                      const historyList = Array.isArray(item.history) ? item.history : [];
                      const netAdjustment = (item.totalStokInput !== undefined ? item.totalStokInput : item.stokAwal) - (item.stokAwal || 0);

                      return (
                        <div key={item._id || item.menuId || idx} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{item.category || 'Satuan'}</span>
                              <h4 className="text-sm font-black text-slate-900">{item.menuName}</h4>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Stok Akhir</span>
                              <span className="text-lg font-black text-emerald-700">
                                {item.totalStokInput !== undefined ? item.totalStokInput : item.stokAwal} Pcs
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Stok Awal</span>
                              <span className="font-black text-slate-800 text-sm">{item.stokAwal || 0} Pcs</span>
                              {item.stokAwalTime && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">Jam Input: {item.stokAwalTime}</span>
                              )}
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Penyesuaian</span>
                              <span className={`font-black text-sm ${netAdjustment > 0 ? 'text-emerald-600' : netAdjustment < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                {netAdjustment > 0 ? `+${netAdjustment}` : netAdjustment} Pcs
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{historyList.length} kali penyesuaian</span>
                            </div>
                          </div>

                          {/* Riwayat Detail Histori Penyesuaian (+ / -) */}
                          {historyList.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                              <div className="bg-slate-100/70 px-3 py-1.5 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider flex justify-between">
                                <span>Histori Perubahan (+ / -)</span>
                                <span>Waktu</span>
                              </div>
                              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                                {historyList.map((h, hIdx) => (
                                  <div key={hIdx} className="px-3 py-2 text-xs flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${h.delta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {h.delta > 0 ? `+${h.delta}` : h.delta}
                                      </span>
                                      <span className="font-bold text-slate-700 capitalize">
                                        {h.type || (h.delta > 0 ? 'Penambahan' : 'Pengurangan')}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-400">
                                      {h.time}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => setDailyStockModal({ isOpen: false, day: null, data: [], isLoading: false })}
                  className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: DATA ITEM TERJUAL (REQUIREMENT 1B) */}
        {soldItemsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-amber-50 text-amber-800 rounded-2xl flex items-center justify-center font-black">
                    <ShoppingBag size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Data Item Terjual</h3>
                    <p className="text-xs text-slate-500 font-bold">{soldItemsModal.day?.dateStr}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSoldItemsModal({ isOpen: false, day: null, items: [] })}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Total Banner */}
              <div className="my-3 p-3 bg-amber-50 border border-amber-200/70 rounded-2xl flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-amber-900">Total Akumulasi Quantity Terjual:</span>
                <span className="text-base sm:text-lg font-black text-amber-900">
                  {soldItemsModal.items.reduce((acc, curr) => acc + curr.totalQty, 0)} Pcs / Porsi
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {soldItemsModal.items.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                    Tidak ada transaksi penjualan untuk tanggal ini.
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 w-10 text-center">No</th>
                          <th className="p-3">Nama Item</th>
                          <th className="p-3 text-right">Quantity Terjual</th>
                          {soldItemsModal.items.some(i => i.totalPrice > 0) && (
                            <th className="p-3 text-right">Subtotal Omzet</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {soldItemsModal.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-900">{it.name}</td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-black text-xs">
                                {it.totalQty} Pcs
                              </span>
                            </td>
                            {soldItemsModal.items.some(i => i.totalPrice > 0) && (
                              <td className="p-3 text-right font-black text-slate-800">
                                {it.totalPrice > 0 ? formatRupiah(it.totalPrice) : '-'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => setSoldItemsModal({ isOpen: false, day: null, items: [] })}
                  className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  TUTUP
                </button>
              </div>
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
                    const validCount = d.transactions.length;
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
