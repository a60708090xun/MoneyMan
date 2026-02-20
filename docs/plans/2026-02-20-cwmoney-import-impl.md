# CWMoney Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import CWMoney .iDB data into MoneyMan with date range selection, 2-level category hierarchy, and duplicate detection.

**Architecture:** Upgrade IndexedDB schema to v2, add parentId/type to categories store (single-table self-reference), add subcategory/account to transactions. Parse .iDB files in-browser using sql.js (WASM SQLite). Category field in transactions changes from name string to numeric ID for proper relational integrity.

**Tech Stack:** Vue 3, Pinia, IndexedDB (idb), sql.js (dynamic import), Vitest

---

## Important Context

### Current `category` field migration

Currently transactions store `category` as a **name string** (e.g., `'飲食'`). This plan changes it to a **numeric ID** referencing the categories store. This requires:

1. Schema-level index additions in the DB upgrade handler
2. A one-time data migration that runs after DB opens (converts existing name strings to IDs)
3. All views/stores that display or use `category` must be updated

### File inventory

```
MODIFY:
  src/services/db.js                    — DB version 1→2, add indexes, add migration
  src/stores/categories.js              — 2-level support, getByType, getChildren
  src/stores/transactions.js            — subcategory, account, category-as-id
  src/views/AddView.vue                 — 2-level category picker, account field
  src/views/SettingsView.vue            — tree category management, import section
  src/views/HomeView.vue                — category display by id lookup
  src/views/ReportView.vue              — breakdown by category id→name
  src/views/ReconcileView.vue           — quickAdd with new fields
  src/components/PieChart.vue           — no change (receives {name: amount})
  src/__tests__/services/db.test.js     — update for v2 schema
  src/__tests__/stores/categories.test.js — update for 2-level
  src/__tests__/stores/transactions.test.js — update for new fields

CREATE:
  src/services/cwmoney-parser.js        — .iDB SQLite parsing & conversion
  src/components/ImportCWMoney.vue       — import wizard UI
  src/__tests__/services/cwmoney-parser.test.js — parser tests
```

---

### Task 1: Install sql.js and configure Vite

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

**Step 1: Install sql.js**

Run: `npm install sql.js`

**Step 2: Configure Vite to handle sql.js WASM**

sql.js needs its WASM file served. Add to `vite.config.js`:

```js
export default defineConfig({
  base: '/MoneyMan/',
  optimizeDeps: {
    exclude: ['sql.js']
  },
  plugins: [
    // ... existing plugins
  ],
  // ... existing config
})
```

**Step 3: Verify build works**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "chore: add sql.js dependency for CWMoney import"
```

---

### Task 2: IndexedDB schema migration (db.js v1→v2)

**Files:**
- Modify: `src/services/db.js`
- Modify: `src/__tests__/services/db.test.js`

**Step 1: Write failing test for v2 schema**

Add to `src/__tests__/services/db.test.js`:

```js
it('creates parentId and type indexes on categories', async () => {
  const db = await initDB()
  const catStore = db.transaction('categories').objectStore('categories')
  expect(catStore.indexNames.contains('parentId')).toBe(true)
  expect(catStore.indexNames.contains('type')).toBe(true)
})

