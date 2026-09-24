// =============================================================================
// COMPREHENSIVE END-TO-END DATA & API TEST SUITE
// =============================================================================

import {
  formatRupiah, formatQueue, getTodayStr, getBaseMenuList,
  getCartKey, calculateLiveStock, buildActiveMenuList,
  calculateNextQueueNumber, parseItemsString
} from './src/shared/utils.js';

import { MENU_PLCI, STOCK_BYPASS_IDS } from './src/shared/constants.js';

const API_BASE = "https://wdd-plci-backend-2.vercel.app/api";

const results = [];

function recordTest(id, category, description, action, input, expected, actual, pass, evidence = null) {
  const result = {
    id, category, description, action, input, expected, actual,
    status: pass ? 'PASS' : 'FAIL',
    evidence: evidence || null
  };
  results.push(result);
  console.log(`[${result.status}] ${id}: ${description}`);
  if (!pass) {
    console.error(`   FAIL DETAILS: Expected "${expected}", got "${actual}"`);
  }
}

async function runAllTests() {
  console.log("=== STARTING FULL END-TO-END SYSTEM TEST SUITE ===");
  const todayStr = getTodayStr();
  const sheetName = "PLCI Kantin SMB";

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: UTILS & LOGIC INTEGRITY
  // ---------------------------------------------------------------------------
  try {
    const rupiahVal = formatRupiah(15000);
    recordTest(
      'TC-UT-001', 'Pure Logic', 'Format Rupiah Standard',
      'Call formatRupiah(15000)', { input: 15000 },
      'Rp. 15.000', rupiahVal,
      rupiahVal.includes('15.000')
    );

    const qVal = formatQueue(5);
    recordTest(
      'TC-UT-002', 'Pure Logic', 'Format Queue Number',
      'Call formatQueue(5)', { input: 5 },
      'A-005', qVal,
      qVal === 'A-005'
    );

    const parsed = parseItemsString('[UNPAID] [A-001] ** MAKAN SINI **, ** PAKE KOL BIASA **, 2x Lele Goreng, ++ PAY:Cash|30000|0');
    recordTest(
      'TC-UT-003', 'Parsing Logic', 'Parse Complex Transaction String',
      'Call parseItemsString with UNPAID item string',
      { str: '[UNPAID] ... 2x Lele Goreng' },
      'OrderType: MAKAN SINI, payMethod: Cash, 1 realItem',
      `OrderType: ${parsed.orderType}, Pay: ${parsed.payMethod}, Items: ${parsed.realItems.length}`,
      parsed.orderType === 'MAKAN SINI' && parsed.payMethod === 'Cash' && parsed.realItems.length === 1
    );
  } catch (err) {
    recordTest('TC-UT-ERR', 'Pure Logic', 'Utils test error', 'Execute utils', {}, 'No Exception', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: BACKEND API CONNECTIVITY & DATA STRUCTURES
  // ---------------------------------------------------------------------------
  let initialMaster = [];
  let initialLogs = [];
  let initialTxs = [];

  try {
    const resMenu = await fetch(`${API_BASE}/menu?sheet=${encodeURIComponent(sheetName)}`);
    const statusMenu = resMenu.status;
    initialMaster = await resMenu.json();

    recordTest(
      'TC-API-001', 'Backend API', 'Fetch Menu Master',
      `GET /api/menu?sheet=${sheetName}`,
      { sheet: sheetName },
      'HTTP 200 and Array returned',
      `HTTP ${statusMenu}, Array length: ${Array.isArray(initialMaster) ? initialMaster.length : 'not array'}`,
      statusMenu === 200 && Array.isArray(initialMaster)
    );
  } catch (e) {
    recordTest('TC-API-001', 'Backend API', 'Fetch Menu Master', 'GET /api/menu', {}, 'HTTP 200', e.message, false);
  }

  try {
    const resLog = await fetch(`${API_BASE}/activities`);
    initialLogs = await resLog.json();
    recordTest(
      'TC-API-002', 'Backend API', 'Fetch Activity Logs',
      'GET /api/activities', {},
      'HTTP 200 and Array returned',
      `Array length: ${Array.isArray(initialLogs) ? initialLogs.length : 'not array'}`,
      Array.isArray(initialLogs)
    );
  } catch (e) {
    recordTest('TC-API-002', 'Backend API', 'Fetch Activity Logs', 'GET /api/activities', {}, 'HTTP 200', e.message, false);
  }

  try {
    const resTx = await fetch(`${API_BASE}/transactions?sheet=${encodeURIComponent(sheetName)}&tanggal=${encodeURIComponent(todayStr)}`);
    initialTxs = await resTx.json();
    recordTest(
      'TC-API-003', 'Backend API', 'Fetch Today Transactions',
      `GET /api/transactions?sheet=${sheetName}&tanggal=${todayStr}`, {},
      'HTTP 200 and Array returned',
      `Array length: ${Array.isArray(initialTxs) ? initialTxs.length : 'not array'}`,
      Array.isArray(initialTxs)
    );
  } catch (e) {
    recordTest('TC-API-003', 'Backend API', 'Fetch Today Transactions', 'GET /api/transactions', {}, 'HTTP 200', e.message, false);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: STOCK CALCULATION & AYAM GORENG SINGLE STOCK LOGIC
  // ---------------------------------------------------------------------------
  try {
    const baseMenus = getBaseMenuList('pecel');
    
    // Create mock transactions with UNPAID, Paha, Dada, and Fast Kasir items
    const mockTxs = [
      {
        sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false,
        jenisPengeluaran: '[UNPAID] [A-001 (Ambil: Bebas)] ** MAKAN SINI **, ** PAKE KOL BIASA **, 2x Lele Goreng, ++ PAY:Cash|30000|0'
      },
      {
        sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false,
        jenisPengeluaran: '[A-002] ** MAKAN SINI **, 1x Ayam Goreng Paha, ++ PAY:Cash|17000|0'
      },
      {
        sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false,
        jenisPengeluaran: '[A-003] ** BUNGKUS **, 1x Ayam Goreng (Dada), ++ PAY:BCA|17000|0'
      },
      {
        sheet: sheetName, tanggal: todayStr, totalPengeluaran: 0, isDeleted: false,
        jenisPengeluaran: '[A-004] ** MAKAN SINI **, 1x Paket Nasi Ayam, ++ PAY:QRIS|23000|0'
      }
    ];

    const mockMaster = [
      { sheet: sheetName, menuId: 'lele', name: 'Lele Goreng', price: 15000, stock: 20 },
      { sheet: sheetName, menuId: 'ayam', name: 'Ayam Goreng', price: 17000, stock: 30 }
    ];

    const calculated = calculateLiveStock(mockTxs, [], mockMaster, baseMenus, todayStr, sheetName);

    // Expected:
    // Lele: initial 20 - 2 (from UNPAID order A-001) = 18
    // Ayam: initial 30 - 1 (Ayam Paha) - 1 (Ayam Dada) - 1 (Paket Nasi Ayam) = 27
    recordTest(
      'TC-STK-001', 'Stock Logic', 'UNPAID Transaction Stock Deduction',
      'Calculate live stock with 2x Lele in UNPAID order',
      { initialStock: 20, qtySold: 2 },
      'Remaining Lele stock = 18', `Remaining Lele stock = ${calculated['lele']}`,
      calculated['lele'] === 18
    );

    recordTest(
      'TC-STK-002', 'Stock Logic', 'Single System Stock for Ayam Goreng (Paha + Dada + Paketan)',
      'Calculate live stock with 1x Paha, 1x Dada, 1x Paket Nasi Ayam',
      { initialStock: 30, soldPaha: 1, soldDada: 1, soldPaket: 1 },
      'Remaining Ayam stock = 27', `Remaining Ayam stock = ${calculated['ayam']}`,
      calculated['ayam'] === 27
    );

  } catch (err) {
    recordTest('TC-STK-ERR', 'Stock Logic', 'Stock Calculation Error', 'Run calculateLiveStock', {}, 'No Exception', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: END-TO-END TRANSACTION CREATE & DB PERSISTENCE
  // ---------------------------------------------------------------------------
  try {
    const testQueueNum = 999;
    const testQueueStr = formatQueue(testQueueNum);
    const testTxPayload = [{
      sheet: sheetName,
      tanggal: todayStr,
      cash: 18000,
      bca: 0,
      gofood: 0,
      jenisPengeluaran: `[${testQueueStr}] ** MAKAN SINI **, ** PAKE KOL BIASA **, 1x Paket Nasi Lele, ++ PAY:Cash|18000|0`,
      totalPengeluaran: 0
    }];

    // 1. Post transaction
    const postRes = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTxPayload)
    });

    const postStatus = postRes.status;
    const postJson = await postRes.json();

    const createdTxId = postJson?.data?.[0]?._id || postJson?.data?._id;

    recordTest(
      'TC-E2E-001', 'End-to-End Tx', 'POST New Transaction to Server API',
      'POST /api/transactions', { payload: testTxPayload },
      'HTTP 201 Created and _id generated',
      `HTTP ${postStatus}, ID: ${createdTxId}`,
      (postStatus === 201 || postStatus === 200) && Boolean(createdTxId)
    );

    // 2. Fetch today transactions and verify persistence
    const fetchRes = await fetch(`${API_BASE}/transactions?sheet=${encodeURIComponent(sheetName)}&tanggal=${encodeURIComponent(todayStr)}`);
    const todayTxs = await fetchRes.json();
    const foundTx = Array.isArray(todayTxs) && todayTxs.find(t => t._id === createdTxId || (t.jenisPengeluaran && t.jenisPengeluaran.includes(testQueueStr)));

    recordTest(
      'TC-E2E-002', 'Persistence', 'Verify Transaction Persisted in Database',
      'GET /api/transactions and match created ID/Queue',
      { searchedId: createdTxId, queue: testQueueStr },
      'Transaction found in database response',
      foundTx ? `Found Tx ID: ${foundTx._id}` : 'Not found in DB',
      Boolean(foundTx)
    );

    // 3. Clean up test transaction from DB
    if (foundTx && foundTx._id) {
      const delRes = await fetch(`${API_BASE}/transactions/hard/${foundTx._id}`, { method: 'DELETE' });
      const delStatus = delRes.status;
      recordTest(
        'TC-E2E-003', 'Cleanup', 'Hard Delete Test Transaction',
        `DELETE /api/transactions/hard/${foundTx._id}`, { id: foundTx._id },
        'HTTP 200 Success', `HTTP ${delStatus}`,
        delStatus === 200
      );
    }

  } catch (err) {
    recordTest('TC-E2E-ERR', 'End-to-End Tx', 'E2E Transaction Error', 'POST / DELETE tx', {}, 'No Exception', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: PRODUCT EDIT API & ACTIVITY LOG CREATION
  // ---------------------------------------------------------------------------
  try {
    const testMenuId = 'lele';
    const originalItem = initialMaster.find(m => m.menuId === testMenuId) || { price: 15000, stock: 20, name: 'Lele Goreng' };
    const tempStockVal = (originalItem.stock || 0) + 5;

    const putPayload = {
      sheet: sheetName,
      menuId: testMenuId,
      name: originalItem.name,
      price: originalItem.price,
      stock: tempStockVal,
      currentLiveStock: originalItem.stock,
      isPaketan: false
    };

    const putRes = await fetch(`${API_BASE}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(putPayload)
    });

    const putStatus = putRes.status;
    const putJson = await putRes.json();

    recordTest(
      'TC-PED-001', 'Product Edit API', 'PUT Menu Master Stock Update',
      'PUT /api/menu', { payload: putPayload },
      'HTTP 200 Success & stock updated in DB',
      `HTTP ${putStatus}, DB stock: ${putJson?.data?.stock}`,
      putStatus === 200 && putJson?.data?.stock === tempStockVal
    );

    // Revert stock back to original
    const revertPayload = {
      sheet: sheetName,
      menuId: testMenuId,
      name: originalItem.name,
      price: originalItem.price,
      stock: originalItem.stock || 20,
      currentLiveStock: tempStockVal,
      isPaketan: false
    };

    const revertRes = await fetch(`${API_BASE}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revertPayload)
    });

    recordTest(
      'TC-PED-002', 'Product Edit API', 'Revert Menu Master Stock',
      'PUT /api/menu revert', { payload: revertPayload },
      'HTTP 200 Success', `HTTP ${revertRes.status}`,
      revertRes.status === 200
    );

  } catch (err) {
    recordTest('TC-PED-ERR', 'Product Edit API', 'Product Edit Test Error', 'PUT /api/menu', {}, 'No Exception', err.message, false);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT GENERATION
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("TEST SUITE EXECUTION SUMMARY:");
  const total = results.length;
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`TOTAL TEST CASES: ${total}`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log("==================================================\n");

  return results;
}

runAllTests().catch(console.error);
