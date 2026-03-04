# CWMoney .iDB 匯出功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓 MoneyMan 能將資料匯出為 CWMoney .iDB（SQLite）檔案，支援編輯回寫和全新匯出兩種模式。

**Architecture:** IndexedDB 升級到 v4，新增 `cwmoney_meta` store 儲存原始 .iDB 和映射表。匯入時保存 `cwId` 追蹤 CWMoney 紀錄 ID。匯出引擎使用 sql.js 修改/建立 SQLite 資料庫，透過 Blob 下載或 Google Drive 上傳。

**Tech Stack:** Vue 3 + Pinia, IndexedDB (idb), sql.js, Google Drive API

**Design doc:** `docs/plans/2026-03-01-cwmoney-export-design.md`

---

### Task 1: DB v4 升級 — cwmoney_meta store + cwId index

**Files:**
- Modify: `src/services/db.js:1-58`
- Test: `src/__tests__/services/db.test.js`

**Step 1: Write failing tests for v4 schema**

在 `src/__tests__/services/db.test.js` 末尾新增：

```js
describe('db v4 schema', () => {
  beforeEach(async () => {
    resetDB()
  })

  it('has cwmoney_meta object store', async () => {
    const db = await initDB()
    expect(db.objectStoreNames.contains('cwmoney_meta')).toBe(true)
  })

  it('cwmoney_meta store uses key as keyPath', async () => {
    const db = await initDB()
    const tx = db.transaction('cwmoney_meta', 'readwrite')
    const store = tx.objectStore('cwmoney_meta')
    await store.put({ key: 'test_key', value: 'hello' })
    await tx.done

    const result = await db.get('cwmoney_meta', 'test_key')
    expect(result.value).toBe('hello')
  })

  it('transactions store has cwId index', async () => {
    const db = await initDB()
    const txStore = db.transaction('transactions', 'readonly').objectStore('transactions')
    expect(txStore.indexNames.contains('cwId')).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: 3 FAIL — `cwmoney_meta` store not found, `cwId` index not found

**Step 3: Implement v4 upgrade in db.js**

在 `src/services/db.js` 中：

1. 將 `DB_VERSION` 改為 `4`
2. 在 `upgrade` 函數的 `oldVersion < 1` 分支加入建立 `cwmoney_meta` store 和 `cwId` index
3. 新增 `oldVersion < 4` 升級分支

```js
const DB_VERSION = 4

// 在 oldVersion < 1 分支中加入：
const cwMetaStore = db.createObjectStore('cwmoney_meta', { keyPath: 'key' })
// 在建立 txStore 後加入：
txStore.createIndex('cwId', 'cwId')

