// =============================================================================
// DEEP END-TO-END SYSTEM TEST & DATA VERIFICATION SUITE
// =============================================================================

import {
  formatRupiah, formatQueue, getTodayStr, getBaseMenuList,
  getCartKey, calculateLiveStock, buildActiveMenuList,
  calculateNextQueueNumber, parseItemsString
} from './src/shared/utils.js';

import { MENU_PLCI, MENU_MM, STOCK_BYPASS_IDS, BRANCH_CONFIG } from './src/shared/constants.js';

const API_BASE = "https://wdd-plci-backend-2.vercel.app/api";
const sheetName = "PLCI Kantin SMB";

const testResults = [];

function testAssert(id, category, name, action, input, expected, actual, isPass, evidence = null) {
  const item = {
    id, category, name, action, input: JSON.stringify(input),
    expected: String(expected), actual: String(actual),
    status: isPass ? 'PASS' : 'FAIL',
    evidence: evidence || null
  };
  testResults.push(item);
  console.log(`[${item.status}] ${id}: ${name}`);
  if (!isPass) {
    console.error(`   -> EXPECTED: ${expected}`);
    console.error(`   -> ACTUAL:   ${actual}`);
  }
}

async function runFullVerificationSuite() {
  console.log("=================================================================");
  console.log("STARTING FULL RIGOROUS END-TO-END VERIFICATION SUITE");
  console.log("Time:", new Date().toISOString());
  console.log("=================================================================\n");

  const todayStr = getTodayStr();

  // ---------------------------------------------------------------------------
  // SECTION 1: AUTH & BRANCH CONFIGURATION TESTS
  // ---------------------------------------------------------------------------
  console.log("--- SECTION 1: Auth & Branch Config ---");
  testAssert(
    'TC-AUTH-001', 'Auth & PIN', 'PIN 1010 Resolves to Normal Cashier (Single Main Key)',
    'Lookup BRANCH_CONFIG["1010"]', { pin: '1010' },
    'kasir_normal', BRANCH_CONFIG['1010']?.mode,
    BRANCH_CONFIG['1010']?.mode === 'kasir_normal'
  );

  testAssert(
    'TC-AUTH-002', 'Auth & PIN', 'PIN 1020 Disabled (Returns Undefined)',
    'Lookup BRANCH_CONFIG["1020"]', { pin: '1020' },
    'undefined', String(BRANCH_CONFIG['1020']),
    BRANCH_CONFIG['1020'] === undefined
  );

  testAssert(
    'TC-AUTH-003', 'Auth & PIN', 'PIN 2020 Disabled (Returns Undefined)',
    'Lookup BRANCH_CONFIG["2020"]', { pin: '2020' },
    'undefined', String(BRANCH_CONFIG['2020']),
    BRANCH_CONFIG['2020'] === undefined
  );

  testAssert(
    'TC-AUTH-004', 'Auth & PIN', 'PIN 8080 Disabled (Returns Undefined)',
    'Lookup BRANCH_CONFIG["8080"]', { pin: '8080' },
    'undefined', String(BRANCH_CONFIG['8080']),
    BRANCH_CONFIG['8080'] === undefined
  );

  testAssert(
    'TC-AUTH-005', 'Auth & PIN', 'Invalid PIN 9999 Returns Undefined',
    'Lookup BRANCH_CONFIG["9999"]', { pin: '9999' },
    'undefined', String(BRANCH_CONFIG['9999']),
    BRANCH_CONFIG['9999'] === undefined
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: PURE LOGIC & PARSING INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Logic & Parsing Integrity ---");
  const rupiahTest = formatRupiah(25000);
  testAssert(
    'TC-LOGIC-001', 'Pure Logic', 'Format Rupiah Formatting',
    'formatRupiah(25000)', { val: 25000 },
    'Rp. 25.000', rupiahTest,
    rupiahTest.includes('25.000') && rupiahTest.startsWith('Rp.')
  );

  const queueTest = formatQueue(12);
  testAssert(
    'TC-LOGIC-002', 'Pure Logic', 'Format Queue Number',
    'formatQueue(12)', { num: 12 },
    'A-012', queueTest,
    queueTest === 'A-012'
  );

  const cartKey1 = getCartKey('ayam', { type: 'MAKAN SINI', cabbage: 'Pake Kol', sambal: 'Biasa', note: 'pedas' });
  const cartKey2 = getCartKey('ayam', { type: 'MAKAN SINI', cabbage: 'Pake Kol', sambal: 'Biasa', note: 'pedas' });
  const cartKey3 = getCartKey('ayam', { type: 'BUNGKUS', cabbage: 'Pake Kol', sambal: 'Biasa', note: 'pedas' });

  testAssert(
    'TC-LOGIC-003', 'Cart Logic', 'Cart Key Uniqueness & Determinism',
    'Compare getCartKey results for identical vs different options',
    { cartKey1, cartKey2, cartKey3 },
    'Identical options match, different options differ',
    `k1==k2: ${cartKey1 === cartKey2}, k1!=k3: ${cartKey1 !== cartKey3}`,
    cartKey1 === cartKey2 && cartKey1 !== cartKey3
  );

  const complexStr = '[UNPAID] [A-005 (Ambil: Pagi)] ** MAKAN SINI **, ** PAKE KOL BIASA **, ** PAKE SEMUA **, 2x Ayam Goreng :: Paha, 1x Nasi Putih, ++ CATATAN: ekstra garing, ++ PAY:Cash|50000|11000';
  const parsedComp = parseItemsString(complexStr);
  testAssert(
    'TC-LOGIC-004', 'Parsing Logic', 'Parse Complex Transaction Item String',
    'parseItemsString(complexStr)', { complexStr },
    'OrderType: MAKAN SINI, Cabbage: PAKE KOL BIASA, PayMethod: Cash, PayGiven: 50000, Items: 2',
    `Type: ${parsedComp.orderType}, Cab: ${parsedComp.cabbageOpt}, Pay: ${parsedComp.payMethod}, Given: ${parsedComp.payGiven}, Count: ${parsedComp.realItems.length}`,
    parsedComp.orderType === 'MAKAN SINI' &&
    parsedComp.cabbageOpt === 'PAKE KOL BIASA' &&
    parsedComp.payMethod === 'Cash' &&
    parsedComp.payGiven === 50000 &&
    parsedComp.payChange === 11000 &&
    parsedComp.realItems.length === 2 &&
    parsedComp.note === 'ekstra garing'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: BACKEND API CONNECTIVITY & DATABASE FETCHING
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Backend API Connectivity & Data ---");
  let dbMenuMaster = [];
  let dbActivityLogs = [];
  let dbTransactions = [];

  try {
    const resMenu = await fetch(`${API_BASE}/menu?sheet=${encodeURIComponent(sheetName)}`);
    dbMenuMaster = await resMenu.json();
    testAssert(
      'TC-API-001', 'Backend API', 'Fetch Menu Master Endpoint',
      `GET /api/menu?sheet=${sheetName}`, {},
      'HTTP 200 and Non-empty array',
      `HTTP ${resMenu.status}, items: ${dbMenuMaster.length}`,
      resMenu.status === 200 && Array.isArray(dbMenuMaster) && dbMenuMaster.length > 0
    );
  } catch (err) {
    testAssert('TC-API-001', 'Backend API', 'Fetch Menu Master Endpoint', 'GET /api/menu', {}, 'HTTP 200', err.message, false);
  }

  try {
    const resLog = await fetch(`${API_BASE}/activities`);
    dbActivityLogs = await resLog.json();
    testAssert(
      'TC-API-002', 'Backend API', 'Fetch Activity Logs Endpoint',
      'GET /api/activities', {},
      'HTTP 200 and Array returned',
      `HTTP ${resLog.status}, items: ${dbActivityLogs.length}`,
      resLog.status === 200 && Array.isArray(dbActivityLogs)
    );
  } catch (err) {
    testAssert('TC-API-002', 'Backend API', 'Fetch Activity Logs Endpoint', 'GET /api/activities', {}, 'HTTP 200', err.message, false);
  }

  try {
    const resTx = await fetch(`${API_BASE}/transactions?sheet=${encodeURIComponent(sheetName)}&tanggal=${encodeURIComponent(todayStr)}`);
    dbTransactions = await resTx.json();
    testAssert(
      'TC-API-003', 'Backend API', 'Fetch Today Transactions Endpoint',
      `GET /api/transactions?sheet=${sheetName}&tanggal=${todayStr}`, {},
      'HTTP 200 and Array returned',
      `HTTP ${resTx.status}, items: ${dbTransactions.length}`,
      resTx.status === 200 && Array.isArray(dbTransactions)
    );
  } catch (err) {
    testAssert('TC-API-003', 'Backend API', 'Fetch Today Transactions Endpoint', 'GET /api/transactions', {}, 'HTTP 200', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: STOCK CALCULATION & AYAM GORENG SINGLE POOL STOCK
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Stock Calculation & Pool Logic ---");
  const baseMenuList = getBaseMenuList('pecel');
  const mockMaster = [
    { sheet: sheetName, menuId: 'lele', name: 'Lele Goreng', price: 15000, stock: 20 },
    { sheet: sheetName, menuId: 'ayam', name: 'Ayam Goreng', price: 17000, stock: 30 }
  ];

  // Test case 1: UNPAID order reduces stock immediately
  const mockTxsUnpaid = [
    {
      sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false,
      jenisPengeluaran: '[UNPAID] [A-001] ** MAKAN SINI **, 3x Lele Goreng, ++ PAY:Cash|45000|0'
    }
  ];
  const stockUnpaid = calculateLiveStock(mockTxsUnpaid, [], mockMaster, baseMenuList, todayStr, sheetName);
  testAssert(
    'TC-STK-001', 'Stock Logic', 'UNPAID Transaction Instantly Deducts Live Stock',
    'calculateLiveStock with 3x Lele Goreng in UNPAID transaction',
    { initialStock: 20, unpaidQty: 3 },
    'Remaining Lele stock = 17', `Calculated: ${stockUnpaid['lele']}`,
    stockUnpaid['lele'] === 17
  );

  // Test case 2: Single pool for Ayam Goreng (Paha, Dada, Paket Nasi Ayam)
  const mockTxsAyamVariants = [
    { sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false, jenisPengeluaran: '[A-001] ** MAKAN SINI **, 2x Ayam Goreng Paha, ++ PAY:Cash|34000|0' },
    { sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false, jenisPengeluaran: '[A-002] ** BUNGKUS **, 1x Ayam Goreng (Dada), ++ PAY:BCA|17000|0' },
    { sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false, jenisPengeluaran: '[A-003] ** MAKAN SINI **, 2x Paket Nasi Ayam, ++ PAY:QRIS|46000|0' },
  ];
  const stockAyam = calculateLiveStock(mockTxsAyamVariants, [], mockMaster, baseMenuList, todayStr, sheetName);
  // Total Ayam sold = 2 (Paha) + 1 (Dada) + 2 (Paket Nasi Ayam) = 5. Initial = 30 -> Sisa = 25.
  testAssert(
    'TC-STK-002', 'Stock Logic', 'Ayam Goreng Single Pool Deduction across Paha, Dada & Paketan',
    'Calculate live stock with 2x Paha, 1x Dada, 2x Paket Nasi Ayam',
    { initialStock: 30, soldPaha: 2, soldDada: 1, soldPaket: 2 },
    'Remaining Ayam stock = 25', `Calculated: ${stockAyam['ayam']}`,
    stockAyam['ayam'] === 25
  );

  // Test case 3: Bypass items (Nasi, Usus, Sambal) remain unlimited / available
  testAssert(
    'TC-STK-003', 'Stock Logic', 'Stock Bypass Items (nasi, usus, sambal)',
    'Check STOCK_BYPASS_IDS constant',
    {},
    'Includes nasi, usus, sambal',
    `STOCK_BYPASS_IDS: ${STOCK_BYPASS_IDS.join(', ')}`,
    STOCK_BYPASS_IDS.includes('nasi') && STOCK_BYPASS_IDS.includes('usus') && STOCK_BYPASS_IDS.includes('sambal')
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: QUEUE NUMBER CALCULATION
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Queue Numbering ---");
  const mockTxsQueue = [
    { jenisPengeluaran: '[A-001] ** MAKAN SINI **, 1x Lele', isDeleted: false, tanggal: todayStr },
    { jenisPengeluaran: '[A-004] ** BUNGKUS **, 1x Ayam', isDeleted: false, tanggal: todayStr },
    { jenisPengeluaran: '[A-002] ** LAPORAN SISTEM **', isDeleted: false, tanggal: todayStr } // Should skip system report
  ];
  const mockLocalOrdersQueue = [
    { queue: 'A-005 (Ambil: Pagi)' }
  ];

  const nextQueue = calculateNextQueueNumber(mockTxsQueue, mockLocalOrdersQueue, todayStr);
  testAssert(
    'TC-QUEUE-001', 'Queue Logic', 'Calculate Next Queue Number max(DB, local) + 1',
    'calculateNextQueueNumber with max queue A-005 in local orders',
    { maxInDb: 4, maxInLocal: 5 },
    'Next Queue = 6', `Calculated next queue: ${nextQueue}`,
    nextQueue === 6
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: END-TO-END TRANSACTION LIFECYCLE & PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: End-to-End Transaction Lifecycle & DB Verification ---");
  let testTxId = null;
  const testQueueNum = 888;
  const testQueueStr = formatQueue(testQueueNum);

  // Step A: POST New Paid Transaction
  try {
    const postPayload = [{
      sheet: sheetName,
      tanggal: todayStr,
      cash: 33000,
      bca: 0,
      gofood: 0,
      jenisPengeluaran: `[${testQueueStr} - User Test] ** MAKAN SINI **, ** PAKE KOL BIASA **, 1x Paket Nasi Lele, 1x Es Teh, ++ PAY:Cash|33000|0`,
      totalPengeluaran: 0
    }];

    const postRes = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });
    const postStatus = postRes.status;
    const postJson = await postRes.json();

    testTxId = postJson?.data?.[0]?._id || postJson?.data?._id;

    testAssert(
      'TC-E2E-001', 'E2E Transaction', 'POST New Paid Transaction to API',
      'POST /api/transactions', { payload: postPayload },
      'HTTP 201/200 and _id returned',
      `HTTP ${postStatus}, ID: ${testTxId}`,
      (postStatus === 201 || postStatus === 200) && Boolean(testTxId)
    );
  } catch (err) {
    testAssert('TC-E2E-001', 'E2E Transaction', 'POST New Paid Transaction to API', 'POST /api/transactions', {}, 'HTTP 200', err.message, false);
  }

  // Step B: Fetch DB & Cross-check persistence
  if (testTxId) {
    try {
      const getRes = await fetch(`${API_BASE}/transactions?sheet=${encodeURIComponent(sheetName)}&tanggal=${encodeURIComponent(todayStr)}`);
      const getTxs = await getRes.json();
      const matchedTx = getTxs.find(t => t._id === testTxId || (t.jenisPengeluaran && t.jenisPengeluaran.includes(testQueueStr)));

      testAssert(
        'TC-E2E-002', 'Persistence', 'Verify Transaction Persisted in Backend Database',
        'GET /api/transactions and match created _id',
        { testTxId, testQueueStr },
        'Transaction found in database array',
        matchedTx ? `Found _id: ${matchedTx._id}, cash: ${matchedTx.cash}` : 'Not found in DB',
        Boolean(matchedTx) && matchedTx.cash === 33000
      );
    } catch (err) {
      testAssert('TC-E2E-002', 'Persistence', 'Verify Transaction Persisted in Database', 'GET /api/transactions', {}, 'Transaction found', err.message, false);
    }
  }

  // Step C: POST Unpaid Transaction (Tapping Order)
  let unpaidTxId = null;
  const unpaidQueueNum = 889;
  const unpaidQueueStr = formatQueue(unpaidQueueNum);

  try {
    const unpaidPayload = [{
      sheet: sheetName,
      tanggal: todayStr,
      cash: 0,
      bca: 0,
      gofood: 0,
      jenisPengeluaran: `[UNPAID] [${unpaidQueueStr} - Customer Tapping] ** MAKAN SINI **, ** PAKE KOL BIASA **, 1x Lele Goreng, ++ PAY:Cash|15000|0`,
      totalPengeluaran: 0
    }];

    const unpaidRes = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unpaidPayload)
    });
    const unpaidJson = await unpaidRes.json();
    unpaidTxId = unpaidJson?.data?.[0]?._id || unpaidJson?.data?._id;

    testAssert(
      'TC-E2E-003', 'E2E Tapping', 'POST Unpaid Tapping Transaction to API',
      'POST /api/transactions with [UNPAID] prefix', { payload: unpaidPayload },
      'HTTP 200/201 and _id returned',
      `Status: ${unpaidRes.status}, ID: ${unpaidTxId}`,
      unpaidRes.ok && Boolean(unpaidTxId)
    );
  } catch (err) {
    testAssert('TC-E2E-003', 'E2E Tapping', 'POST Unpaid Tapping Transaction', 'POST /api/transactions', {}, 'HTTP 200', err.message, false);
  }

  // Step D: Mark Unpaid Transaction as Paid (Pelunasan / Mark as Paid)
  if (unpaidTxId) {
    try {
      const markPaidPayload = [{
        sheet: sheetName,
        tanggal: todayStr,
        cash: 15000,
        bca: 0,
        gofood: 0,
        jenisPengeluaran: `[${unpaidQueueStr} - Customer Tapping] ** MAKAN SINI **, ** PAKE KOL BIASA **, 1x Lele Goreng, ++ PAY:Cash|15000|0`,
        totalPengeluaran: 0,
        overrideDbId: unpaidTxId
      }];

      const markRes = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markPaidPayload)
      });
      const markJson = await markRes.json();

      // Short delay for serverless DB write completion
      await new Promise(r => setTimeout(r, 800));

      // Fetch today transactions to verify [UNPAID] prefix was stripped and cash updated to 15000
      const checkRes = await fetch(`${API_BASE}/transactions?sheet=${encodeURIComponent(sheetName)}&tanggal=${encodeURIComponent(todayStr)}`);
      const checkTxs = await checkRes.json();
      const updatedTx = checkTxs.find(t => String(t._id) === String(unpaidTxId));

      testAssert(
        'TC-E2E-004', 'E2E Tapping', 'Mark Tapping Order as Paid (Override DB Record)',
        'POST /api/transactions with overrideDbId',
        { overrideDbId: unpaidTxId, newCash: 15000 },
        'Transaction updated: no [UNPAID] tag, cash = 15000',
        updatedTx ? `jenisPengeluaran: "${updatedTx.jenisPengeluaran}", cash: ${updatedTx.cash}` : 'Not found',
        Boolean(updatedTx) && !updatedTx.jenisPengeluaran.includes('[UNPAID]') && updatedTx.cash === 15000
      );
    } catch (err) {
      testAssert('TC-E2E-004', 'E2E Tapping', 'Mark Tapping Order as Paid', 'POST /api/transactions override', {}, 'Updated', err.message, false);
    }
  }

  // Step E: Clean up test transactions (Hard Delete)
  for (const idToDelete of [testTxId, unpaidTxId].filter(Boolean)) {
    try {
      const delRes = await fetch(`${API_BASE}/transactions/hard/${idToDelete}`, { method: 'DELETE' });
      testAssert(
        `TC-E2E-DEL-${idToDelete.slice(-4)}`, 'Cleanup', `Hard Delete Test Tx (${idToDelete.slice(-6)})`,
        `DELETE /api/transactions/hard/${idToDelete}`, { id: idToDelete },
        'HTTP 200 Success', `HTTP ${delRes.status}`,
        delRes.status === 200
      );
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 7: PRODUCT EDIT (PUT /api/menu) & VALIDATION TESTS
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 7: Product Edit Master API & Validation ---");
  const targetMenuId = 'lele';
  const originalLele = dbMenuMaster.find(m => m.menuId === targetMenuId) || { name: 'Lele Goreng', price: 15000, stock: 20 };
  const tempPrice = originalLele.price + 1000;
  const tempStock = (originalLele.stock || 0) + 10;

  // Step A: PUT Valid Update
  try {
    const putPayload = {
      sheet: sheetName,
      menuId: targetMenuId,
      name: originalLele.name,
      price: tempPrice,
      stock: tempStock,
      currentLiveStock: originalLele.stock,
      isPaketan: false
    };

    const putRes = await fetch(`${API_BASE}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(putPayload)
    });
    const putJson = await putRes.json();

    testAssert(
      'TC-PED-001', 'Product Edit API', 'PUT Update Menu Price & Stock in DB',
      'PUT /api/menu', { payload: putPayload },
      `HTTP 200, price = ${tempPrice}, stock = ${tempStock}`,
      `HTTP ${putRes.status}, DB price: ${putJson?.data?.price}, stock: ${putJson?.data?.stock}`,
      putRes.status === 200 && putJson?.data?.price === tempPrice && putJson?.data?.stock === tempStock
    );

    // Revert back to original values
    const revertPayload = {
      sheet: sheetName,
      menuId: targetMenuId,
      name: originalLele.name,
      price: originalLele.price,
      stock: originalLele.stock || 20,
      currentLiveStock: tempStock,
      isPaketan: false
    };

    const revertRes = await fetch(`${API_BASE}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revertPayload)
    });

    testAssert(
      'TC-PED-002', 'Product Edit API', 'Revert Menu Master Price & Stock to Original',
      'PUT /api/menu revert', { payload: revertPayload },
      'HTTP 200 Success', `HTTP ${revertRes.status}`,
      revertRes.status === 200
    );

  } catch (err) {
    testAssert('TC-PED-001', 'Product Edit API', 'PUT Update Menu', 'PUT /api/menu', {}, 'HTTP 200', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // SECTION 8: EDGE CASES & ERROR HANDLING
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 8: Edge Cases & Error Handling ---");

  // Edge case 1: Malformed item string parsing
  const malformedStr = "RANDOM INVALID STRING WITHOUT FORMAT";
  const parsedMalformed = parseItemsString(malformedStr);
  testAssert(
    'TC-EDGE-001', 'Edge Case', 'Parse Malformed Item String Safely without Crash',
    'parseItemsString(malformedStr)', { malformedStr },
    'No exception, empty orderType and 1 item',
    `orderType: "${parsedMalformed.orderType}", realItems: ${parsedMalformed.realItems.length}`,
    parsedMalformed.orderType === '' && parsedMalformed.realItems.length === 1
  );

  // Edge case 2: Empty transactions array in calculateLiveStock
  const emptyStock = calculateLiveStock([], [], [], baseMenuList, todayStr, sheetName);
  testAssert(
    'TC-EDGE-002', 'Edge Case', 'calculateLiveStock with Empty Raw Data',
    'calculateLiveStock([], [], [], baseMenuList, todayStr, sheetName)', {},
    'Returns object with 0 stock for all items',
    `lele stock: ${emptyStock['lele']}`,
    emptyStock['lele'] === 0
  );

  // Edge case 3: Invalid HTTP request to backend (404 route)
  try {
    const res404 = await fetch(`${API_BASE}/non_existent_route`);
    testAssert(
      'TC-EDGE-003', 'Error Handling', 'API Server 404 Handling for Invalid Endpoints',
      'GET /api/non_existent_route', {},
      'HTTP 404', `HTTP ${res404.status}`,
      res404.status === 404
    );
  } catch (err) {
    testAssert('TC-EDGE-003', 'Error Handling', 'API Server 404 Handling', 'GET /api/non_existent_route', {}, 'HTTP 404', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("VERIFICATION SUITE COMPLETED");
  const total = testResults.length;
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const failCount = testResults.filter(r => r.status === 'FAIL').length;

  console.log(`TOTAL TEST CASES PROCESSED: ${total}`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log("=================================================================\n");

  return testResults;
}

runFullVerificationSuite().catch(console.error);