it('creates subcategory index on transactions', async () => {
  const db = await initDB()
  const txStore = db.transaction('transactions').objectStore('transactions')
  expect(txStore.indexNames.contains('subcategory')).toBe(true)
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: FAIL — indexes don't exist yet.

**Step 3: Update db.js to v2**

Replace the `initDB` function in `src/services/db.js`:

```js
const DB_VERSION = 2

export async function initDB() {
  if (dbInstance) return dbInstance
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
        txStore.createIndex('date', 'date')
        txStore.createIndex('category', 'category')
        txStore.createIndex('cardId', 'cardId')
        txStore.createIndex('subcategory', 'subcategory')
        db.createObjectStore('cards', { keyPath: 'id' })
        const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true })
        catStore.createIndex('parentId', 'parentId')
        catStore.createIndex('type', 'type')
      }
      if (oldVersion >= 1 && oldVersion < 2) {
        const txStore = db.transaction.objectStore('transactions')
        txStore.createIndex('subcategory', 'subcategory')
        const catStore = db.transaction.objectStore('categories')
        catStore.createIndex('parentId', 'parentId')
        catStore.createIndex('type', 'type')
      }
    }
  })
  return dbInstance
}
```

**Step 4: Add `migrateData` function to db.js**

This runs after DB open to migrate existing data (categories get type/parentId, transactions get category as id):

```js
export async function migrateData() {
  const db = await initDB()

  // Migrate categories: add type and parentId if missing
  const cats = await db.getAll('categories')
  const needsCatMigration = cats.some(c => c.type === undefined)
  if (needsCatMigration) {
    const tx = db.transaction('categories', 'readwrite')
    for (const cat of cats) {
      if (cat.type === undefined) {
        await tx.store.put({ ...cat, type: 'expense', parentId: null })
      }
    }
    await tx.done
  }

  // Migrate transactions: convert category name→id, add subcategory/account
  const updatedCats = await db.getAll('categories')
  const nameToId = {}
  for (const cat of updatedCats) {
    if (cat.parentId === null || cat.parentId === undefined) {
      nameToId[cat.name] = cat.id
    }
  }

  const txs = await db.getAll('transactions')
  const needsTxMigration = txs.some(t => typeof t.category === 'string')
  if (needsTxMigration) {
    const tx = db.transaction('transactions', 'readwrite')
    for (const t of txs) {
      if (typeof t.category === 'string') {
        const catId = nameToId[t.category] || null
        await tx.store.put({
          ...t,
          category: catId,
          subcategory: t.subcategory ?? null,
          account: t.account ?? null
        })
      }
    }
    await tx.done
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: PASS

**Step 6: Add migration test**

```js
it('migrateData adds type and parentId to existing categories', async () => {
  // Insert old-format category
  await addRecord('categories', { name: '飲食', color: '#F44336', icon: '🍔' })
  await migrateData()
  const cats = await getRecords('categories')
  expect(cats[0].type).toBe('expense')
  expect(cats[0].parentId).toBeNull()
})

it('migrateData converts transaction category from name to id', async () => {
  await addRecord('categories', { name: '飲食', color: '#F44336', icon: '🍔' })
  await migrateData() // adds type/parentId to category
  const cats = await getRecords('categories')
  const catId = cats[0].id

  await addRecord('transactions', { amount: 100, type: 'expense', category: '飲食', date: '2026-01-01' })
  await migrateData()
  const txs = await getRecords('transactions')
  expect(txs[0].category).toBe(catId)
  expect(txs[0].subcategory).toBeNull()
  expect(txs[0].account).toBeNull()
})
```

**Step 7: Run all tests**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: PASS

**Step 8: Commit**

```bash
git add src/services/db.js src/__tests__/services/db.test.js
git commit -m "feat: upgrade IndexedDB to v2 with category hierarchy and migration"
```

---

### Task 3: Categories store 2-level upgrade

**Files:**
- Modify: `src/stores/categories.js`
- Modify: `src/__tests__/stores/categories.test.js`

**Step 1: Write failing tests for 2-level categories**

Replace `src/__tests__/stores/categories.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCategoriesStore } from '../../stores/categories.js'
import { clearStore } from '../../services/db.js'

describe('categories store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('categories')
  })

  it('loads default categories with type and parentId', async () => {
    const store = useCategoriesStore()
    await store.init()
    expect(store.categories.length).toBeGreaterThanOrEqual(7)
    expect(store.categories[0].type).toBe('expense')
    expect(store.categories[0].parentId).toBeNull()
  })

  it('getByType filters by income/expense', async () => {
    const store = useCategoriesStore()
    await store.init()
    await store.addCategory({ name: '薪資', color: '#4CAF50', icon: '💰', type: 'income', parentId: null })
    expect(store.getByType('expense').length).toBeGreaterThanOrEqual(7)
    expect(store.getByType('income').length).toBe(1)
  })

  it('getChildren returns sub-categories by parentId', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id // 飲食
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    await store.addCategory({ name: '午餐', color: '#FF9800', icon: '🍱', type: 'expense', parentId })
    expect(store.getChildren(parentId).length).toBe(2)
    expect(store.getChildren(parentId)[0].name).toBe('早餐')
  })

  it('getParents returns only top-level categories', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    const parents = store.getParents('expense')
    expect(parents.every(c => c.parentId === null)).toBe(true)
  })

  it('getCategoryName returns name by id', async () => {
    const store = useCategoriesStore()
    await store.init()
    const cat = store.categories[0]
    expect(store.getCategoryName(cat.id)).toBe(cat.name)
  })

  it('getFullCategoryName returns parent/sub format', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    const sub = store.categories.find(c => c.name === '早餐')
    expect(store.getFullCategoryName(parentId, sub.id)).toBe('飲食/早餐')
    expect(store.getFullCategoryName(parentId, null)).toBe('飲食')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/stores/categories.test.js`
Expected: FAIL

**Step 3: Update categories store**

Replace `src/stores/categories.js`:

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

const DEFAULT_CATEGORIES = [
  { name: '飲食', color: '#F44336', icon: '🍔', type: 'expense', parentId: null },
  { name: '交通', color: '#2196F3', icon: '🚗', type: 'expense', parentId: null },
  { name: '娛樂', color: '#9C27B0', icon: '🎮', type: 'expense', parentId: null },
  { name: '購物', color: '#FF9800', icon: '🛍️', type: 'expense', parentId: null },
  { name: '居家', color: '#795548', icon: '🏠', type: 'expense', parentId: null },
  { name: '醫療', color: '#E91E63', icon: '💊', type: 'expense', parentId: null },
  { name: '教育', color: '#3F51B5', icon: '📚', type: 'expense', parentId: null }
]

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([])

  async function init() {
    const stored = await getRecords('categories')
    if (stored.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await addRecord('categories', cat)
      }
      categories.value = await getRecords('categories')
    } else {
      categories.value = stored
    }
  }

  async function addCategory(cat) {
    const id = await addRecord('categories', cat)
    categories.value.push({ ...cat, id })
    return id
  }

  async function editCategory(cat) {
    await updateRecord('categories', cat)
    const idx = categories.value.findIndex(c => c.id === cat.id)
    if (idx !== -1) categories.value[idx] = { ...cat }
  }

  async function deleteCategory(id) {
    await deleteRecord('categories', id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  function getByType(type) {
    return categories.value.filter(c => c.type === type)
  }

  function getParents(type) {
    return categories.value.filter(c => c.type === type && c.parentId === null)
  }

  function getChildren(parentId) {
    return categories.value.filter(c => c.parentId === parentId)
  }

  function getCategoryName(id) {
    const cat = categories.value.find(c => c.id === id)
    return cat ? cat.name : ''
  }

  function getFullCategoryName(categoryId, subcategoryId) {
    const parent = getCategoryName(categoryId)
    if (!subcategoryId) return parent
    const sub = getCategoryName(subcategoryId)
    return sub ? `${parent}/${sub}` : parent
  }

  return {
    categories, init, addCategory, editCategory, deleteCategory,
    getByType, getParents, getChildren, getCategoryName, getFullCategoryName
  }
})
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/stores/categories.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/categories.js src/__tests__/stores/categories.test.js
git commit -m "feat: upgrade categories store to 2-level hierarchy"
```

---

### Task 4: Transactions store upgrade

**Files:**
- Modify: `src/stores/transactions.js`
- Modify: `src/__tests__/stores/transactions.test.js`

**Step 1: Write failing tests for new fields**

Replace `src/__tests__/stores/transactions.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions.js'
import { useCategoriesStore } from '../../stores/categories.js'
import { clearStore } from '../../services/db.js'

describe('transactions store', () => {
  let catStore

  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('transactions')
    await clearStore('categories')
    catStore = useCategoriesStore()
    await catStore.init()
  })

  it('adds a transaction with subcategory and account', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({
      amount: 150, type: 'expense', category: catId, subcategory: null,
      channel: '超商', cardId: null, date: '2026-02-19', note: '午餐', account: '現金'
    })
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0].category).toBe(catId)
    expect(store.transactions[0].account).toBe('現金')
  })

  it('computes monthly totals', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 1000, type: 'income', category: catId, date: '2026-02-01' })
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-10' })
    const summary = store.getMonthlySummary(2026, 2)
    expect(summary.income).toBe(1000)
    expect(summary.expense).toBe(500)
    expect(summary.balance).toBe(500)
  })

  it('computes category breakdown with names', async () => {
    const store = useTransactionsStore()
    const cat1 = catStore.categories[0].id // 飲食
    const cat2 = catStore.categories[1].id // 交通
    await store.addTransaction({ amount: 300, type: 'expense', category: cat1, date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: cat1, date: '2026-02-06' })
    await store.addTransaction({ amount: 100, type: 'expense', category: cat2, date: '2026-02-07' })
    const breakdown = store.getCategoryBreakdown(2026, 2)
    // getCategoryBreakdown returns { [categoryName]: amount } for PieChart compatibility
    expect(breakdown['飲食']).toBe(500)
    expect(breakdown['交通']).toBe(100)
  })

  it('checks duplicates correctly', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, subcategory: null, date: '2026-02-19' })
    expect(store.isDuplicate({ amount: 100, category: catId, subcategory: null, date: '2026-02-19' })).toBe(true)
    expect(store.isDuplicate({ amount: 200, category: catId, subcategory: null, date: '2026-02-19' })).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: FAIL

**Step 3: Update transactions store**

Replace `src/stores/transactions.js`:

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'
import { useCategoriesStore } from './categories.js'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref([])

  async function loadAll() {
    transactions.value = await getRecords('transactions')
  }

  async function addTransaction(tx) {
    const id = await addRecord('transactions', tx)
    transactions.value.push({ ...tx, id })
    return id
  }

  async function editTransaction(tx) {
    await updateRecord('transactions', tx)
    const idx = transactions.value.findIndex(t => t.id === tx.id)
    if (idx !== -1) transactions.value[idx] = tx
  }

  async function deleteTransaction(id) {
    await deleteRecord('transactions', id)
    transactions.value = transactions.value.filter(t => t.id !== id)
  }

  function getMonthTransactions(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return transactions.value.filter(t => t.date && t.date.startsWith(prefix))
  }

  function getMonthlySummary(year, month) {
    const txs = getMonthTransactions(year, month)
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expense, balance: income - expense }
  }

  function getCategoryBreakdown(year, month) {
    const catStore = useCategoriesStore()
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const breakdown = {}
    for (const t of txs) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      breakdown[name] = (breakdown[name] || 0) + t.amount
    }
    return breakdown
  }

  function getTransactionsByDateRange(startDate, endDate) {
    return transactions.value.filter(t => t.date && t.date >= startDate && t.date <= endDate)
  }

  function getDailyTotals(year, month) {
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const daily = {}
    for (const t of txs) {
      const day = parseInt(t.date.split('-')[2])
      daily[day] = (daily[day] || 0) + t.amount
    }
    return daily
  }

  function isDuplicate({ amount, category, subcategory, date }) {
    return transactions.value.some(t =>
      t.date === date &&
      t.amount === amount &&
      t.category === category &&
      (t.subcategory ?? null) === (subcategory ?? null)
    )
  }

  return {
    transactions, loadAll, addTransaction, editTransaction, deleteTransaction,
    getMonthTransactions, getTransactionsByDateRange, getMonthlySummary,
    getCategoryBreakdown, getDailyTotals, isDuplicate
  }
})
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/transactions.js src/__tests__/stores/transactions.test.js
git commit -m "feat: add subcategory, account, isDuplicate to transactions store"
```

---

### Task 5: CWMoney parser service

**Files:**
- Create: `src/services/cwmoney-parser.js`
- Create: `src/__tests__/services/cwmoney-parser.test.js`

**Step 1: Write failing tests**

Create `src/__tests__/services/cwmoney-parser.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseDateRange, parseRecords, parseCategories, parseAccounts } from '../../services/cwmoney-parser.js'

// Mock sql.js database interface
function mockDB(tables) {
  return {
    exec(sql) {
      for (const [pattern, result] of Object.entries(tables)) {
        if (sql.includes(pattern)) return result
      }
      return []
    }
  }
}

describe('cwmoney-parser', () => {
  describe('parseDateRange', () => {
    it('returns min and max dates from rec_table', () => {
      const db = mockDB({
        'MIN(i_date)': [{ values: [[1372176000, 1771430400]] }]
      })
      const range = parseDateRange(db)
      expect(range.min).toBe('2013-06-25')
      expect(range.max).toBe('2026-02-18')
    })
  })

  describe('parseCategories', () => {
    it('parses expense and income categories', () => {
      const db = mockDB({
        'FROM kind_table': [{ values: [[1, '食物飲品', 'k1', 0]] }],
        'FROM kinds_table': [{ values: [[1, 1, '早餐', 'k1', 0]] }],
        'FROM in_kind_table': [{ values: [[1, '工作收入', 'i1', 0]] }],
        'FROM in_kinds_table': [{ values: [[1, 1, '薪水收入', 'i1', 0]] }]
      })
      const cats = parseCategories(db)
      expect(cats.expenseParents).toHaveLength(1)
      expect(cats.expenseParents[0].name).toBe('食物飲品')
      expect(cats.expenseChildren).toHaveLength(1)
      expect(cats.expenseChildren[0].name).toBe('早餐')
      expect(cats.incomeParents).toHaveLength(1)
      expect(cats.incomeChildren).toHaveLength(1)
    })
  })

  describe('parseAccounts', () => {
    it('parses account id to name mapping', () => {
      const db = mockDB({
        'FROM acc_table': [{ values: [[1, '現金', 'm1'], [13, '信用卡', 'm3']] }]
      })
      const accs = parseAccounts(db)
      expect(accs[1]).toBe('現金')
      expect(accs[13]).toBe('信用卡')
    })
  })

  describe('parseRecords', () => {
    it('converts rec_table rows to MoneyMan format', () => {
      const accounts = { 1: '現金' }
      const categoryMap = {
        expense: { 1: { parentName: '食物飲品', cwParentId: 1 }, 3: { parentName: '食物飲品', subName: '午餐', cwParentId: 1 } },
        income: {}
      }
      const db = mockDB({
        'FROM rec_table': [{
          columns: ['_id', 'i_money', 'i_date', 'i_kind', 'i_kinds', 'i_account', 'i_remark', 'i_item', 'i_create', 'i_type', 'i_photo', 'i_invoice', 'i_rev1', 'i_gps', 'i_rev2', 'i_rev3', 'i_rev4', 'i_rev5', 'i_rev6', 'i_rate'],
          values: [[1, '150', 1706745600, '1', '3', '1', '便當', '1', 1706745600, '1', '', '', '0', '0,0', '', '0', '0', '0', '', '1']]
        }]
      })
      const records = parseRecords(db, '2024-01-01', '2024-12-31', accounts, categoryMap)
      expect(records).toHaveLength(1)
      expect(records[0].amount).toBe(150)
      expect(records[0].type).toBe('expense')
      expect(records[0].date).toBe('2024-02-01')
      expect(records[0].note).toBe('便當')
      expect(records[0].account).toBe('現金')
      expect(records[0].cwKind).toBe(1)
      expect(records[0].cwKinds).toBe(3)
    })

    it('filters by date range', () => {
      const db = mockDB({
        'FROM rec_table': [{
          columns: ['_id', 'i_money', 'i_date', 'i_kind', 'i_kinds', 'i_account', 'i_remark', 'i_item', 'i_create', 'i_type', 'i_photo', 'i_invoice', 'i_rev1', 'i_gps', 'i_rev2', 'i_rev3', 'i_rev4', 'i_rev5', 'i_rev6', 'i_rate'],
          values: [
            [1, '100', 1704067200, '1', '1', '1', '', '1', 1704067200, '1', '', '', '', '', '', '', '', '', '', '1'],
            [2, '200', 1735689600, '1', '1', '1', '', '1', 1735689600, '1', '', '', '', '', '', '', '', '', '', '1']
          ]
        }]
      })
      const records = parseRecords(db, '2024-01-01', '2024-06-30', { 1: '現金' }, { expense: { 1: { parentName: '食物飲品', cwParentId: 1 } }, income: {} })
      expect(records).toHaveLength(1)
      expect(records[0].date).toBe('2024-01-01')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/cwmoney-parser.test.js`
Expected: FAIL

**Step 3: Implement cwmoney-parser.js**

Create `src/services/cwmoney-parser.js`:

```js
function timestampToDate(ts) {
  const d = new Date(ts * 1000)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateRange(db) {
  const result = db.exec('SELECT MIN(i_date), MAX(i_date) FROM rec_table')
  if (!result.length) return { min: null, max: null, count: 0 }
  const [minTs, maxTs] = result[0].values[0]
  const countResult = db.exec('SELECT COUNT(*) FROM rec_table')
  const count = countResult.length ? countResult[0].values[0][0] : 0
  return { min: timestampToDate(minTs), max: timestampToDate(maxTs), count }
}

export function parseCategories(db) {
  const expenseParents = []
  const expenseChildren = []
  const incomeParents = []
  const incomeChildren = []

  const kindResult = db.exec('SELECT _id, kindtext, pic, sort FROM kind_table ORDER BY sort')
  if (kindResult.length) {
    for (const [id, name, pic, sort] of kindResult[0].values) {
      expenseParents.push({ cwId: id, name, pic, sort })
    }
  }

  const kindsResult = db.exec('SELECT _id, kindid, kindstext, pic, sort FROM kinds_table ORDER BY kindid, sort')
  if (kindsResult.length) {
    for (const [id, parentId, name, pic, sort] of kindsResult[0].values) {
      expenseChildren.push({ cwId: id, cwParentId: parentId, name, pic, sort })
    }
  }

  const inKindResult = db.exec('SELECT _id, kindtext, pic, sort FROM in_kind_table ORDER BY sort')
  if (inKindResult.length) {
    for (const [id, name, pic, sort] of inKindResult[0].values) {
      incomeParents.push({ cwId: id, name, pic, sort })
    }
  }

  const inKindsResult = db.exec('SELECT _id, kindid, kindstext, pic, sort FROM in_kinds_table ORDER BY kindid, sort')
  if (inKindsResult.length) {
    for (const [id, parentId, name, pic, sort] of inKindsResult[0].values) {
      incomeChildren.push({ cwId: id, cwParentId: parentId, name, pic, sort })
    }
  }

  return { expenseParents, expenseChildren, incomeParents, incomeChildren }
}

export function parseAccounts(db) {
  const map = {}
  const result = db.exec('SELECT _id, acctext, accpic FROM acc_table ORDER BY accsort')
  if (result.length) {
    for (const [id, name] of result[0].values) {
      map[id] = name
    }
  }
  return map
}

export function parseRecords(db, startDate, endDate, accounts, categoryMap) {
  const startTs = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
  const endTs = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)

  const result = db.exec(
    `SELECT _id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_item, i_create, i_type, i_photo, i_invoice, i_rev1, i_gps, i_rev2, i_rev3, i_rev4, i_rev5, i_rev6, i_rate FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date ASC`
  )

  if (!result.length) return []

  return result[0].values.map(row => {
    const [_id, money, date, kind, kinds, account, remark, item, , type] = row
    const cwType = String(type)
    return {
      amount: parseFloat(money) || 0,
      type: cwType === '2' ? 'income' : 'expense',
      date: timestampToDate(date),
      note: remark || '',
      account: accounts[parseInt(account)] || '',
      cwKind: parseInt(kind),
      cwKinds: parseInt(kinds),
      channel: null,
      cardId: null
    }
  })
}

export function getRecordCount(db, startDate, endDate) {
  const startTs = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
  const endTs = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)
  const result = db.exec(
    `SELECT COUNT(*) FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs}`
  )
  return result.length ? result[0].values[0][0] : 0
}

export function getPreviewRecords(db, startDate, endDate, accounts, categoryMap) {
  const startTs = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
  const endTs = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)

  const firstResult = db.exec(
    `SELECT _id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_item, i_create, i_type, i_photo, i_invoice, i_rev1, i_gps, i_rev2, i_rev3, i_rev4, i_rev5, i_rev6, i_rate FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date ASC LIMIT 10`
  )
  const lastResult = db.exec(
    `SELECT _id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_item, i_create, i_type, i_photo, i_invoice, i_rev1, i_gps, i_rev2, i_rev3, i_rev4, i_rev5, i_rev6, i_rate FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date DESC LIMIT 10`
  )

  const convert = (rows) => {
    if (!rows.length) return []
    return rows[0].values.map(row => {
      const [_id, money, date, kind, kinds, account, remark, , , type] = row
      return {
        amount: parseFloat(money) || 0,
        type: String(type) === '2' ? 'income' : 'expense',
        date: timestampToDate(date),
        note: remark || '',
        account: accounts[parseInt(account)] || '',
        cwKind: parseInt(kind),
        cwKinds: parseInt(kinds)
      }
    })
  }

  return {
    first10: convert(firstResult),
    last10: convert(lastResult).reverse()
  }
}

export async function loadSqlJs() {
  const initSqlJs = (await import('sql.js')).default
  return initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  })
}

export async function openIDB(file) {
  const SQL = await loadSqlJs()
  const buffer = await file.arrayBuffer()
  return new SQL.Database(new Uint8Array(buffer))
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/services/cwmoney-parser.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/cwmoney-parser.js src/__tests__/services/cwmoney-parser.test.js
git commit -m "feat: add CWMoney .iDB parser service"
```