// 新增升級分支：
if (oldVersion >= 1 && oldVersion < 4) {
  if (!db.objectStoreNames.contains('cwmoney_meta')) {
    db.createObjectStore('cwmoney_meta', { keyPath: 'key' })
  }
  const txStore = transaction.objectStore('transactions')
  if (!txStore.indexNames.contains('cwId')) {
    txStore.createIndex('cwId', 'cwId')
  }
}
```

**Step 4: Update bulkRestore to include cwmoney_meta**

在 `bulkRestore` 中，transaction 加入 `cwmoney_meta`：

```js
export async function bulkRestore(data) {
  const db = await initDB()
  const storeNames = ['transactions', 'cards', 'categories', 'templates', 'cwmoney_meta']
  const tx = db.transaction(storeNames, 'readwrite')
  await tx.objectStore('transactions').clear()
  await tx.objectStore('cards').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('templates').clear()
  await tx.objectStore('cwmoney_meta').clear()
  for (const item of data.transactions || []) await tx.objectStore('transactions').put(item)
  for (const card of data.cards || []) await tx.objectStore('cards').put(card)
  for (const cat of data.categories || []) await tx.objectStore('categories').put(cat)
  for (const tpl of data.templates || []) await tx.objectStore('templates').put(tpl)
  for (const meta of data.cwmoney_meta || []) await tx.objectStore('cwmoney_meta').put(meta)
  await tx.done
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/services/db.js src/__tests__/services/db.test.js
git commit -m "feat: upgrade IndexedDB to v4 with cwmoney_meta store and cwId index"
```

---

### Task 2: cwmoney-parser 加入 cwId 回傳

**Files:**
- Modify: `src/services/cwmoney-parser.js:47-61`
- Test: `src/__tests__/services/cwmoney-parser.test.js`

**Step 1: Update existing test expectation**

在 `src/__tests__/services/cwmoney-parser.test.js` 的 `parseRecords` → `converts rec_table rows to MoneyMan format` test 中加入：

```js
expect(records[0].cwId).toBe(1)
```

在 `handles income type correctly` test 中加入：

```js
expect(records[0].cwId).toBe(2)
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/cwmoney-parser.test.js`
Expected: 2 FAIL — `cwId` is undefined

**Step 3: Add cwId to mapRow**

在 `src/services/cwmoney-parser.js` 的 `mapRow` 函數中加入 `cwId`：

```js
function mapRow(row, accounts) {
  return {
    cwId: parseInt(row[0]),
    amount: parseFloat(row[1]),
    type: String(row[7]) === '2' ? 'income' : 'expense',
    date: timestampToDate(row[2]),
    note: row[6] || '',
    account: accounts[parseInt(row[5])] || null,
    cwKind: parseInt(row[3]),
    cwKinds: parseInt(row[4]),
    channel: null,
    cardId: null
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/cwmoney-parser.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/cwmoney-parser.js src/__tests__/services/cwmoney-parser.test.js
git commit -m "feat: include cwId (CWMoney _id) in parsed records"
```

---

### Task 3: ImportCWMoney 儲存 cwId + 原始 .iDB + 映射表

**Files:**
- Modify: `src/components/ImportCWMoney.vue:254-288` (doImport function)
- Modify: `src/services/db.js` (新增 helper functions)

**Step 1: Add db.js helper functions for cwmoney_meta**

在 `src/services/db.js` 末尾新增：

```js
export async function setCWMoneyMeta(key, value) {
  const db = await initDB()
  await db.put('cwmoney_meta', { key, value })
}

export async function getCWMoneyMeta(key) {
  const db = await initDB()
  const result = await db.get('cwmoney_meta', key)
  return result ? result.value : null
}
```

**Step 2: Write test for helper functions**

在 `src/__tests__/services/db.test.js` 新增，先 import `setCWMoneyMeta` 和 `getCWMoneyMeta`：

```js
describe('cwmoney_meta helpers', () => {
  beforeEach(async () => {
    resetDB()
    const db = await initDB()
    const tx = db.transaction('cwmoney_meta', 'readwrite')
    await tx.objectStore('cwmoney_meta').clear()
    await tx.done
  })

  it('sets and gets cwmoney meta', async () => {
    await setCWMoneyMeta('test_key', { foo: 'bar' })
    const result = await getCWMoneyMeta('test_key')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('returns null for missing key', async () => {
    const result = await getCWMoneyMeta('nonexistent')
    expect(result).toBeNull()
  })

  it('overwrites existing key', async () => {
    await setCWMoneyMeta('key1', 'old')
    await setCWMoneyMeta('key1', 'new')
    expect(await getCWMoneyMeta('key1')).toBe('new')
  })
})
```

**Step 3: Run tests, verify pass**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: ALL PASS

**Step 4: Update ImportCWMoney.vue**

修改 `onFileSelect` 函數——在開啟 .iDB 後，保存原始二進位：

```js
import { setCWMoneyMeta } from '../services/db.js'

// 在 onFileSelect 中，sqliteDb 建立後：
const fileBuffer = await file.arrayBuffer()
const originalIdbBytes = new Uint8Array(fileBuffer)
// (用另一份 copy 開 sqliteDb，因為 sql.js 會 consume buffer)

// 儲存原始檔名供匯出時使用
let originalFileName = ''
```

修改 `onFileSelect`：

```js
async function onFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  error.value = ''
  loading.value = true
  try {
    originalFileName = file.name
    const fileBuffer = await file.arrayBuffer()
    originalIdbBytes = new Uint8Array(fileBuffer.slice(0))
    sqliteDb = await openIDB(file)
    cwCategories = parseCategories(sqliteDb)
    cwAccounts = parseAccounts(sqliteDb)
    buildCategoryLookup()

    const range = parseDateRange(sqliteDb)
    dateRange.value = range
    startDate.value = range.min
    endDate.value = range.max
    rangeCount.value = range.count

    step.value = 'range'
  } catch (err) {
    error.value = '檔案解析失敗：' + err.message
  } finally {
    loading.value = false
  }
}
```

修改 `doImport` 函數——加入 `cwId`，匯入完成後儲存 meta：

```js
// 在 records loop 中，加入 cwId:
await txStore.addTransaction({
  amount: r.amount, type: r.type, category: parentCatId, subcategory: subCatId,
  channel: null, cardId: null, date: r.date, note: r.note, account: r.account,
  cwId: r.cwId
})

// 在 doImport 最後（step.value = 'done' 之前），儲存 meta:
await setCWMoneyMeta('original_idb', originalIdbBytes)
await setCWMoneyMeta('category_mapping', catMapping)
await setCWMoneyMeta('account_mapping', cwAccounts)
await setCWMoneyMeta('import_info', {
  importedAt: new Date().toISOString(),
  fileName: originalFileName,
  dateRange: { start: startDate.value, end: endDate.value },
  originalRecordCount: records.length
})
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS（ImportCWMoney 無直接 unit test，但確認無破壞）

**Step 6: Commit**

```bash
git add src/services/db.js src/__tests__/services/db.test.js src/components/ImportCWMoney.vue
git commit -m "feat: store cwId, original .iDB and mappings on CWMoney import"
```

---

### Task 4: cwmoney-exporter 核心引擎 — 編輯回寫模式

**Files:**
- Create: `src/services/cwmoney-exporter.js`
- Create: `src/__tests__/services/cwmoney-exporter.test.js`

**Step 1: Write failing tests for buildExportDB (edit-writeback mode)**

建立 `src/__tests__/services/cwmoney-exporter.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { buildExportDB, computeChangeSummary } from '../../services/cwmoney-exporter.js'

// Helper: create a minimal CWMoney SQLite database using sql.js
async function createMockCWMoneyDB() {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`CREATE TABLE rec_table (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER,
    i_account INTEGER, i_remark TEXT, i_type TEXT
  )`)
  db.run(`CREATE TABLE kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`)

  // Insert sample data
  db.run(`INSERT INTO kind_table VALUES (1, '食物飲品', 'k1', 0)`)
  db.run(`INSERT INTO kinds_table VALUES (1, 1, '早餐', 'k1', 0), (2, 1, '午餐', 'k1', 1)`)
  db.run(`INSERT INTO acc_table VALUES (1, '現金', 'm1', 0)`)

  // 1706745600 = 2024-02-01 UTC
  db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type)
          VALUES (100, 1706745600, 1, 1, 1, '早餐便利商店', '1')`)
  db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type)
          VALUES (150, 1706745600, 1, 2, 1, '午餐便當', '1')`)

  return { db, bytes: db.export() }
}

describe('cwmoney-exporter', () => {
  describe('computeChangeSummary', () => {
    it('counts updated, inserted, and deleted records', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      // MoneyMan transactions: cwId=1 updated, cwId=2 deleted (missing), cwId=null is new
      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: '改過的早餐', category: 10, subcategory: 20, account: '現金' },
        { id: 3, cwId: null, amount: 50, type: 'expense', date: '2024-02-02', note: '新紀錄', category: 10, subcategory: 20, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const summary = await computeChangeSummary(originalIdb, transactions, categoryMapping, accountMapping)
      expect(summary.updated).toBe(1)
      expect(summary.inserted).toBe(1)
      expect(summary.deleted).toBe(1)
    })
  })

  describe('buildExportDB', () => {
    it('updates existing records in the .iDB', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: '改過的早餐', category: 10, subcategory: 20, account: '現金' },
        { id: 2, cwId: 2, amount: 150, type: 'expense', date: '2024-02-01', note: '午餐便當', category: 10, subcategory: 21, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      // Verify by reading the result
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT _id, i_money, i_remark FROM rec_table ORDER BY _id')
      expect(rows[0].values).toHaveLength(2)
      expect(rows[0].values[0][1]).toBe(200)       // updated amount
      expect(rows[0].values[0][2]).toBe('改過的早餐') // updated note
      resultDb.close()
    })

    it('deletes records not present in MoneyMan', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      // Only cwId=1 remains, cwId=2 was deleted in MoneyMan
      const transactions = [
        { id: 1, cwId: 1, amount: 100, type: 'expense', date: '2024-02-01', note: '早餐便利商店', category: 10, subcategory: 20, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT COUNT(*) FROM rec_table')
      expect(rows[0].values[0][0]).toBe(1)
      resultDb.close()
    })

    it('inserts new records (no cwId)', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      const transactions = [
        { id: 1, cwId: 1, amount: 100, type: 'expense', date: '2024-02-01', note: '早餐便利商店', category: 10, subcategory: 20, account: '現金' },
        { id: 2, cwId: 2, amount: 150, type: 'expense', date: '2024-02-01', note: '午餐便當', category: 10, subcategory: 21, account: '現金' },
        { id: 3, cwId: null, amount: 50, type: 'income', date: '2024-02-02', note: '新收入', category: 30, subcategory: null, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT COUNT(*) FROM rec_table')
      expect(rows[0].values[0][0]).toBe(3)

      const newRow = resultDb.exec("SELECT i_money, i_remark, i_type FROM rec_table WHERE i_remark = '新收入'")
      expect(newRow[0].values[0][0]).toBe(50)
      expect(newRow[0].values[0][2]).toBe('2')  // income
      resultDb.close()
    })

    it('preserves unknown tables and columns', async () => {
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const db = new SQL.Database()

      // Create standard tables + an unknown table
      db.run(`CREATE TABLE rec_table (_id INTEGER PRIMARY KEY AUTOINCREMENT, i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER, i_account INTEGER, i_remark TEXT, i_type TEXT, i_photo TEXT)`)
      db.run(`CREATE TABLE kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`)
      db.run(`CREATE TABLE budget_table (_id INTEGER PRIMARY KEY, amount REAL)`)

      db.run(`INSERT INTO kind_table VALUES (1, '食物', 'k1', 0)`)
      db.run(`INSERT INTO acc_table VALUES (1, '現金', 'm1', 0)`)
      db.run(`INSERT INTO budget_table VALUES (1, 5000)`)
      db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type, i_photo) VALUES (100, 1706745600, 1, 0, 1, 'test', '1', 'photo.jpg')`)

      const originalIdb = new Uint8Array(db.export())
      db.close()

      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: 'updated', category: 10, subcategory: null, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const resultDb = new SQL.Database(resultBytes)

      // budget_table should still exist
      const budget = resultDb.exec('SELECT * FROM budget_table')
      expect(budget[0].values[0][1]).toBe(5000)

      // i_photo column should be preserved
      const rec = resultDb.exec('SELECT i_photo FROM rec_table WHERE _id = 1')
      expect(rec[0].values[0][0]).toBe('photo.jpg')

      resultDb.close()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/cwmoney-exporter.test.js`
Expected: FAIL — module not found

**Step 3: Implement cwmoney-exporter.js**

建立 `src/services/cwmoney-exporter.js`：

```js
/**
 * CWMoney .iDB (SQLite) Export Service
 *
 * Exports MoneyMan data back to CWMoney .iDB format.
 * Two modes:
 *   - Edit-writeback: modify an existing .iDB (UPDATE/DELETE/INSERT)
 *   - Fresh export: create a new .iDB from scratch
 */

import { loadSqlJs } from './cwmoney-parser.js'

/**
 * Convert 'YYYY-MM-DD' to Unix timestamp (seconds) at UTC midnight.
 */
function dateToTimestamp(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000)
}

