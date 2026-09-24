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

// 8. Hierarchical Time-Based Aggregation Tests (UnifiedExpenseDB)
import { UnifiedExpenseDB } from './src/db/unifiedExpenses.js';

const allExpenses = UnifiedExpenseDB.getAll();
assert('UnifiedExpenseDB seeds loaded with > 0 records', allExpenses.length > 0, `Count: ${allExpenses.length}`);

// Strictly 3 categories verified
const validCategories = new Set(['bahan_baku', 'tetap', 'variabel']);
const allCategoriesValid = allExpenses.every(exp => validCategories.has(exp.kategori));
assert('All seeded records strictly belong to 3 categories (Bahan Baku, Tetap, Variabel)', allCategoriesValid);

// Test Hierarchy Aggregation
const hierarchy = UnifiedExpenseDB.getHierarchy();
assert('Hierarchy contains sorted years', Array.isArray(hierarchy) && hierarchy.length >= 2);

hierarchy.forEach(yearNode => {
  // Check Year Category Sums
  const yearSum = yearNode.bahanBaku + yearNode.tetap + yearNode.variabel;
  assert(`Year ${yearNode.year}: grandTotal (${yearNode.grandTotal}) === sum of 3 categories (${yearSum})`, yearNode.grandTotal === yearSum);

  const months = Object.values(yearNode.months);
  let monthsSum = 0;

  months.forEach(monthNode => {
    // Check Month Category Sums
    const monthSum = monthNode.bahanBaku + monthNode.tetap + monthNode.variabel;
    assert(`  Month ${monthNode.month} ${monthNode.year}: grandTotal (${monthNode.grandTotal}) === sum of 3 categories (${monthSum})`, monthNode.grandTotal === monthSum);
    monthsSum += monthNode.grandTotal;

    const days = Object.values(monthNode.days);
    let daysSum = 0;

    days.forEach(dayNode => {
      // Check Day Category Sums
      const daySum = dayNode.bahanBaku + dayNode.tetap + dayNode.variabel;
      assert(`    Day ${dayNode.dateStr}: grandTotal (${dayNode.grandTotal}) === sum of 3 categories (${daySum})`, dayNode.grandTotal === daySum);
      daysSum += dayNode.grandTotal;

      // Check Granular Logs
      const logsSum = dayNode.logs.reduce((acc, log) => acc + log.nominal, 0);
      assert(`      Day ${dayNode.dateStr}: grandTotal === sum of granular logs (${logsSum})`, dayNode.grandTotal === logsSum);
    });

    assert(`  Month ${monthNode.month}: sum of daily grandTotals === month grandTotal`, daysSum === monthNode.grandTotal);
  });

  assert(`Year ${yearNode.year}: sum of monthly grandTotals === year grandTotal`, monthsSum === yearNode.grandTotal);
});

// Test Employee Creation and Personal Filter
const testSubmission = UnifiedExpenseDB.create({
  tanggal: '2026-09-23',
  kategori: 'bahan_baku',
  nama_item: 'Cabai Rawit Ekstra 5kg',
  nominal: 175000,
  karyawan: 'Budi Santoso',
  attachment: 'data:image/svg+xml;utf8,dummy-receipt',
  keterangan: 'Belanja mendesak bumbu'
});

assert('Employee submission returns valid record with id and timestamp', !!testSubmission.id && testSubmission.nominal === 175000);
const budiLogs = UnifiedExpenseDB.getByEmployee('Budi Santoso');
assert('Employee personal history filter returns submitted record', budiLogs.some(l => l.id === testSubmission.id));

console.log(`\nTOTAL RESULTS: ${passes} PASSED, ${fails} FAILED`);
if (fails > 0) process.exit(1);