---

### Task 6: ImportCWMoney component

**Files:**
- Create: `src/components/ImportCWMoney.vue`

This is a multi-step wizard component. No unit test file — tested via manual integration.

**Step 1: Create ImportCWMoney.vue**

Create `src/components/ImportCWMoney.vue`:

```vue
<template>
  <div class="import-cwmoney">
    <!-- Step 1: File selection -->
    <div v-if="step === 'select'">
      <input type="file" accept=".iDB,.idb" @change="onFileSelect" ref="fileInput" hidden />
      <button class="select-btn" @click="$refs.fileInput.click()">選擇 .iDB 檔案</button>
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <!-- Step 2: Date range -->
    <div v-if="step === 'range'">
      <div class="range-info">
        <p>資料範圍：{{ dateRange.min }} ～ {{ dateRange.max }}</p>
        <p>共 {{ dateRange.count.toLocaleString() }} 筆</p>
      </div>
      <div class="range-inputs">
        <input type="date" v-model="startDate" :min="dateRange.min" :max="dateRange.max" />
        <span>～</span>
        <input type="date" v-model="endDate" :min="dateRange.min" :max="dateRange.max" />
      </div>
      <p class="range-count">此區間共 {{ rangeCount.toLocaleString() }} 筆</p>
      <div class="actions">
        <button @click="step = 'select'" class="back-btn">返回</button>
        <button @click="loadPreview" class="next-btn" :disabled="loading">預覽</button>
      </div>
      <div v-if="loading" class="loading">載入中...</div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="step === 'preview'">
      <h4>匯入預覽</h4>

      <p class="section-label">最早 10 筆</p>
      <div class="preview-table">
        <div v-for="(r, i) in preview.first10" :key="'f'+i" class="preview-row">
          <span class="pr-date">{{ r.date }}</span>
          <span class="pr-type" :class="r.type">{{ r.type === 'income' ? '收' : '支' }}</span>
          <span class="pr-cat">{{ resolveCategoryDisplay(r) }}</span>
          <span class="pr-amount">${{ r.amount.toLocaleString() }}</span>
          <span class="pr-account">{{ r.account }}</span>
        </div>
      </div>

      <p class="section-label omit" v-if="rangeCount > 20">── 中間省略 {{ (rangeCount - 20).toLocaleString() }} 筆 ──</p>

      <p class="section-label">最晚 10 筆</p>
      <div class="preview-table">
        <div v-for="(r, i) in preview.last10" :key="'l'+i" class="preview-row">
          <span class="pr-date">{{ r.date }}</span>
          <span class="pr-type" :class="r.type">{{ r.type === 'income' ? '收' : '支' }}</span>
          <span class="pr-cat">{{ resolveCategoryDisplay(r) }}</span>
          <span class="pr-amount">${{ r.amount.toLocaleString() }}</span>
          <span class="pr-account">{{ r.account }}</span>
        </div>
      </div>

      <div class="preview-stats">
        <p>此區間共 {{ rangeCount.toLocaleString() }} 筆（支出 {{ expenseCount.toLocaleString() }} / 收入 {{ incomeCount.toLocaleString() }}）</p>
        <p>預估重複 {{ duplicateCount }} 筆將跳過</p>
      </div>

      <div class="actions">
        <button @click="step = 'range'" class="back-btn">返回調整</button>
        <button @click="doImport" class="next-btn">確認匯入</button>
      </div>
    </div>

    <!-- Step 4: Importing -->
    <div v-if="step === 'importing'">
      <p>匯入中... {{ importProgress.current }} / {{ importProgress.total }}</p>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Step 5: Done -->
    <div v-if="step === 'done'">
      <div class="done-msg">
        <p>匯入完成！</p>
        <p>新增 {{ importResult.added.toLocaleString() }} 筆</p>
        <p>新增分類 {{ importResult.categoriesAdded }} 個</p>
        <p>跳過重複 {{ importResult.skipped.toLocaleString() }} 筆</p>
      </div>
      <button @click="reset" class="next-btn">完成</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import {
  openIDB, parseDateRange, parseCategories, parseAccounts,
  parseRecords, getRecordCount, getPreviewRecords
} from '../services/cwmoney-parser.js'

const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const step = ref('select')
const error = ref('')
const loading = ref(false)

let sqliteDb = null
let cwCategories = null
let cwAccounts = null

const dateRange = ref({ min: '', max: '', count: 0 })
const startDate = ref('')
const endDate = ref('')
const rangeCount = ref(0)
const preview = ref({ first10: [], last10: [] })
const expenseCount = ref(0)
const incomeCount = ref(0)
const duplicateCount = ref(0)

const importProgress = ref({ current: 0, total: 0 })
const importResult = ref({ added: 0, skipped: 0, categoriesAdded: 0 })
const progressPercent = computed(() => {
  if (!importProgress.value.total) return 0
  return Math.round((importProgress.value.current / importProgress.value.total) * 100)
})

// CWMoney category lookup for display in preview
let cwCategoryLookup = {}

function buildCategoryLookup() {
  if (!cwCategories) return
  cwCategoryLookup = {}
  for (const p of cwCategories.expenseParents) {
    cwCategoryLookup[`expense_parent_${p.cwId}`] = p.name
  }
  for (const c of cwCategories.expenseChildren) {
    const parentName = cwCategoryLookup[`expense_parent_${c.cwParentId}`] || ''
    cwCategoryLookup[`expense_child_${c.cwId}`] = `${parentName}/${c.name}`
  }
  for (const p of cwCategories.incomeParents) {
    cwCategoryLookup[`income_parent_${p.cwId}`] = p.name
  }
  for (const c of cwCategories.incomeChildren) {
    const parentName = cwCategoryLookup[`income_parent_${c.cwParentId}`] || ''
    cwCategoryLookup[`income_child_${c.cwId}`] = `${parentName}/${c.name}`
  }
}

function resolveCategoryDisplay(record) {
  const prefix = record.type === 'income' ? 'income' : 'expense'
  return cwCategoryLookup[`${prefix}_child_${record.cwKinds}`]
    || cwCategoryLookup[`${prefix}_parent_${record.cwKind}`]
    || '未分類'
}

async function onFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  error.value = ''
  loading.value = true
  try {
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

async function loadPreview() {
  if (!sqliteDb) return
  loading.value = true
  try {
    rangeCount.value = getRecordCount(sqliteDb, startDate.value, endDate.value)
    const categoryMap = buildCategoryMap()
    preview.value = getPreviewRecords(sqliteDb, startDate.value, endDate.value, cwAccounts, categoryMap)

    // Count expense/income
    const allForCount = parseRecords(sqliteDb, startDate.value, endDate.value, cwAccounts, categoryMap)
    expenseCount.value = allForCount.filter(r => r.type === 'expense').length
    incomeCount.value = allForCount.filter(r => r.type === 'income').length

    // Estimate duplicates (quick check — loads existing transactions)
    await txStore.loadAll()
    let dupes = 0
    for (const r of allForCount) {
      // For duplicate check, we need to map CWMoney category to MoneyMan category ID
      // At preview stage, we just estimate using date+amount
      const exists = txStore.transactions.some(t =>
        t.date === r.date && t.amount === r.amount
      )
      if (exists) dupes++
    }
    duplicateCount.value = dupes

    step.value = 'preview'
  } catch (err) {
    error.value = '預覽載入失敗：' + err.message
  } finally {
    loading.value = false
  }
}

function buildCategoryMap() {
  // This is used by parser to attach cwKind/cwKinds metadata
  // The actual MoneyMan category IDs are resolved during import
  return { expense: {}, income: {} }
}

async function doImport() {
  step.value = 'importing'
  const records = parseRecords(sqliteDb, startDate.value, endDate.value, cwAccounts, buildCategoryMap())
  importProgress.value = { current: 0, total: records.length }

  // 1. Create categories and build CWMoney→MoneyMan ID mapping
  const catMapping = await importCategories()
  importResult.value.categoriesAdded = catMapping.newCount

  // 2. Import transactions
  await txStore.loadAll()
  let added = 0
  let skipped = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const type = r.type
    const prefix = type === 'income' ? 'income' : 'expense'

    // Resolve MoneyMan category/subcategory IDs
    const parentCatId = catMapping[`${prefix}_parent_${r.cwKind}`] || null
    const subCatId = catMapping[`${prefix}_child_${r.cwKinds}`] || null

    // Check duplicate
    if (txStore.isDuplicate({
      amount: r.amount,
      category: parentCatId,
      subcategory: subCatId,
      date: r.date
    })) {
      skipped++
    } else {
      await txStore.addTransaction({
        amount: r.amount,
        type: r.type,
        category: parentCatId,
        subcategory: subCatId,
        channel: null,
        cardId: null,
        date: r.date,
        note: r.note,
        account: r.account
      })
      added++
    }

    importProgress.value.current = i + 1
  }

  importResult.value.added = added
  importResult.value.skipped = skipped
  step.value = 'done'
}

async function importCategories() {
  const mapping = { newCount: 0 }
  if (!cwCategories) return mapping

  await catStore.init()

  // Default color/icon for imported categories
  const defaultColors = ['#F44336', '#2196F3', '#9C27B0', '#FF9800', '#795548', '#E91E63', '#3F51B5', '#00BCD4', '#8BC34A', '#CDDC39', '#607D8B', '#FF5722']
  let colorIdx = 0
  const nextColor = () => defaultColors[colorIdx++ % defaultColors.length]

  async function ensureParent(name, type) {
    const existing = catStore.categories.find(c => c.name === name && c.type === type && c.parentId === null)
    if (existing) return existing.id
    const id = await catStore.addCategory({ name, color: nextColor(), icon: '📁', type, parentId: null })
    mapping.newCount++
    return id
  }

  async function ensureChild(name, parentId, type) {
    const existing = catStore.categories.find(c => c.name === name && c.parentId === parentId)
    if (existing) return existing.id
    const parent = catStore.categories.find(c => c.id === parentId)
    const id = await catStore.addCategory({ name, color: parent?.color || nextColor(), icon: '📌', type, parentId })
    mapping.newCount++
    return id
  }

  // Expense parents
  for (const p of cwCategories.expenseParents) {
    const id = await ensureParent(p.name, 'expense')
    mapping[`expense_parent_${p.cwId}`] = id
  }
  // Expense children
  for (const c of cwCategories.expenseChildren) {
    const parentId = mapping[`expense_parent_${c.cwParentId}`]
    if (parentId) {
      const id = await ensureChild(c.name, parentId, 'expense')
      mapping[`expense_child_${c.cwId}`] = id
    }
  }
  // Income parents
  for (const p of cwCategories.incomeParents) {
    const id = await ensureParent(p.name, 'income')
    mapping[`income_parent_${p.cwId}`] = id
  }
  // Income children
  for (const c of cwCategories.incomeChildren) {
    const parentId = mapping[`income_parent_${c.cwParentId}`]
    if (parentId) {
      const id = await ensureChild(c.name, parentId, 'income')
      mapping[`income_child_${c.cwId}`] = id
    }
  }

  return mapping
}

function reset() {
  step.value = 'select'
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null }
  cwCategories = null
  cwAccounts = null
  cwCategoryLookup = {}
  error.value = ''
  preview.value = { first10: [], last10: [] }
  importResult.value = { added: 0, skipped: 0, categoriesAdded: 0 }
}
</script>

<style scoped>
.import-cwmoney { margin-top: 8px; }
.select-btn { padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.error { color: #F44336; margin-top: 8px; font-size: 13px; }
.range-info { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
.range-inputs { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.range-inputs input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.range-count { font-size: 13px; color: #666; margin-bottom: 12px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.back-btn { padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }
.next-btn { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; }
.next-btn:disabled { background: #ccc; }
.loading { text-align: center; color: #999; padding: 16px; }
.section-label { font-size: 13px; color: #666; margin: 12px 0 4px; font-weight: bold; }
.section-label.omit { text-align: center; color: #999; font-weight: normal; margin: 16px 0; }
.preview-table { font-size: 13px; }
.preview-row { display: flex; gap: 6px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; align-items: center; }
.pr-date { width: 85px; flex-shrink: 0; }
.pr-type { width: 24px; flex-shrink: 0; font-size: 12px; text-align: center; }
.pr-type.expense { color: #F44336; }
.pr-type.income { color: #4CAF50; }
.pr-cat { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-amount { width: 70px; text-align: right; flex-shrink: 0; }
.pr-account { width: 70px; flex-shrink: 0; font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-stats { background: #E8F5E9; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 13px; }
.progress-bar { height: 8px; background: #eee; border-radius: 4px; margin-top: 12px; }
.progress-fill { height: 100%; background: #4CAF50; border-radius: 4px; transition: width 0.3s; }
.done-msg { background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
.done-msg p { margin: 4px 0; }
</style>
```