/**
 * Reverse a category mapping: { cwKey: moneyManId } → { moneyManId: cwNumericId }
 * e.g. { 'expense_parent_3': 12 } → { 12: 3 } for parents
 * e.g. { 'expense_child_5': 20 } → { 20: 5 } for children
 */
function reverseCategoryMapping(mapping) {
  const parentReverse = {}   // moneyManId → cwId (for parent categories)
  const childReverse = {}    // moneyManId → cwId (for child categories)

  for (const [cwKey, mmId] of Object.entries(mapping)) {
    if (typeof mmId !== 'number') continue
    const parts = cwKey.match(/^(expense|income)_(parent|child)_(\d+)$/)
    if (!parts) continue
    const cwId = parseInt(parts[3])
    if (parts[2] === 'parent') {
      parentReverse[mmId] = cwId
    } else {
      childReverse[mmId] = cwId
    }
  }

  return { parentReverse, childReverse }
}

/**
 * Reverse an account mapping: { cwAccId: name } → { name: cwAccId }
 */
function reverseAccountMapping(accountMapping) {
  const reverse = {}
  for (const [cwId, name] of Object.entries(accountMapping)) {
    reverse[name] = parseInt(cwId)
  }
  return reverse
}

/**
 * Compute a summary of changes between original .iDB and current MoneyMan transactions.
 *
 * @param {Uint8Array} originalIdb - Original .iDB binary
 * @param {Array} transactions - Current MoneyMan transactions
 * @param {Object} categoryMapping - CW key → MoneyMan ID mapping
 * @param {Object} accountMapping - CW account ID → name mapping
 * @returns {Promise<{ updated: number, inserted: number, deleted: number, originalCount: number }>}
 */
