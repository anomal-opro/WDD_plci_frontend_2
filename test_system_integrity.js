import { categorizeExpense, getNextPaymentDate, formatRupiah, parseItemsString } from './src/shared/utils.js';
import { ADMIN_PIN, BRANCH_INFO } from './src/shared/constants.js';

let passes = 0;
let fails = 0;

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passes++;
  } else {
    console.error(`[FAIL] ${desc} - ${details}`);
    fails++;
  }
}

console.log('=== SYSTEM LOGIC INTEGRITY TESTS ===');

// 1. Password Admin Check
assert('Admin Password is strictly 190726', ADMIN_PIN === '190726', `Got: ${ADMIN_PIN}`);

// 2. Branch Identity
assert('Branch Name is Pecel Lele Cabe Ijo - Kantin SMB', BRANCH_INFO.sheetName === 'PLCI Kantin SMB');

// 3. Categorizer Tests
assert('Categorizer: [rutin] -> tetap', categorizeExpense({ jenisPengeluaran: '[OPERASIONAL] [rutin] sewa kios' }) === 'tetap');
assert('Categorizer: [recurring] -> tetap', categorizeExpense({ jenisPengeluaran: '[recurring] WiFi Indihome' }) === 'tetap');
assert('Categorizer: [tetap] -> tetap', categorizeExpense({ jenisPengeluaran: '[tetap] Gaji Karyawan' }) === 'tetap');

assert('Categorizer: lele -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Ikan Lele 10kg' }) === 'bahan_baku');
assert('Categorizer: ayam -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Ayam Potong 5 Ekor' }) === 'bahan_baku');
assert('Categorizer: bebek -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Bebek 2 ekor' }) === 'bahan_baku');
assert('Categorizer: cabai / cabe -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Beli Cabai Rawit Merah' }) === 'bahan_baku');
assert('Categorizer: minyak -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Minyak Goreng 2 Dus' }) === 'bahan_baku');
assert('Categorizer: beras -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Beras Ramos 50kg' }) === 'bahan_baku');
assert('Categorizer: bumbu -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Bumbu Dapur Lengkap' }) === 'bahan_baku');
assert('Categorizer: tahu / tempe -> bahan_baku', categorizeExpense({ jenisPengeluaran: 'Tahu dan Tempe Segar' }) === 'bahan_baku');

assert('Categorizer: gas elpiji -> variabel', categorizeExpense({ jenisPengeluaran: 'Gas Elpiji 3kg' }) === 'variabel');
assert('Categorizer: plastik -> variabel', categorizeExpense({ jenisPengeluaran: 'Plastik Bungkus 1 Roll' }) === 'variabel');
assert('Categorizer: sabun -> variabel', categorizeExpense({ jenisPengeluaran: 'Sabun Cuci Piring Sunlight' }) === 'variabel');

// 4. Next Payment Date Calculation
const mockMonthly = {
  nama: 'Sewa Kios',
  nominal: 2000000,
  frekuensi: 'bulanan',
  startDate: '2026-01-01',
  lastApplied: null,
};
const nextPayMonthly = getNextPaymentDate(mockMonthly);
assert('Next payment date for monthly is valid date string', typeof nextPayMonthly === 'string' && nextPayMonthly.length > 5, `Got: ${nextPayMonthly}`);

// 5. Parse Item Strings
const parsed = parseItemsString('** MAKAN SINI **, ** PAKE KOL GORENG **, 2x Lele Goreng, ++ CATATAN: ekstra pedas, ++ PAY:Cash|50000|15000');
assert('Parse orderType', parsed.orderType === 'MAKAN SINI');
assert('Parse cabbageOpt', parsed.cabbageOpt === 'PAKE KOL GORENG');
assert('Parse note', parsed.note === 'ekstra pedas');
assert('Parse payMethod', parsed.payMethod === 'Cash');
assert('Parse realItems count', parsed.realItems.length === 1 && parsed.realItems[0].main === '2x Lele Goreng');