**Step 2: Commit**

```bash
git add src/components/ImportCWMoney.vue
git commit -m "feat: add ImportCWMoney wizard component"
```

---

### Task 7: Update AddView — 2-level categories + account

**Files:**
- Modify: `src/views/AddView.vue`

**Step 1: Update AddView template and script**

Key changes:
1. Category grid → two-level: first pick parent, then pick sub-category
2. Sub-category defaults to first child
3. New account field, default '現金'
4. `form.category` stores ID, not name

```vue
<template>
  <div class="add-view">
    <h2>{{ isEdit ? '編輯紀錄' : '新增紀錄' }}</h2>

    <div class="type-toggle">
      <button :class="{ active: form.type === 'expense' }" @click="switchType('expense')">支出</button>
      <button :class="{ active: form.type === 'income' }" @click="switchType('income')">收入</button>
    </div>

    <div class="form-group">
      <label>金額</label>
      <input type="number" v-model.number="form.amount" placeholder="0" inputmode="decimal" />
    </div>

    <div class="form-group">
      <label>日期</label>
      <input type="date" v-model="form.date" />
    </div>

    <div class="form-group">
      <label>大分類</label>
      <div class="category-grid">
        <button
          v-for="cat in parentCategories"
          :key="cat.id"
          :class="{ active: form.category === cat.id }"
          @click="selectParent(cat.id)"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
    </div>

    <div class="form-group" v-if="childCategories.length">
      <label>子分類</label>
      <div class="category-grid">
        <button
          v-for="cat in childCategories"
          :key="cat.id"
          :class="{ active: form.subcategory === cat.id }"
          @click="form.subcategory = cat.id"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
    </div>

    <div class="form-group">
      <label>帳戶</label>
      <input type="text" v-model="form.account" placeholder="現金" />
    </div>

    <div class="form-group" v-if="form.type === 'expense'">
      <label>通路</label>
      <select v-model="form.channel">
        <option value="一般">一般</option>
        <option value="網購">網購</option>
        <option value="超商">超商</option>
        <option value="餐飲">餐飲</option>
        <option value="交通">交通</option>
      </select>
    </div>

    <div class="form-group" v-if="form.type === 'expense' && cardsStore.cards.length">
      <label>信用卡</label>
      <select v-model="form.cardId">
        <option :value="null">不指定</option>
        <option v-for="card in cardsStore.cards" :key="card.id" :value="card.id">
          {{ card.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>備註</label>
      <input type="text" v-model="form.note" placeholder="選填" />
    </div>

    <button class="save-btn" @click="save" :disabled="!form.amount">
      {{ isEdit ? '更新' : '儲存' }}
    </button>

    <button v-if="isEdit" class="delete-btn" @click="remove">刪除此筆</button>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import { useCardsStore } from '../stores/cards.js'
import { getRecord } from '../services/db.js'

const route = useRoute()
const router = useRouter()
const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
const cardsStore = useCardsStore()

const isEdit = computed(() => !!route.params.id)
const today = new Date().toISOString().split('T')[0]

const form = reactive({
  amount: null,
  type: 'expense',
  category: null,
  subcategory: null,
  channel: '一般',
  cardId: null,
  date: today,
  note: '',
  account: '現金'
})

const parentCategories = computed(() => categoriesStore.getParents(form.type))
const childCategories = computed(() => {
  if (!form.category) return []
  return categoriesStore.getChildren(form.category)
})

function selectParent(id) {
  form.category = id
  const children = categoriesStore.getChildren(id)
  form.subcategory = children.length > 0 ? children[0].id : null
}

function switchType(type) {
  form.type = type
  form.category = null
  form.subcategory = null
  // Auto-select first parent category
  const parents = categoriesStore.getParents(type)
  if (parents.length) selectParent(parents[0].id)
}

onMounted(async () => {
  await categoriesStore.init()
  await cardsStore.init()
  if (route.params.id) {
    const tx = await getRecord('transactions', Number(route.params.id))
    if (tx) Object.assign(form, tx)
  } else {
    // Default: select first parent category
    const parents = categoriesStore.getParents(form.type)
    if (parents.length) selectParent(parents[0].id)
  }
})

async function save() {
  if (!form.amount) return
  if (isEdit.value) {
    await txStore.editTransaction({ ...form, id: Number(route.params.id) })
  } else {
    await txStore.addTransaction({ ...form })
  }
  router.push('/')
}

async function remove() {
  if (!confirm('確定刪除這筆紀錄？')) return
  try {
    await txStore.deleteTransaction(Number(route.params.id))
    router.push('/')
  } catch (e) {
    alert('刪除失敗：' + e.message)
  }
}
</script>
```