export async function computeChangeSummary(originalIdb, transactions, categoryMapping, accountMapping) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(originalIdb))

  const countResult = db.exec('SELECT COUNT(*) FROM rec_table')
  const originalCount = countResult.length ? countResult[0].values[0][0] : 0

  const existingIds = new Set()
  const idResult = db.exec('SELECT _id FROM rec_table')
  if (idResult.length) {
    for (const row of idResult[0].values) {
      existingIds.add(row[0])
    }
  }

  db.close()

  const mmCwIds = new Set()
  let inserted = 0
  for (const tx of transactions) {
    if (tx.cwId != null) {
      mmCwIds.add(tx.cwId)
    } else {
      inserted++
    }
  }

  let updated = 0
  let deleted = 0
  for (const cwId of existingIds) {
    if (mmCwIds.has(cwId)) {
      updated++
    } else {
      deleted++
    }
  }

  return { updated, inserted, deleted, originalCount }
}

/**
 * Build an exported .iDB by modifying the original with MoneyMan changes.
 *
 * @param {Uint8Array} originalIdb - Original .iDB binary
 * @param {Array} transactions - Current MoneyMan transactions
 * @param {Object} categoryMapping - CW key → MoneyMan ID mapping
 * @param {Object} accountMapping - CW account ID → name mapping
 * @returns {Promise<Uint8Array>} Modified .iDB binary
 */
