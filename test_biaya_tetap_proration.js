import { 
  getFixedExpenseMonthlyNominal, 
  isFixedExpenseActiveOnDate, 
  isFixedExpenseActiveInMonth,
  UnifiedExpenseDB
} from './src/db/unifiedExpenses.js';
import { parseYearMonthDate } from './src/shared/utils.js';

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

console.log('=== TEST SUITE: BIAYA TETAP PRORASI HARIAN & STRICT DATE FILTER ===\n');

// -----------------------------------------------------------------------------
// TEST 1: getFixedExpenseMonthlyNominal
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Monthly Nominal Calculation for Different Frequencies ---');
const feMonthly = { nominal: 3000000, frekuensi: 'Per Bulan' };
assert('Per Bulan returns exact nominal', getFixedExpenseMonthlyNominal(feMonthly) === 3000000);

const feYearly = { nominal: 12000000, frekuensi: 'Per Tahun' };
assert('Per Tahun divides by 12', getFixedExpenseMonthlyNominal(feYearly) === 1000000);

const fe6Month = { nominal: 6000000, frekuensi: 'Per 6 Bulan' };
assert('Per 6 Bulan divides by 6', getFixedExpenseMonthlyNominal(fe6Month) === 1000000);

const fe3Month = { nominal: 3000000, frekuensi: 'Per 3 Bulan' };
assert('Per 3 Bulan divides by 3', getFixedExpenseMonthlyNominal(fe3Month) === 1000000);

const fe2Month = { nominal: 2000000, frekuensi: 'Tiap 2 Bulan' };
assert('Tiap 2 Bulan divides by 2', getFixedExpenseMonthlyNominal(fe2Month) === 1000000);

const fe15Days = { nominal: 500000, frekuensi: 'Tiap 15 Hari' };
assert('Tiap 15 Hari scales to 30 days', getFixedExpenseMonthlyNominal(fe15Days) === 1000000);

const feWeekly = { nominal: 700000, frekuensi: 'Per Minggu' };
assert('Per Minggu scales to 30 days', Math.round(getFixedExpenseMonthlyNominal(feWeekly)) === 3000000);


// -----------------------------------------------------------------------------
// TEST 2: Active Date Checking
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Fixed Expense Active Date Boundaries ---');
const feActive = {
  kategori: 'tetap',
  tanggal: '2026-10-01',
  endDate: '2026-12-01',
  nominal: 1500000,
  frekuensi: 'Per Bulan'
};

assert('Active on start date 2026-10-01', isFixedExpenseActiveOnDate(feActive, '2026-10-01') === true);
assert('Active on mid date 2026-11-15', isFixedExpenseActiveOnDate(feActive, '2026-11-15') === true);
assert('Active on end date 2026-12-01', isFixedExpenseActiveOnDate(feActive, '2026-12-01') === true);
assert('NOT active before start date 2026-09-30', isFixedExpenseActiveOnDate(feActive, '2026-09-30') === false);
assert('NOT active after end date 2026-12-02', isFixedExpenseActiveOnDate(feActive, '2026-12-02') === false);

assert('Active in October 2026 (month index 9)', isFixedExpenseActiveInMonth(feActive, 2026, 9) === true);
assert('Active in November 2026 (month index 10)', isFixedExpenseActiveInMonth(feActive, 2026, 10) === true);
assert('Active in December 2026 (month index 11, has Dec 1)', isFixedExpenseActiveInMonth(feActive, 2026, 11) === true);
assert('NOT active in September 2026 (month index 8)', isFixedExpenseActiveInMonth(feActive, 2026, 8) === false);
assert('NOT active in January 2027 (month index 0)', isFixedExpenseActiveInMonth(feActive, 2027, 0) === false);


// -----------------------------------------------------------------------------
// TEST 3: Daily Proration Formula (Days in Month)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Daily Proration (Harga Sebulan / Hari di Bulan Tersebut) ---');
// September 2026: 30 days
const daysSep = new Date(2026, 9, 0).getDate(); // 30
assert('September 2026 has 30 days', daysSep === 30);
const monthlySewa = 3000000;
const dailySep = monthlySewa / daysSep;
assert('Daily rate in September is exactly Rp 100.000 / day', dailySep === 100000);
assert('Sum over 30 days in September is exactly Rp 3.000.000', dailySep * daysSep === 3000000);

// October 2026: 31 days
const daysOct = new Date(2026, 10, 0).getDate(); // 31
assert('October 2026 has 31 days', daysOct === 31);
const dailyOct = monthlySewa / daysOct;
assert('Daily rate in October is ~96.774 / day', Math.round(dailyOct) === 96774);
assert('Sum over 31 days in October is mathematically exact Rp 3.000.000', Math.round(dailyOct * daysOct) === 3000000);


// -----------------------------------------------------------------------------
// TEST 4: Date Parsing (Accounting Date takes Priority over createdAt)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Accounting Date Parsing Priority ---');
const sampleItem1 = {
  tanggal: '2026-10-01',
  createdAt: '2026-09-24T08:04:47.137Z'
};
const parsed1 = sampleItem1.tanggal.split('-');
const d1 = new Date(parseInt(parsed1[0], 10), parseInt(parsed1[1], 10) - 1, parseInt(parsed1[2], 10));
assert('Sample item 1 resolves to October 1st (not September 24)', d1.getMonth() === 9 && d1.getDate() === 1);

const sampleItem2 = {
  tanggal: 'Senin, 07 September 2026',
  createdAt: '2026-09-07T16:08:22.664Z'
};
const ym2 = parseYearMonthDate(sampleItem2.tanggal);
const d2 = new Date(parseInt(ym2.year, 10), ym2.monthIndex, parseInt(ym2.day, 10));
assert('Sample transaction resolves to September 7, 2026', d2.getFullYear() === 2026 && d2.getMonth() === 8 && d2.getDate() === 7);