Keep existing `<style scoped>` unchanged.

**Step 2: Commit**

```bash
git add src/views/AddView.vue
git commit -m "feat: update AddView with 2-level categories and account field"
```

---

### Task 8: Update SettingsView — tree categories + import section

**Files:**
- Modify: `src/views/SettingsView.vue`

**Step 1: Update SettingsView**

Key changes:
1. Category management shows tree structure (parent → children)
2. New/edit category includes type and parentId selection
3. New "匯入 CWMoney 資料" section with ImportCWMoney component

The category management section becomes:

```vue
<section>
  <h3>分類管理</h3>
  <div class="type-tabs">
    <button :class="{ active: catTypeTab === 'expense' }" @click="catTypeTab = 'expense'">支出</button>
    <button :class="{ active: catTypeTab === 'income' }" @click="catTypeTab = 'income'">收入</button>
  </div>
  <div v-for="parent in displayParents" :key="parent.id" class="cat-group">
    <div class="cat-item parent-cat">
      <template v-if="editingCatId === parent.id">
        <div class="edit-cat">
          <input v-model="editCatIcon" class="icon-input" />
          <input v-model="editCatName" class="name-input" />
          <button @click="saveEditCat(parent)" class="save-edit-btn">存</button>
          <button @click="editingCatId = null" class="cancel-edit-btn">取消</button>
        </div>
      </template>
      <template v-else>
        <span>{{ parent.icon }} <strong>{{ parent.name }}</strong></span>
        <div class="cat-actions">
          <button @click="startEditCat(parent)" class="edit-btn">編輯</button>
          <button @click="deleteCat(parent.id)" class="delete-btn">刪除</button>
        </div>
      </template>
    </div>
    <div v-for="child in categoriesStore.getChildren(parent.id)" :key="child.id" class="cat-item child-cat">
      <template v-if="editingCatId === child.id">
        <div class="edit-cat">
          <input v-model="editCatIcon" class="icon-input" />
          <input v-model="editCatName" class="name-input" />
          <button @click="saveEditCat(child)" class="save-edit-btn">存</button>
          <button @click="editingCatId = null" class="cancel-edit-btn">取消</button>
        </div>
      </template>
      <template v-else>
        <span>└ {{ child.icon }} {{ child.name }}</span>
        <div class="cat-actions">
          <button @click="startEditCat(child)" class="edit-btn">編輯</button>
          <button @click="deleteCat(child.id)" class="delete-btn">刪除</button>
        </div>
      </template>
    </div>
  </div>
  <div class="add-cat">
    <select v-model="newCatParentId" class="parent-select">
      <option :value="null">新增大分類</option>
      <option v-for="p in displayParents" :key="p.id" :value="p.id">{{ p.name }} 的子分類</option>
    </select>
    <input v-model="newCatName" placeholder="分類名稱" />
    <button @click="addCat">新增</button>
  </div>
</section>
```