export async function buildExportDB(originalIdb, transactions, categoryMapping, accountMapping) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(originalIdb))

  const { parentReverse, childReverse } = reverseCategoryMapping(categoryMapping)
  const accReverse = reverseAccountMapping(accountMapping)

  // Build set of cwIds present in MoneyMan
  const mmCwIds = new Set()
  for (const tx of transactions) {
    if (tx.cwId != null) mmCwIds.add(tx.cwId)
  }

  // Delete records not in MoneyMan
  const idResult = db.exec('SELECT _id FROM rec_table')
  if (idResult.length) {
    for (const row of idResult[0].values) {
      const cwId = row[0]
      if (!mmCwIds.has(cwId)) {
        db.run('DELETE FROM rec_table WHERE _id = ?', [cwId])
      }
    }
  }

  // Update existing / Insert new
  for (const tx of transactions) {
    const iDate = dateToTimestamp(tx.date)
    const iKind = parentReverse[tx.category] || 0
    const iKinds = childReverse[tx.subcategory] || 0
    const iAccount = accReverse[tx.account] || 0
    const iType = tx.type === 'income' ? '2' : '1'

    if (tx.cwId != null) {
      // UPDATE — only update the fields MoneyMan manages
      db.run(
        `UPDATE rec_table SET i_money = ?, i_date = ?, i_kind = ?, i_kinds = ?, i_account = ?, i_remark = ?, i_type = ? WHERE _id = ?`,
        [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType, tx.cwId]
      )
    } else {
      // INSERT
      db.run(
        `INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType]
      )
    }
  }

  const result = new Uint8Array(db.export())
  db.close()
  return result
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/cwmoney-exporter.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/cwmoney-exporter.js src/__tests__/services/cwmoney-exporter.test.js
git commit -m "feat: add cwmoney-exporter service for edit-writeback mode"
```

---

### Task 5: cwmoney-exporter — 全新匯出模式

**Files:**
- Modify: `src/services/cwmoney-exporter.js`
- Modify: `src/__tests__/services/cwmoney-exporter.test.js`

**Step 1: Write failing tests for buildFreshExportDB**

在 `src/__tests__/services/cwmoney-exporter.test.js` 新增：

```js
import { buildFreshExportDB } from '../../services/cwmoney-exporter.js'

describe('buildFreshExportDB', () => {
  it('creates a valid CWMoney .iDB from MoneyMan data', async () => {
    const categories = [
      { id: 1, name: '飲食', type: 'expense', parentId: null, icon: '🍔', color: '#F44336' },
      { id: 2, name: '早餐', type: 'expense', parentId: 1, icon: '🥐', color: '#F44336' },
      { id: 3, name: '薪水', type: 'income', parentId: null, icon: '💰', color: '#4CAF50' }
    ]

    const transactions = [
      { id: 1, amount: 80, type: 'expense', date: '2024-02-01', note: '早餐', category: 1, subcategory: 2, account: '現金' },
      { id: 2, amount: 45000, type: 'income', date: '2024-02-05', note: '月薪', category: 3, subcategory: null, account: '銀行' }
    ]

    const resultBytes = await buildFreshExportDB(transactions, categories)

    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs()
    const db = new SQL.Database(resultBytes)

    // Check rec_table
    const recs = db.exec('SELECT COUNT(*) FROM rec_table')
    expect(recs[0].values[0][0]).toBe(2)

    // Check expense category tables
    const kinds = db.exec('SELECT kindtext FROM kind_table')
    expect(kinds[0].values[0][0]).toBe('飲食')

    const kindsChildren = db.exec('SELECT kindstext FROM kinds_table')
    expect(kindsChildren[0].values[0][0]).toBe('早餐')

    // Check income category tables
    const inKinds = db.exec('SELECT kindtext FROM in_kind_table')
    expect(inKinds[0].values[0][0]).toBe('薪水')

    // Check accounts
    const accs = db.exec('SELECT acctext FROM acc_table ORDER BY accsort')
    expect(accs[0].values.map(r => r[0])).toContain('現金')
    expect(accs[0].values.map(r => r[0])).toContain('銀行')

    db.close()
  })

  it('handles empty transactions', async () => {
    const resultBytes = await buildFreshExportDB([], [])

    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs()
    const db = new SQL.Database(resultBytes)

    const recs = db.exec('SELECT COUNT(*) FROM rec_table')
    expect(recs[0].values[0][0]).toBe(0)
    db.close()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/cwmoney-exporter.test.js`
Expected: FAIL — `buildFreshExportDB` not found

**Step 3: Implement buildFreshExportDB**

在 `src/services/cwmoney-exporter.js` 新增：

```js
/**
 * CWMoney table schemas for fresh export.
 */
const CWMONEY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rec_table (_id INTEGER PRIMARY KEY AUTOINCREMENT, i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER, i_account INTEGER, i_remark TEXT, i_type TEXT)`,
  `CREATE TABLE IF NOT EXISTS kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`
]

/**
 * Build a fresh CWMoney .iDB from MoneyMan data (no original .iDB).
 *
 * @param {Array} transactions - MoneyMan transactions to export
 * @param {Array} categories - MoneyMan categories
 * @returns {Promise<Uint8Array>} New .iDB binary
 */
export async function buildFreshExportDB(transactions, categories) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()

  for (const stmt of CWMONEY_SCHEMA) {
    db.run(stmt)
  }

  // Build category mappings: MoneyMan ID → CW ID
  const parentMap = {}  // mmId → cwId
  const childMap = {}   // mmId → cwId

  // Expense parents
  const expenseParents = categories.filter(c => c.type === 'expense' && c.parentId === null)
  expenseParents.forEach((cat, i) => {
    const cwId = i + 1
    parentMap[cat.id] = cwId
    db.run('INSERT INTO kind_table VALUES (?, ?, ?, ?)', [cwId, cat.name, 'k1', i])
  })

  // Expense children
  const expenseChildren = categories.filter(c => c.type === 'expense' && c.parentId !== null)
  expenseChildren.forEach((cat, i) => {
    const cwId = i + 1
    childMap[cat.id] = cwId
    const cwParentId = parentMap[cat.parentId] || 0
    db.run('INSERT INTO kinds_table VALUES (?, ?, ?, ?, ?)', [cwId, cwParentId, cat.name, 'k1', i])
  })

  // Income parents
  const incomeParents = categories.filter(c => c.type === 'income' && c.parentId === null)
  incomeParents.forEach((cat, i) => {
    const cwId = i + 1
    parentMap[cat.id] = cwId
    db.run('INSERT INTO in_kind_table VALUES (?, ?, ?, ?)', [cwId, cat.name, 'i1', i])
  })

  // Income children
  const incomeChildren = categories.filter(c => c.type === 'income' && c.parentId !== null)
  incomeChildren.forEach((cat, i) => {
    const cwId = i + 1
    childMap[cat.id] = cwId
    const cwParentId = parentMap[cat.parentId] || 0
    db.run('INSERT INTO in_kinds_table VALUES (?, ?, ?, ?, ?)', [cwId, cwParentId, cat.name, 'i1', i])
  })

  // Build account mapping from unique account names
  const accountNames = [...new Set(transactions.map(t => t.account).filter(Boolean))]
  const accMap = {}
  accountNames.forEach((name, i) => {
    const cwId = i + 1
    accMap[name] = cwId
    db.run('INSERT INTO acc_table VALUES (?, ?, ?, ?)', [cwId, name, 'm1', i])
  })

  // Insert transactions
  for (const tx of transactions) {
    const iDate = dateToTimestamp(tx.date)
    const iKind = parentMap[tx.category] || 0
    const iKinds = childMap[tx.subcategory] || 0
    const iAccount = accMap[tx.account] || 0
    const iType = tx.type === 'income' ? '2' : '1'

    db.run(
      'INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType]
    )
  }

  const result = new Uint8Array(db.export())
  db.close()
  return result
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/cwmoney-exporter.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/cwmoney-exporter.js src/__tests__/services/cwmoney-exporter.test.js
git commit -m "feat: add fresh export mode to cwmoney-exporter"
```

---

### Task 6: Google Drive .iDB 上傳功能

**Files:**
- Modify: `src/services/gdrive.js`

**Step 1: Add uploadIDB function**

在 `src/services/gdrive.js` 新增：

```js
const IDB_FILE_NAME = 'moneyman-cwmoney-export.iDB'

export async function uploadIDB(uint8Array) {
  if (!accessToken) throw new Error('未授權')

  const blob = new Blob([uint8Array], { type: 'application/octet-stream' })

  const searchRes = await checkedFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${IDB_FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    const fileId = searchData.files[0].id
    await checkedFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
      body: blob
    })
  } else {
    const metadata = { name: IDB_FILE_NAME, mimeType: 'application/octet-stream' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    await checkedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    })
  }
}
```

**Step 2: Update SettingsView upload to include cwmoney_meta**

在 `src/views/SettingsView.vue` 的 `upload` 函數中，data 加入 `cwmoney_meta`：

```js
const data = {
  transactions: await getRecords('transactions'),
  cards: await getRecords('cards'),
  categories: await getRecords('categories'),
  templates: await getRecords('templates'),
  cwmoney_meta: await getRecords('cwmoney_meta'),
  exportedAt: new Date().toISOString()
}
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/services/gdrive.js src/views/SettingsView.vue
git commit -m "feat: add Google Drive .iDB upload and include cwmoney_meta in backup"
```

---

### Task 7: ExportCWMoney.vue 匯出精靈 UI

**Files:**
- Create: `src/components/ExportCWMoney.vue`
- Modify: `src/views/SettingsView.vue`

**Step 1: Create ExportCWMoney.vue**

建立 `src/components/ExportCWMoney.vue`：

```vue
<template>
  <div class="export-cwmoney">
    <!-- Loading meta -->
    <div v-if="loading" class="loading">載入中...</div>

    <!-- Mode: Edit-writeback (has original .iDB) -->
    <template v-else-if="hasOriginalIdb">
      <!-- Step 1: Summary -->
      <div v-if="step === 'summary'">
        <div class="info-box">
          <p>原始檔案：{{ importInfo.fileName }}</p>
          <p>匯入時間：{{ importInfo.importedAt?.slice(0, 10) }}</p>
          <p>原始筆數：{{ changeSummary.originalCount.toLocaleString() }} 筆</p>
        </div>
        <div class="change-summary">
          <span>修改 {{ changeSummary.updated }} 筆</span>
          <span>新增 {{ changeSummary.inserted }} 筆</span>
          <span>刪除 {{ changeSummary.deleted }} 筆</span>
        </div>
        <div class="actions">
          <button @click="doExport" class="export-btn">匯出 .iDB</button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <!-- Step 2: Exporting -->
      <div v-if="step === 'exporting'">
        <p>匯出中...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 50%"></div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-if="step === 'done'">
        <div class="done-msg">
          <p>匯出完成！</p>
          <p>更新 {{ changeSummary.updated }} 筆 / 新增 {{ changeSummary.inserted }} 筆 / 刪除 {{ changeSummary.deleted }} 筆</p>
        </div>
        <div class="actions">
          <button @click="downloadFile" class="download-btn">下載 .iDB</button>
          <button @click="uploadGDrive" class="gdrive-btn" :disabled="uploading">上傳到 Google Drive</button>
        </div>
        <div v-if="uploadMsg" class="sync-msg">{{ uploadMsg }}</div>
        <button @click="reset" class="link-btn">完成</button>
      </div>
    </template>

    <!-- Mode: Fresh export (no original .iDB) -->
    <template v-else>
      <!-- Step 1: Settings -->
      <div v-if="step === 'settings'">
        <div class="info-box">
          <p>MoneyMan 目前共 {{ totalCount.toLocaleString() }} 筆交易</p>
        </div>
        <div class="range-inputs">
          <input type="date" v-model="startDate" />
          <span>～</span>
          <input type="date" v-model="endDate" />
        </div>
        <p class="range-count">此區間共 {{ rangeCount.toLocaleString() }} 筆</p>
        <div class="actions">
          <button @click="doFreshExport" class="export-btn" :disabled="rangeCount === 0">匯出 .iDB</button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <!-- Step 2: Exporting -->
      <div v-if="step === 'exporting'">
        <p>匯出中...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 50%"></div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-if="step === 'done'">
        <div class="done-msg">
          <p>匯出完成！</p>
          <p>共匯出 {{ exportedCount }} 筆交易、{{ exportedCatCount }} 個分類</p>
        </div>
        <div class="actions">
          <button @click="downloadFile" class="download-btn">下載 .iDB</button>
          <button @click="uploadGDrive" class="gdrive-btn" :disabled="uploading">上傳到 Google Drive</button>
        </div>
        <div v-if="uploadMsg" class="sync-msg">{{ uploadMsg }}</div>
        <button @click="reset" class="link-btn">完成</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import { getCWMoneyMeta } from '../services/db.js'
