// =============================================================================
// SHARED CONSTANTS — Portal Admin Manajemen Keuangan & Operasional
// Cabang: Pecel Lele Cabe Ijo - Kantin SMB
// =============================================================================

// --- API BASE & ENDPOINTS ---
const BACKEND_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : "https://wdd-plci-backend-2.vercel.app";

export const BACKEND_BASE_URL = BACKEND_BASE;
export const API_URL = `${BACKEND_BASE}/api/transactions`;
export const RECURRING_URL = `${BACKEND_BASE}/api/recurring`;
export const EMERGENCY_URL = `${BACKEND_BASE}/api/emergency`;
export const EXPENSES_URL = `${BACKEND_BASE}/api/expenses`;
export const DAILY_STOCKS_URL = `${BACKEND_BASE}/api/daily-stocks`;

// --- AUTH & BRANCH CONFIG ---
export const ADMIN_PASSWORD = "190726";
export const ADMIN_PIN = "190726";

export const BRANCH_INFO = {
  id: 'plci1',
  name: 'Pecel Lele Cabe Ijo - Kantin SMB',
  sheetName: 'PLCI Kantin SMB',
  brand: 'pecel',
  badge: 'PLCI Kantin SMB',
};

// Audio Alarm URL
export const ALARM_AUDIO_URL = "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg";