Add the import section before the Google Drive section:

```vue
<section>
  <h3>匯入 CWMoney 資料</h3>
  <ImportCWMoney />
</section>
```

Update the script to import and use the new component + logic:

```js
import ImportCWMoney from '../components/ImportCWMoney.vue'

const catTypeTab = ref('expense')
const newCatParentId = ref(null)

const displayParents = computed(() => categoriesStore.getParents(catTypeTab.value))

async function addCat() {
  if (!newCatName.value.trim()) return
  await categoriesStore.addCategory({
    name: newCatName.value.trim(),
    color: '#607D8B',
    icon: '📌',
    type: catTypeTab.value,
    parentId: newCatParentId.value
  })
  newCatName.value = ''
  newCatParentId.value = null
}
```

Add styles for the new elements:

```css
.type-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.type-tabs button { flex: 1; padding: 6px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; }
.type-tabs button.active { background: #4CAF50; color: white; border-color: #4CAF50; }
.cat-group { margin-bottom: 4px; }
.parent-cat { font-weight: 500; }
.child-cat { padding-left: 16px; }
.parent-select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
```

**Step 2: Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat: update SettingsView with tree categories and CWMoney import"
```

---

### Task 9: Update HomeView — display category by ID

**Files:**
- Modify: `src/views/HomeView.vue`

**Step 1: Update HomeView**

In the `<script setup>`, import categoriesStore:

```js
import { useCategoriesStore } from '../stores/categories.js'
const categoriesStore = useCategoriesStore()
```

In `onMounted`, add:

```js
await categoriesStore.init()
```

In the template, replace the category display line:

```html
<!-- OLD -->
<span class="tx-category">{{ tx.category }}</span>
<!-- NEW -->
<span class="tx-category">{{ categoriesStore.getFullCategoryName(tx.category, tx.subcategory) }}</span>
```

**Step 2: Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat: update HomeView to display categories by ID lookup"
```

