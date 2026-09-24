import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import Sidenavbar from './components/Sidenavbar';
import HeaderBar from './components/HeaderBar';
import SmartPinLogin from './components/SmartPinLogin';
import EmergencyAlertModal from './components/EmergencyAlertModal';
import ErrorBoundary from './components/ErrorBoundary';

import PenjualanView from './views/PenjualanView';
import PengeluaranView from './views/PengeluaranView';
import KeuanganView from './views/KeuanganView';
import PencatatanPengeluaranView from './views/PencatatanPengeluaranView';

import { API_URL, RECURRING_URL } from './shared/constants';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('plci_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Current active navigation tab: 'penjualan' | 'pengeluaran' | 'keuangan'
  const [currentTab, setCurrentTab] = useState('penjualan');

  // Transactions data
  const [rawData, setRawData] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch all transactions
  const fetchTransactions = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setRawData(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('Gagal memuat data transaksi:', e);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Trigger recurring auto-apply & initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      // 1. Trigger recurring auto-apply
      fetch(`${RECURRING_URL}/trigger`, { method: 'POST' }).catch((e) => {
        console.warn('Trigger recurring error:', e);
      });

      // 2. Fetch transactions data
      fetchTransactions();
    }
  }, [isAuthenticated, fetchTransactions]);

  // Handle Login Success
  const handleLoginSuccess = () => {
    try {
      sessionStorage.setItem('plci_admin_auth', 'true');
    } catch (e) {}
    setIsAuthenticated(true);
  };

  // Handle Logout / Lock
  const handleLogout = () => {
    try {
      sessionStorage.removeItem('plci_admin_auth');
    } catch (e) {}
    setIsAuthenticated(false);
  };

  // If not authenticated, show PIN gate
  if (!isAuthenticated) {
    return <SmartPinLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-900 font-sans select-none">
      {/* Real-time Emergency Alert Modal & Alarm */}
      <EmergencyAlertModal />

      {/* Persistent Sidenavbar (3 Tabs: Penjualan, Pengeluaran, Keuangan + Logout) */}
      <Sidenavbar
        currentTab={currentTab}
        onSwitchTab={setCurrentTab}
        onLogout={handleLogout}
      />

      {/* Main View Shell Container */}
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-50">
        {/* Top HeaderBar */}
        <HeaderBar
          activeTab={currentTab}
          onRefresh={fetchTransactions}
          isRefreshing={isFetching}
          onLock={handleLogout}
        />

        {/* Dynamic Content View Area */}
        <main className="flex-1 w-full overflow-y-auto p-4 sm:p-6 md:p-8">
          <ErrorBoundary key={currentTab} onLogout={handleLogout}>
            {isFetching && rawData.length === 0 ? (
              <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <Loader2 size={40} className="text-emerald-700 animate-spin" />
                <p className="text-sm font-bold text-slate-600">
                  Menghubungkan ke server & menyinkronkan data...
                </p>
              </div>
            ) : (
              <>
                {currentTab === 'input_pengeluaran' && (
                  <PencatatanPengeluaranView />
                )}
                {currentTab === 'penjualan' && (
                  <PenjualanView rawData={rawData} onRefresh={fetchTransactions} />
                )}
                {currentTab === 'pengeluaran' && (
                  <PengeluaranView rawData={rawData} onRefresh={fetchTransactions} />
                )}
                {currentTab === 'keuangan' && (
                  <KeuanganView rawData={rawData} onRefresh={fetchTransactions} />
                )}
              </>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}