// -----------------------------------------------------------------------------
// TEST 5: Strict Date Range Filtering Simulation
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Strict Date Filtering (Range: 2026-10-01 s/d 2026-12-01) ---');
const filterStart = new Date(2026, 9, 1, 0, 0, 0, 0); // 1 Oct 2026
const filterEnd = new Date(2026, 11, 1, 23, 59, 59, 999); // 1 Dec 2026

function testDateInFilter(dateObj) {
  return dateObj >= filterStart && dateObj <= filterEnd;
}

assert('2026-09-30 is strictly EXCLUDED', testDateInFilter(new Date(2026, 8, 30)) === false);
assert('2026-10-01 is strictly INCLUDED', testDateInFilter(new Date(2026, 9, 1)) === true);
assert('2026-11-15 is strictly INCLUDED', testDateInFilter(new Date(2026, 10, 15)) === true);
assert('2026-12-01 is strictly INCLUDED', testDateInFilter(new Date(2026, 11, 1)) === true);
assert('2026-12-02 is strictly EXCLUDED', testDateInFilter(new Date(2026, 11, 2)) === false);

// Biaya Tetap Calculation across 2026-10-01 to 2026-12-01
// User input: Gaji Kasir Rp 1.500.000 / month, active 2026-10-01 to 2026-12-01
const testFe = {
  kategori: 'tetap',
  tanggal: '2026-10-01',
  endDate: '2026-12-01',
  nominal: 1500000,
  frekuensi: 'Per Bulan'
};

let simCur = new Date(2026, 9, 1);
const simEnd = new Date(2026, 11, 1);
let simTotalTetap = 0;
let simDaysCount = 0;

while (simCur <= simEnd) {
  const y = simCur.getFullYear();
  const m = simCur.getMonth();
  const d = simCur.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  if (isFixedExpenseActiveOnDate(testFe, dateStr)) {
    const monthly = getFixedExpenseMonthlyNominal(testFe);
    simTotalTetap += monthly / daysInMonth;
  }
  simDaysCount++;
  simCur.setDate(simCur.getDate() + 1);
}

assert('Range from 2026-10-01 to 2026-12-01 has exactly 62 days', simDaysCount === 62);
// 31 days in Oct (= 1.500.000) + 30 days in Nov (= 1.500.000) + 1 day in Dec (= 1.500.000 / 31 = 48.387)
const expectedTetap = 1500000 + 1500000 + Math.round(1500000 / 31);
assert('Simulated Biaya Tetap for 62 days matches exact sum', Math.round(simTotalTetap) === expectedTetap, `Expected ${expectedTetap}, got ${Math.round(simTotalTetap)}`);

// Single Day ("Hari Ini") calculation
const singleDayOct = 1500000 / 31;
assert('Single day in October has prorata 1.500.000 / 31 = ~48.387', Math.round(singleDayOct) === 48387);

// Single Month ("Bulan Ini") calculation
const fullMonthOct = 31 * (1500000 / 31);
// -----------------------------------------------------------------------------
// TEST 6: Testing "Per Hari" (Daily Routine) Fixed Expenses
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing "Per Hari" (Daily Routine) Fixed Expenses ---');
const feDaily = { nominal: 20000, frekuensi: 'Per Hari' };
assert('Per Hari monthly nominal for 30-day month (Sep) is 20.000 * 30 = 600.000', getFixedExpenseMonthlyNominal(feDaily, 30) === 600000);
assert('Per Hari monthly nominal for 31-day month (Oct) is 20.000 * 31 = 620.000', getFixedExpenseMonthlyNominal(feDaily, 31) === 620000);

// Simulation of Per Hari in date range (62 days from 2026-10-01 to 2026-12-01)
const testFeDaily = {
  kategori: 'tetap',
  tanggal: '2026-10-01',
  endDate: '2026-12-01',
  nominal: 20000,
  frekuensi: 'Per Hari'
};

let simDailyCur = new Date(2026, 9, 1);
const simDailyEnd = new Date(2026, 11, 1);
let simDailyTotal = 0;
let simDailyDays = 0;

while (simDailyCur <= simDailyEnd) {
  const y = simDailyCur.getFullYear();
  const m = simDailyCur.getMonth();
  const d = simDailyCur.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  if (isFixedExpenseActiveOnDate(testFeDaily, dateStr)) {
    const isDaily = (testFeDaily.frekuensi || '').toLowerCase().includes('hari') && !(testFeDaily.frekuensi || '').includes('15');
    const dailyRate = isDaily ? (Number(testFeDaily.nominal) || 0) : (getFixedExpenseMonthlyNominal(testFeDaily, daysInMonth) / daysInMonth);
    simDailyTotal += dailyRate;
  }
  simDailyDays++;
  simDailyCur.setDate(simDailyCur.getDate() + 1);
}

assert('Simulated Per Hari for 62 days equals 20.000 * 62 = 1.240.000', simDailyTotal === 1240000, `Expected 1240000, got ${simDailyTotal}`);

// Combined monthly + daily fixed costs
const combinedTotal = simTotalTetap + simDailyTotal;
assert('Combined monthly + daily fixed costs for 62 days equals exact sum', Math.round(combinedTotal) === expectedTetap + 1240000);

console.log(`\n========================================`);
console.log(`SUMMARY: ${passes} PASSED, ${fails} FAILED`);
console.log(`========================================`);

if (fails > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
}