---

### Task 10: Update ReportView and ReconcileView

**Files:**
- Modify: `src/views/ReportView.vue`
- Modify: `src/views/ReconcileView.vue`

**Step 1: Update ReportView**

Import categoriesStore and init in onMounted. The `getCategoryBreakdown` in transactions store already resolves names (updated in Task 4), so PieChart receives `{ [name]: amount }` — no template changes needed.

```js
import { useCategoriesStore } from '../stores/categories.js'
const categoriesStore = useCategoriesStore()

onMounted(async () => {
  await categoriesStore.init()
  await txStore.loadAll()
})
```

**Step 2: Update ReconcileView quickAdd**

Update the `quickAdd` function to include new fields:

```js
async function quickAdd(billItem) {
  await txStore.addTransaction({
    amount: billItem.amount,
    type: 'expense',
    category: null,
    subcategory: null,
    channel: '一般',
    cardId: null,
    date: billItem.date,
    note: billItem.merchant,
    account: null
  })
  const rangeTxs = txStore.getTransactionsByDateRange(reconcileStore.dateStart, reconcileStore.dateEnd)
  reconcileStore.setResults(reconcile(reconcileStore.parsedBillItems, rangeTxs))
}
```

**Step 3: Commit**

```bash
git add src/views/ReportView.vue src/views/ReconcileView.vue
git commit -m "feat: update ReportView and ReconcileView for category hierarchy"
```