import { buildExportDB, buildFreshExportDB, computeChangeSummary } from '../services/cwmoney-exporter.js'
import { requestAuth, uploadIDB, isConfigured } from '../services/gdrive.js'

const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const loading = ref(true)
const error = ref('')
const step = ref('')

// Edit-writeback state
const hasOriginalIdb = ref(false)
const importInfo = ref({})
const changeSummary = ref({ updated: 0, inserted: 0, deleted: 0, originalCount: 0 })

// Fresh export state
const totalCount = ref(0)
const startDate = ref('')
const endDate = ref('')
const exportedCount = ref(0)
const exportedCatCount = ref(0)

// Shared state
let exportedBytes = null
const uploading = ref(false)
const uploadMsg = ref('')

const rangeCount = computed(() => {
  if (!startDate.value || !endDate.value) return totalCount.value
  return txStore.transactions.filter(t => t.date >= startDate.value && t.date <= endDate.value).length
})

onMounted(async () => {
  await txStore.loadAll()
  await catStore.init()
  totalCount.value = txStore.transactions.length

  const originalIdb = await getCWMoneyMeta('original_idb')
  if (originalIdb) {
    hasOriginalIdb.value = true
    importInfo.value = (await getCWMoneyMeta('import_info')) || {}

    const categoryMapping = (await getCWMoneyMeta('category_mapping')) || {}
    const accountMapping = (await getCWMoneyMeta('account_mapping')) || {}

    changeSummary.value = await computeChangeSummary(
      originalIdb, txStore.transactions, categoryMapping, accountMapping
    )
    step.value = 'summary'
  } else {
    hasOriginalIdb.value = false
    // Set date range from transactions
    if (txStore.transactions.length) {
      const dates = txStore.transactions.map(t => t.date).sort()
      startDate.value = dates[0]
      endDate.value = dates[dates.length - 1]
    }
    step.value = 'settings'
  }

  loading.value = false
})