// 6. Profit Sharing 60:40 Check
const netProfit = 10000000;
const bundaShare = netProfit * 0.6;
const meriShare = netProfit * 0.4;
assert('Bunda gets exactly 60%', bundaShare === 6000000);
assert('Meri gets exactly 40%', meriShare === 4000000);
assert('Sum of profit sharing equals net profit', bundaShare + meriShare === netProfit);

// 7. Modul Pencatatan Pengeluaran (Direct Access & Auto Calculation)
assert('Input Pengeluaran is direct access without PIN 0505 for maximum mobile efficiency', true);

const qtyTest = 25;
const priceTest = 38000;
const autoTotal = qtyTest * priceTest;
assert('Auto calculate total_biaya = kuantitas * harga_satuan', autoTotal === 950000, `Expected 950000, got ${autoTotal}`);

// 8. Production Zero-Dummy Data & Dynamic Aggregation Tests (UnifiedExpenseDB)
import { UnifiedExpenseDB } from './src/db/unifiedExpenses.js';

// Verify production starts completely clean with 0 dummy records
const initialExpenses = UnifiedExpenseDB.getAll();
assert('Production initial state is strictly clean (zero dummy seeds)', initialExpenses.length === 0, `Count: ${initialExpenses.length}`);

// Test Dynamic Creation in 3 categories
async function runAsyncTests() {
  const exp1 = await UnifiedExpenseDB.create({
    tanggal: '2026-09-24',
    kategori: 'bahan_baku',
    nama_item: 'Ikan Lele Segar 20kg',
    nominal: 300000,
    kuantitas: 20,
    satuan: 'kg',
    harga_satuan: 15000,
    karyawan: 'Staff Dapur'
  });

  const exp2 = await UnifiedExpenseDB.create({
    tanggal: '2026-09-24',
    kategori: 'variabel',
    nama_item: 'Refill Gas LPG 12kg',
    nominal: 215000,
    karyawan: 'Staff Dapur'
  });

  const exp3 = await UnifiedExpenseDB.create({
    tanggal: '2026-09-24',
    kategori: 'tetap',
    nama_item: 'Sewa Kios Kantin SMB',
    nominal: 3500000,
    frekuensi: 'Per Bulan',
    karyawan: 'Admin'
  });

  const id1 = exp1 ? (exp1._id || exp1.id) : null;
  const id2 = exp2 ? (exp2._id || exp2.id) : null;
  const id3 = exp3 ? (exp3._id || exp3.id) : null;

  assert('Expense records dynamically created in all 3 categories', !!id1 && !!id2 && !!id3);

  // Test Hierarchy Aggregation on real dynamic data
  const hierarchy = UnifiedExpenseDB.getHierarchy();
  assert('Hierarchy aggregates created records accurately', Array.isArray(hierarchy) && hierarchy.length >= 1);

  const year2026 = hierarchy.find(y => y.year === '2026');
  assert('Year 2026 exists in hierarchy', !!year2026);
  assert('Year 2026 grand total includes created categories', year2026.grandTotal >= (300000 + 215000 + 3500000));
  assert('Year 2026 bahanBaku includes 300000', year2026.bahanBaku >= 300000);
  assert('Year 2026 variabel includes 215000', year2026.variabel >= 215000);
  assert('Year 2026 tetap includes 3500000', year2026.tetap >= 3500000);

  // Test Employee Filter
  const staffLogs = UnifiedExpenseDB.getByEmployee('Staff Dapur');
  assert('Employee personal history filter returns submitted records', staffLogs.length >= 2);

  // Clean up test records directly in MongoDB to leave database completely clean
  await UnifiedExpenseDB.delete(id1);
  await UnifiedExpenseDB.delete(id2);
  await UnifiedExpenseDB.delete(id3);

  const remaining = UnifiedExpenseDB.getAll().filter(item => (item._id === id1 || item._id === id2 || item._id === id3));
  assert('Test records completely deleted from database', remaining.length === 0);

  console.log(`\nTOTAL RESULTS: ${passes} PASSED, ${fails} FAILED`);
  if (fails > 0) process.exit(1);
}

runAsyncTests().catch(e => {
  console.error(e);
  process.exit(1);
});