---

### Task 11: App startup migration call

**Files:**
- Modify: `src/App.vue` or `src/main.js`

**Step 1: Check main.js for app entry**

Read `src/main.js` to find the app initialization.

**Step 2: Call migrateData on startup**

In `src/main.js` (or wherever the app mounts), add the migration call before mounting:

```js
import { migrateData } from './services/db.js'

// Run data migration before mounting app
await migrateData()

app.mount('#app')
```

This ensures old-format data is migrated to the new schema before any views load.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: run data migration on app startup"
```

---

### Task 12: Run all tests and fix any failures

**Step 1: Run full test suite**

Run: `npx vitest run`

**Step 2: Fix any failing tests**

Update test files that still reference old category-as-name format. Key files to check:
- `src/__tests__/services/db.test.js` — may need `clearStore('categories')` in beforeEach
- `src/__tests__/stores/transactions.test.js` — already updated in Task 4
- `src/__tests__/stores/categories.test.js` — already updated in Task 3

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit any test fixes**

```bash
git add -u
git commit -m "fix: update tests for v2 schema and category hierarchy"
```

---

### Task 13: Manual integration test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test checklist**

- [ ] Open app — existing data should migrate (categories get type/parentId)
- [ ] Add new transaction — 2-level category picker works, account defaults to "現金"
- [ ] Switching income/expense shows correct category types
- [ ] Settings → 分類管理 shows tree structure with 支出/收入 tabs
- [ ] Settings → 匯入 CWMoney → select .iDB file
- [ ] Date range auto-detected and displayed
- [ ] Adjust date range, click preview
- [ ] Preview shows first 10 + last 10 records
- [ ] Click "確認匯入", progress bar works
- [ ] Import completes with summary
- [ ] New categories appear in tree view
- [ ] Imported transactions show on homepage
- [ ] Report page PieChart shows correct category names
- [ ] Google Drive backup/restore still works with new fields