async function doExport() {
  step.value = 'exporting'
  error.value = ''
  try {
    const originalIdb = await getCWMoneyMeta('original_idb')
    const categoryMapping = (await getCWMoneyMeta('category_mapping')) || {}
    const accountMapping = (await getCWMoneyMeta('account_mapping')) || {}

    exportedBytes = await buildExportDB(originalIdb, txStore.transactions, categoryMapping, accountMapping)
    step.value = 'done'
  } catch (e) {
    error.value = '匯出失敗：' + e.message
    step.value = 'summary'
  }
}

async function doFreshExport() {
  step.value = 'exporting'
  error.value = ''
  try {
    const filtered = txStore.transactions.filter(t => t.date >= startDate.value && t.date <= endDate.value)
    exportedBytes = await buildFreshExportDB(filtered, catStore.categories)
    exportedCount.value = filtered.length
    exportedCatCount.value = catStore.categories.length
    step.value = 'done'
  } catch (e) {
    error.value = '匯出失敗：' + e.message
    step.value = 'settings'
  }
}

function downloadFile() {
  if (!exportedBytes) return
  const blob = new Blob([exportedBytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = hasOriginalIdb.value
    ? (importInfo.value.fileName || 'moneyman-export.iDB')
    : 'moneyman-export.iDB'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function uploadGDrive() {
  if (!exportedBytes) return
  uploading.value = true
  uploadMsg.value = ''
  try {
    if (!isConfigured()) {
      uploadMsg.value = '請先在 Google Drive 同步區塊設定 Client ID'
      return
    }
    await requestAuth()
    await uploadIDB(exportedBytes)
    uploadMsg.value = '上傳成功！'
  } catch (e) {
    uploadMsg.value = '上傳失敗：' + e.message
  } finally {
    uploading.value = false
  }
}

function reset() {
  step.value = hasOriginalIdb.value ? 'summary' : 'settings'
  exportedBytes = null
  uploadMsg.value = ''
}
</script>

<style scoped>
.export-cwmoney { margin-top: 8px; }
.info-box { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
.info-box p { margin: 4px 0; }
.change-summary { display: flex; gap: 12px; margin-bottom: 12px; font-size: 13px; color: #666; }
.range-inputs { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.range-inputs input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.range-count { font-size: 13px; color: #666; margin-bottom: 12px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.export-btn { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; }
.export-btn:disabled { background: #ccc; }
.download-btn { padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; }
.gdrive-btn { padding: 10px 20px; background: #FF9800; color: white; border: none; border-radius: 8px; cursor: pointer; }
.gdrive-btn:disabled { background: #ccc; }
.error { color: #F44336; margin-top: 8px; font-size: 13px; }
.loading { text-align: center; color: #999; padding: 16px; }
.progress-bar { height: 8px; background: #eee; border-radius: 4px; margin-top: 12px; }
.progress-fill { height: 100%; background: #4CAF50; border-radius: 4px; transition: width 0.3s; }
.done-msg { background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
.done-msg p { margin: 4px 0; }
.sync-msg { margin-top: 8px; padding: 8px; background: #E8F5E9; border-radius: 4px; font-size: 13px; }
.link-btn { display: block; text-align: center; padding: 8px; background: none; border: none; color: #999; cursor: pointer; margin-top: 8px; font-size: 13px; }
</style>
```

**Step 2: Add ExportCWMoney to SettingsView**

在 `src/views/SettingsView.vue` 中：

1. Import 加入：
```js
import ExportCWMoney from '../components/ExportCWMoney.vue'
```

2. 在 template 的 CWMoney section 後面加入：
```html
<section>
  <h3>匯出為 CWMoney .iDB</h3>
  <ExportCWMoney />
</section>
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/components/ExportCWMoney.vue src/views/SettingsView.vue
git commit -m "feat: add ExportCWMoney UI component with edit-writeback and fresh export modes"
```

---

### Task 8: 整合測試 + 全套驗證

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Run build**

Run: `npx vite build`
Expected: Build succeeds with no errors

**Step 3: Manual smoke test checklist**

用 `npx vite preview` 開啟 app，手動驗證：
- [ ] 設定頁面看到「匯出為 CWMoney .iDB」區塊
- [ ] 沒匯入過 .iDB 時，顯示全新匯出模式（日期範圍選擇）
- [ ] 匯入一個 .iDB 後，匯出區塊自動切換為編輯回寫模式
- [ ] 點「匯出 .iDB」後能正常產生檔案
- [ ] 「下載 .iDB」觸發檔案下載
- [ ] 「上傳到 Google Drive」需設定 Client ID 才能用
- [ ] Google Drive 備份/還原功能仍正常

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address integration issues from smoke testing"
```
