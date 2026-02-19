# MoneyMan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform expense tracking PWA with credit card reward optimization and PDF bill reconciliation.

**Architecture:** Vue 3 SPA with Pinia stores backed by IndexedDB for local persistence. Business logic (recommendation engine, reconciliation) lives in pure JS service modules, testable without Vue. Google Drive API for manual cross-device sync.

**Tech Stack:** Vue 3, Vite, Pinia, Vue Router, IndexedDB (via idb), Chart.js (via vue-chartjs), pdf.js, Vitest, @vue/test-utils

---

## Phase 1: Project Scaffolding & Core Infrastructure

### Task 1: Scaffold Vue 3 + Vite Project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.vue`

**Step 1: Create Vue 3 project with Vite**

Run:
```bash
cd /c/Users/Xun_Desk/Projects/Mobile/MoneyMan
npm create vite@latest . -- --template vue
```

Select: Vue, JavaScript

**Step 2: Install core dependencies**

```bash
npm install vue-router@4 pinia idb chart.js vue-chartjs pdfjs-dist
```

**Step 3: Install dev dependencies**

```bash
npm install -D vitest @vue/test-utils jsdom @vitejs/plugin-vue vite-plugin-pwa
```

**Step 4: Configure Vite with PWA plugin**

Modify: `vite.config.js`

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoneyMan',
        short_name: 'MoneyMan',
        description: '跨平台記帳 App，信用卡回饋追蹤與智慧推薦',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true
  }
})
```

**Step 5: Add placeholder icons**

Create: `public/icons/` directory with placeholder PNG files (can be replaced later).

**Step 6: Verify project runs**

Run: `npm run dev`
Expected: Vite dev server starts, app loads in browser.

**Step 7: Verify tests work**

Create: `src/__tests__/sanity.test.js`

```js
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npx vitest run`
Expected: 1 test passes.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vue 3 + Vite project with PWA support"
```

---

### Task 2: Vue Router Setup with App Shell

**Files:**
- Create: `src/router/index.js`
- Modify: `src/App.vue`
- Create: `src/views/HomeView.vue`
- Create: `src/views/AddView.vue`
- Create: `src/views/ReportView.vue`
- Create: `src/views/CardsView.vue`
- Create: `src/views/ReconcileView.vue`
- Create: `src/views/SettingsView.vue`

**Step 1: Create router**

Create: `src/router/index.js`

```js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/add', name: 'add', component: () => import('../views/AddView.vue') },
  { path: '/add/:id', name: 'edit', component: () => import('../views/AddView.vue') },
  { path: '/report', name: 'report', component: () => import('../views/ReportView.vue') },
  { path: '/cards', name: 'cards', component: () => import('../views/CardsView.vue') },
  { path: '/reconcile', name: 'reconcile', component: () => import('../views/ReconcileView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

**Step 2: Create stub views**

Create each view file with minimal template:

`src/views/HomeView.vue`
```vue
<template>
  <div class="home-view">
    <h1>MoneyMan</h1>
    <p>首頁</p>
  </div>
</template>
```

Repeat pattern for all 6 views (AddView, ReportView, CardsView, ReconcileView, SettingsView) with appropriate titles.

**Step 3: Create App.vue with bottom navigation**

```vue
<template>
  <div id="app">
    <main class="app-content">
      <router-view />
    </main>
    <nav class="bottom-nav">
      <router-link to="/" class="nav-item">首頁</router-link>
      <router-link to="/add" class="nav-item">記帳</router-link>
      <router-link to="/report" class="nav-item">報表</router-link>
      <router-link to="/cards" class="nav-item">卡片</router-link>
      <router-link to="/settings" class="nav-item">設定</router-link>
    </nav>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.app-content { padding: 16px; padding-bottom: 72px; }
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-around;
  background: #fff; border-top: 1px solid #eee;
  padding: 8px 0; z-index: 100;
}
.nav-item {
  text-decoration: none; color: #666;
  font-size: 12px; text-align: center; padding: 4px 8px;
}
.nav-item.router-link-active { color: #4CAF50; font-weight: bold; }
</style>
```

**Step 4: Update main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

**Step 5: Verify navigation works**

Run: `npm run dev`
Expected: All 6 routes navigable via bottom nav, active route highlighted green.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Vue Router with app shell and bottom navigation"
```

---

### Task 3: IndexedDB Service

**Files:**
- Create: `src/services/db.js`
- Create: `src/__tests__/services/db.test.js`

**Step 1: Write failing tests for DB service**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { initDB, addRecord, getRecords, updateRecord, deleteRecord } from '../../services/db.js'

describe('db service', () => {
  beforeEach(async () => {
    const db = await initDB()
    const tx = db.transaction('transactions', 'readwrite')
    await tx.objectStore('transactions').clear()
    await tx.done
  })

  it('adds and retrieves a transaction', async () => {
    const record = {
      amount: 100,
      type: 'expense',
      category: '飲食',
      channel: '超商',
      cardId: null,
      date: '2026-02-19',
      note: '午餐'
    }
    const id = await addRecord('transactions', record)
    expect(id).toBeDefined()

    const records = await getRecords('transactions')
    expect(records).toHaveLength(1)
    expect(records[0].amount).toBe(100)
    expect(records[0].category).toBe('飲食')
  })

  it('updates a transaction', async () => {
    const id = await addRecord('transactions', { amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    await updateRecord('transactions', { id, amount: 200, type: 'expense', category: '飲食', date: '2026-02-19' })

    const records = await getRecords('transactions')
    expect(records[0].amount).toBe(200)
  })

  it('deletes a transaction', async () => {
    const id = await addRecord('transactions', { amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    await deleteRecord('transactions', id)

    const records = await getRecords('transactions')
    expect(records).toHaveLength(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: FAIL — module not found

**Step 3: Implement DB service**

Create: `src/services/db.js`

```js
import { openDB } from 'idb'

const DB_NAME = 'moneyman'
const DB_VERSION = 1

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
        txStore.createIndex('date', 'date')
        txStore.createIndex('category', 'category')
        txStore.createIndex('cardId', 'cardId')
      }
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export async function addRecord(storeName, record) {
  const db = await initDB()
  return db.add(storeName, record)
}

export async function getRecords(storeName) {
  const db = await initDB()
  return db.getAll(storeName)
}

export async function getRecord(storeName, id) {
  const db = await initDB()
  return db.get(storeName, id)
}

export async function updateRecord(storeName, record) {
  const db = await initDB()
  return db.put(storeName, record)
}

export async function deleteRecord(storeName, id) {
  const db = await initDB()
  return db.delete(storeName, id)
}

export async function getRecordsByIndex(storeName, indexName, value) {
  const db = await initDB()
  return db.getAllFromIndex(storeName, indexName, value)
}

export async function clearStore(storeName) {
  const db = await initDB()
  const tx = db.transaction(storeName, 'readwrite')
  await tx.objectStore(storeName).clear()
  await tx.done
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: 3 tests pass.

Note: If `fake-indexeddb` is needed for test environment, install it:
```bash
npm install -D fake-indexeddb
```
And add to vitest setup:
```js
// vitest.setup.js
import 'fake-indexeddb/auto'
```
Update `vite.config.js` test section:
```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./vitest.setup.js']
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add IndexedDB service with CRUD operations"
```

---

## Phase 2: Categories & Transactions

### Task 4: Categories Store with Default Data

**Files:**
- Create: `src/stores/categories.js`
- Create: `src/__tests__/stores/categories.test.js`

**Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCategoriesStore } from '../../stores/categories.js'

describe('categories store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads default categories', async () => {
    const store = useCategoriesStore()
    await store.init()
    expect(store.categories.length).toBeGreaterThanOrEqual(7)
    expect(store.categories.map(c => c.name)).toContain('飲食')
  })

  it('adds a custom category', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    await store.addCategory({ name: '寵物', color: '#FF9800', icon: '🐕' })
    expect(store.categories.length).toBe(before + 1)
  })

  it('deletes a category', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    const catId = store.categories[0].id
    await store.deleteCategory(catId)
    expect(store.categories.length).toBe(before - 1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/categories.test.js`
Expected: FAIL

**Step 3: Implement categories store**

Create: `src/stores/categories.js`

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, deleteRecord, clearStore } from '../services/db.js'

const DEFAULT_CATEGORIES = [
  { name: '飲食', color: '#F44336', icon: '🍔' },
  { name: '交通', color: '#2196F3', icon: '🚗' },
  { name: '娛樂', color: '#9C27B0', icon: '🎮' },
  { name: '購物', color: '#FF9800', icon: '🛍️' },
  { name: '居家', color: '#795548', icon: '🏠' },
  { name: '醫療', color: '#E91E63', icon: '💊' },
  { name: '教育', color: '#3F51B5', icon: '📚' }
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
  }

  async function deleteCategory(id) {
    await deleteRecord('categories', id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  return { categories, init, addCategory, deleteCategory }
})
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/stores/categories.test.js`
Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add categories store with default data"
```

---

### Task 5: Transactions Store

**Files:**
- Create: `src/stores/transactions.js`
- Create: `src/__tests__/stores/transactions.test.js`

**Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions.js'
import { clearStore } from '../../services/db.js'

describe('transactions store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('transactions')
  })

  it('adds a transaction', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({
      amount: 150,
      type: 'expense',
      category: '飲食',
      channel: '超商',
      cardId: null,
      date: '2026-02-19',
      note: '午餐'
    })
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0].amount).toBe(150)
  })

  it('computes monthly totals', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 1000, type: 'income', category: '薪資', date: '2026-02-01' })
    await store.addTransaction({ amount: 300, type: 'expense', category: '飲食', date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: '交通', date: '2026-02-10' })

    const summary = store.getMonthlySummary(2026, 2)
    expect(summary.income).toBe(1000)
    expect(summary.expense).toBe(500)
    expect(summary.balance).toBe(500)
  })

  it('computes category breakdown for a month', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 300, type: 'expense', category: '飲食', date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: '飲食', date: '2026-02-06' })
    await store.addTransaction({ amount: 100, type: 'expense', category: '交通', date: '2026-02-07' })

    const breakdown = store.getCategoryBreakdown(2026, 2)
    expect(breakdown['飲食']).toBe(500)
    expect(breakdown['交通']).toBe(100)
  })

  it('deletes a transaction', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    const id = store.transactions[0].id
    await store.deleteTransaction(id)
    expect(store.transactions).toHaveLength(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: FAIL

**Step 3: Implement transactions store**

Create: `src/stores/transactions.js`

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

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
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const breakdown = {}
    for (const t of txs) {
      breakdown[t.category] = (breakdown[t.category] || 0) + t.amount
    }
    return breakdown
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

  return {
    transactions, loadAll, addTransaction, editTransaction, deleteTransaction,
    getMonthTransactions, getMonthlySummary, getCategoryBreakdown, getDailyTotals
  }
})
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add transactions store with monthly summary and category breakdown"
```

---

### Task 6: Add Transaction View (記帳頁)

**Files:**
- Modify: `src/views/AddView.vue`

**Step 1: Implement AddView with form**

```vue
<template>
  <div class="add-view">
    <h2>{{ isEdit ? '編輯紀錄' : '新增紀錄' }}</h2>

    <div class="type-toggle">
      <button :class="{ active: form.type === 'expense' }" @click="form.type = 'expense'">支出</button>
      <button :class="{ active: form.type === 'income' }" @click="form.type = 'income'">收入</button>
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
      <label>分類</label>
      <div class="category-grid">
        <button
          v-for="cat in categoriesStore.categories"
          :key="cat.id"
          :class="{ active: form.category === cat.name }"
          @click="form.category = cat.name"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
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
  category: '',
  channel: '一般',
  cardId: null,
  date: today,
  note: ''
})

onMounted(async () => {
  await categoriesStore.init()
  await cardsStore.init()
  if (route.params.id) {
    const tx = await getRecord('transactions', Number(route.params.id))
    if (tx) Object.assign(form, tx)
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
</script>

<style scoped>
.add-view { max-width: 480px; margin: 0 auto; }
.type-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
.type-toggle button {
  flex: 1; padding: 8px; border: 1px solid #ddd; background: #fff;
  border-radius: 8px; cursor: pointer;
}
.type-toggle button.active { background: #4CAF50; color: white; border-color: #4CAF50; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 14px; color: #666; margin-bottom: 4px; }
.form-group input, .form-group select {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;
}
.category-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.category-grid button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 14px;
}
.category-grid button.active { background: #E8F5E9; border-color: #4CAF50; }
.save-btn {
  width: 100%; padding: 14px; background: #4CAF50; color: white;
  border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 16px;
}
.save-btn:disabled { background: #ccc; }
</style>
```

**Step 2: Verify form works**

Run: `npm run dev`
Expected: Navigate to /add, fill form, save → redirects to home.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add transaction form view with category and card selection"
```

---

### Task 7: Home View (首頁)

**Files:**
- Modify: `src/views/HomeView.vue`

**Step 1: Implement HomeView**

```vue
<template>
  <div class="home-view">
    <h2>MoneyMan</h2>

    <div class="month-nav">
      <button @click="prevMonth">&lt;</button>
      <span>{{ year }}年 {{ month }}月</span>
      <button @click="nextMonth">&gt;</button>
    </div>

    <div class="summary-card">
      <div class="summary-row">
        <span>收入</span>
        <span class="income">+${{ summary.income.toLocaleString() }}</span>
      </div>
      <div class="summary-row">
        <span>支出</span>
        <span class="expense">-${{ summary.expense.toLocaleString() }}</span>
      </div>
      <div class="summary-row total">
        <span>結餘</span>
        <span :class="summary.balance >= 0 ? 'income' : 'expense'">
          ${{ summary.balance.toLocaleString() }}
        </span>
      </div>
    </div>

    <!-- Card progress bars will be added in Phase 3 -->

    <h3>最近紀錄</h3>
    <div v-if="recentTx.length === 0" class="empty">還沒有紀錄</div>
    <div v-for="tx in recentTx" :key="tx.id" class="tx-item" @click="editTx(tx.id)">
      <div class="tx-left">
        <span class="tx-category">{{ tx.category }}</span>
        <span class="tx-note">{{ tx.note || tx.channel || '' }}</span>
      </div>
      <span :class="tx.type === 'income' ? 'income' : 'expense'">
        {{ tx.type === 'income' ? '+' : '-' }}${{ tx.amount.toLocaleString() }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '../stores/transactions.js'

const router = useRouter()
const txStore = useTransactionsStore()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

const summary = computed(() => txStore.getMonthlySummary(year.value, month.value))
const recentTx = computed(() =>
  txStore.getMonthTransactions(year.value, month.value)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
)

function prevMonth() {
  if (month.value === 1) { month.value = 12; year.value-- }
  else month.value--
}
function nextMonth() {
  if (month.value === 12) { month.value = 1; year.value++ }
  else month.value++
}
function editTx(id) { router.push(`/add/${id}`) }

onMounted(() => txStore.loadAll())
</script>

<style scoped>
.month-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.month-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.summary-card { background: #f9f9f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
.summary-row.total { border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-weight: bold; }
.income { color: #4CAF50; }
.expense { color: #F44336; }
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
}
.tx-left { display: flex; flex-direction: column; }
.tx-category { font-weight: 500; }
.tx-note { font-size: 12px; color: #999; }
.empty { text-align: center; color: #999; padding: 40px 0; }
</style>
```

**Step 2: Verify home view works**

Run: `npm run dev`
Expected: Home shows monthly summary, recent transactions, month navigation.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add home view with monthly summary and recent transactions"
```

---

## Phase 3: Credit Card Management & Recommendation

### Task 8: Cards Store

**Files:**
- Create: `src/stores/cards.js`
- Create: `src/data/cards-config.json`
- Create: `src/__tests__/stores/cards.test.js`

**Step 1: Create default cards config**

Create: `src/data/cards-config.json`

```json
{
  "lastUpdated": "2026-02-19",
  "cards": []
}
```

**Step 2: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCardsStore } from '../../stores/cards.js'
import { clearStore } from '../../services/db.js'

describe('cards store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('cards')
  })

  it('adds a card', async () => {
    const store = useCardsStore()
    await store.init()
    await store.addCard({
      id: 'test-card',
      name: '測試卡',
      bank: '測試銀行',
      billingCycleDay: 15,
      thresholds: [],
      channelRules: [
        { channel: '一般', rate: 0.01, monthlyCap: null }
      ]
    })
    expect(store.cards).toHaveLength(1)
    expect(store.cards[0].name).toBe('測試卡')
  })

  it('deletes a card', async () => {
    const store = useCardsStore()
    await store.init()
    await store.addCard({ id: 'to-delete', name: '刪除測試', bank: 'X', billingCycleDay: 1, thresholds: [], channelRules: [] })
    await store.deleteCard('to-delete')
    expect(store.cards).toHaveLength(0)
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/stores/cards.test.js`
Expected: FAIL

**Step 4: Implement cards store**

Create: `src/stores/cards.js`

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

export const useCardsStore = defineStore('cards', () => {
  const cards = ref([])

  async function init() {
    cards.value = await getRecords('cards')
  }

  async function addCard(card) {
    await addRecord('cards', card)
    cards.value.push(card)
  }

  async function editCard(card) {
    await updateRecord('cards', card)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = card
  }

  async function deleteCard(id) {
    await deleteRecord('cards', id)
    cards.value = cards.value.filter(c => c.id !== id)
  }

  return { cards, init, addCard, editCard, deleteCard }
})
```

**Step 5: Run tests**

Run: `npx vitest run src/__tests__/stores/cards.test.js`
Expected: 2 tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add cards store and config JSON"
```

---

### Task 9: Recommendation Engine

**Files:**
- Create: `src/services/recommend.js`
- Create: `src/__tests__/services/recommend.test.js`

**Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest'
import { recommendCard } from '../../services/recommend.js'

const mockCards = [
  {
    id: 'card-a',
    name: '卡片A',
    billingCycleDay: 15,
    thresholds: [{ amount: 10000, rewardValue: 500 }],
    channelRules: [
      { channel: '網購', rate: 0.03, monthlyCap: 300 },
      { channel: '一般', rate: 0.01, monthlyCap: null }
    ]
  },
  {
    id: 'card-b',
    name: '卡片B',
    billingCycleDay: 20,
    thresholds: [{ amount: 8000, rewardValue: 200 }],
    channelRules: [
      { channel: '網購', rate: 0.05, monthlyCap: 100 },
      { channel: '一般', rate: 0.02, monthlyCap: null }
    ]
  }
]

describe('recommend engine', () => {
  it('ranks by channel reward rate when no cap is reached', () => {
    const spending = { 'card-a': 0, 'card-b': 0 }
    const channelSpending = { 'card-a': {}, 'card-b': {} }
    const result = recommendCard({
      cards: mockCards,
      channel: '網購',
      amount: 1000,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-b has 5% for 網購 vs card-a 3%
    expect(result[0].cardId).toBe('card-b')
  })

  it('deprioritizes card when monthly cap is reached', () => {
    const spending = { 'card-a': 0, 'card-b': 0 }
    const channelSpending = {
      'card-a': { '網購': 0 },
      'card-b': { '網購': 95 } // cap is 100, only $5 reward left
    }
    const result = recommendCard({
      cards: mockCards,
      channel: '網購',
      amount: 1000,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-b cap almost full, card-a should rank higher
    expect(result[0].cardId).toBe('card-a')
  })

  it('boosts cards close to threshold', () => {
    const spending = { 'card-a': 9500, 'card-b': 2000 }
    const channelSpending = { 'card-a': {}, 'card-b': {} }
    const result = recommendCard({
      cards: mockCards,
      channel: '一般',
      amount: 500,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-a is $500 from 10000 threshold (gets $500 bonus)
    expect(result[0].cardId).toBe('card-a')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/recommend.test.js`
Expected: FAIL

**Step 3: Implement recommendation engine**

Create: `src/services/recommend.js`

```js
/**
 * Recommends which credit card to use for a purchase.
 *
 * @param {Object} opts
 * @param {Array} opts.cards - Array of card objects with channelRules and thresholds
 * @param {string} opts.channel - Purchase channel (e.g. '網購', '超商')
 * @param {number} opts.amount - Purchase amount
 * @param {Object} opts.currentSpending - { cardId: totalSpent } for current billing cycle
 * @param {Object} opts.currentChannelSpending - { cardId: { channel: rewardEarned } }
 * @param {Date} opts.today - Current date
 * @returns {Array} Sorted recommendations, best first
 */
export function recommendCard({ cards, channel, amount, currentSpending, currentChannelSpending, today }) {
  const recommendations = cards.map(card => {
    const rule = card.channelRules.find(r => r.channel === channel)
      || card.channelRules.find(r => r.channel === '一般')

    if (!rule) return null

    const rate = rule.rate
    const rawReward = amount * rate

    // Check monthly cap
    const earnedSoFar = (currentChannelSpending[card.id] || {})[rule.channel] || 0
    const capRemaining = rule.monthlyCap != null ? Math.max(0, rule.monthlyCap - earnedSoFar) : Infinity
    const effectiveReward = Math.min(rawReward, capRemaining)

    // Threshold bonus
    const spent = currentSpending[card.id] || 0
    let thresholdBonus = 0
    let thresholdGap = Infinity
    for (const t of card.thresholds) {
      const gap = t.amount - spent
      if (gap > 0 && gap <= amount) {
        thresholdBonus += t.rewardValue
        thresholdGap = Math.min(thresholdGap, gap)
      }
    }

    // Days remaining in billing cycle
    const cycleDay = card.billingCycleDay
    const todayDay = today.getDate()
    const daysRemaining = cycleDay > todayDay
      ? cycleDay - todayDay
      : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - todayDay + cycleDay

    // Score: effective reward + threshold bonus, penalized if cap nearly full
    const totalReward = effectiveReward + thresholdBonus
    const capRatio = rule.monthlyCap != null ? capRemaining / rule.monthlyCap : 1
    const score = totalReward * (0.5 + 0.5 * capRatio)

    return {
      cardId: card.id,
      cardName: card.name,
      channel: rule.channel,
      rate,
      estimatedReward: effectiveReward,
      thresholdBonus,
      thresholdGap: thresholdGap === Infinity ? null : thresholdGap,
      currentSpent: spent,
      daysRemaining,
      score
    }
  }).filter(Boolean)

  return recommendations.sort((a, b) => b.score - a.score)
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/services/recommend.test.js`
Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add credit card recommendation engine"
```

---

### Task 10: Cards View & Card Progress Component

**Files:**
- Modify: `src/views/CardsView.vue`
- Create: `src/components/CardProgress.vue`
- Create: `src/components/CardRecommend.vue`

**Step 1: Implement CardProgress component**

Create: `src/components/CardProgress.vue`

```vue
<template>
  <div class="card-progress">
    <div class="card-header">
      <span class="card-name">{{ card.name }}</span>
      <span class="card-bank">{{ card.bank }}</span>
    </div>
    <div v-for="threshold in card.thresholds" :key="threshold.amount" class="threshold-bar">
      <div class="bar-bg">
        <div class="bar-fill" :style="{ width: progressPercent(threshold) + '%' }"></div>
      </div>
      <div class="bar-label">
        ${{ spent.toLocaleString() }} / ${{ threshold.amount.toLocaleString() }}
        — 差 ${{ Math.max(0, threshold.amount - spent).toLocaleString() }}
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ card: Object, spent: Number })
function progressPercent(threshold) {
  return Math.min(100, (props.spent / threshold.amount) * 100)
}
</script>

<style scoped>
.card-progress { background: #f9f9f9; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
.card-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.card-name { font-weight: bold; }
.card-bank { color: #999; font-size: 12px; }
.bar-bg { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: #4CAF50; border-radius: 4px; transition: width 0.3s; }
.bar-label { font-size: 12px; color: #666; margin-top: 4px; }
</style>
```

**Step 2: Implement CardsView**

Modify: `src/views/CardsView.vue`

```vue
<template>
  <div class="cards-view">
    <h2>信用卡管理</h2>

    <div v-for="card in cardsStore.cards" :key="card.id">
      <CardProgress :card="card" :spent="getSpent(card.id)" />
      <div class="card-actions">
        <button @click="editCard(card)">編輯</button>
        <button @click="removeCard(card.id)" class="delete">刪除</button>
      </div>
    </div>

    <button class="add-btn" @click="showForm = true">+ 新增信用卡</button>

    <div v-if="showForm" class="card-form">
      <h3>{{ editingCard ? '編輯' : '新增' }}信用卡</h3>
      <div class="form-group">
        <label>卡片ID（英文）</label>
        <input v-model="form.id" :disabled="!!editingCard" />
      </div>
      <div class="form-group">
        <label>名稱</label>
        <input v-model="form.name" />
      </div>
      <div class="form-group">
        <label>銀行</label>
        <input v-model="form.bank" />
      </div>
      <div class="form-group">
        <label>結算日（每月幾號）</label>
        <input type="number" v-model.number="form.billingCycleDay" min="1" max="31" />
      </div>
      <button @click="saveCard">儲存</button>
      <button @click="showForm = false">取消</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useCardsStore } from '../stores/cards.js'
import { useTransactionsStore } from '../stores/transactions.js'
import CardProgress from '../components/CardProgress.vue'

const cardsStore = useCardsStore()
const txStore = useTransactionsStore()

const showForm = ref(false)
const editingCard = ref(null)
const form = reactive({ id: '', name: '', bank: '', billingCycleDay: 1, thresholds: [], channelRules: [] })

onMounted(async () => {
  await cardsStore.init()
  await txStore.loadAll()
})

function getSpent(cardId) {
  const now = new Date()
  const txs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
  return txs.filter(t => t.cardId === cardId && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
}

function editCard(card) {
  editingCard.value = card
  Object.assign(form, JSON.parse(JSON.stringify(card)))
  showForm.value = true
}

async function saveCard() {
  if (editingCard.value) {
    await cardsStore.editCard({ ...form })
  } else {
    await cardsStore.addCard({ ...form })
  }
  showForm.value = false
  editingCard.value = null
}

async function removeCard(id) {
  if (confirm('確定刪除這張卡？')) {
    await cardsStore.deleteCard(id)
  }
}
</script>

<style scoped>
.cards-view { max-width: 480px; margin: 0 auto; }
.card-actions { display: flex; gap: 8px; margin-bottom: 16px; }
.card-actions button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; }
.card-actions .delete { color: #F44336; border-color: #F44336; }
.add-btn { width: 100%; padding: 12px; border: 2px dashed #ddd; background: none; border-radius: 8px; cursor: pointer; color: #666; }
.card-form { background: #f9f9f9; padding: 16px; border-radius: 12px; margin-top: 16px; }
.form-group { margin-bottom: 8px; }
.form-group label { display: block; font-size: 14px; color: #666; }
.form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
</style>
```

**Step 3: Verify cards view works**

Run: `npm run dev`
Expected: Navigate to /cards, add/edit/delete cards, see progress bars.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cards view with progress bars and CRUD"
```

---

## Phase 4: Monthly Reports

### Task 11: Chart Components & Report View

**Files:**
- Create: `src/components/PieChart.vue`
- Create: `src/components/BarChart.vue`
- Modify: `src/views/ReportView.vue`

**Step 1: Implement PieChart**

Create: `src/components/PieChart.vue`

```vue
<template>
  <Pie :data="chartData" :options="options" />
</template>

<script setup>
import { computed } from 'vue'
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({ breakdown: Object })

const options = { responsive: true, plugins: { legend: { position: 'bottom' } } }

const chartData = computed(() => {
  const labels = Object.keys(props.breakdown || {})
  const data = Object.values(props.breakdown || {})
  const colors = ['#F44336', '#2196F3', '#9C27B0', '#FF9800', '#795548', '#E91E63', '#3F51B5', '#00BCD4', '#8BC34A']
  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, labels.length)
    }]
  }
})
</script>
```

**Step 2: Implement BarChart**

Create: `src/components/BarChart.vue`

```vue
<template>
  <Bar :data="chartData" :options="options" />
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps({ dailyTotals: Object, daysInMonth: Number })

const options = { responsive: true, scales: { y: { beginAtZero: true } } }

const chartData = computed(() => {
  const days = props.daysInMonth || 31
  const labels = Array.from({ length: days }, (_, i) => `${i + 1}`)
  const data = labels.map((_, i) => props.dailyTotals?.[i + 1] || 0)
  return {
    labels,
    datasets: [{
      label: '每日支出',
      data,
      backgroundColor: '#4CAF50'
    }]
  }
})
</script>
```

**Step 3: Implement ReportView**

Modify: `src/views/ReportView.vue`

```vue
<template>
  <div class="report-view">
    <h2>月報表</h2>

    <div class="month-nav">
      <button @click="prevMonth">&lt;</button>
      <span>{{ year }}年 {{ month }}月</span>
      <button @click="nextMonth">&gt;</button>
    </div>

    <div class="summary-card">
      <div class="summary-row"><span>收入</span><span class="income">+${{ summary.income.toLocaleString() }}</span></div>
      <div class="summary-row"><span>支出</span><span class="expense">-${{ summary.expense.toLocaleString() }}</span></div>
      <div class="summary-row total"><span>結餘</span><span>${{ summary.balance.toLocaleString() }}</span></div>
    </div>

    <h3>支出分類</h3>
    <PieChart :breakdown="breakdown" />

    <h3 style="margin-top:16px">每日支出</h3>
    <BarChart :daily-totals="dailyTotals" :days-in-month="daysInMonth" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import PieChart from '../components/PieChart.vue'
import BarChart from '../components/BarChart.vue'

const txStore = useTransactionsStore()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

const summary = computed(() => txStore.getMonthlySummary(year.value, month.value))
const breakdown = computed(() => txStore.getCategoryBreakdown(year.value, month.value))
const dailyTotals = computed(() => txStore.getDailyTotals(year.value, month.value))
const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())

function prevMonth() {
  if (month.value === 1) { month.value = 12; year.value-- }
  else month.value--
}
function nextMonth() {
  if (month.value === 12) { month.value = 1; year.value++ }
  else month.value++
}

onMounted(() => txStore.loadAll())
</script>

<style scoped>
.report-view { max-width: 480px; margin: 0 auto; }
.month-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.month-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.summary-card { background: #f9f9f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
.summary-row.total { border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-weight: bold; }
.income { color: #4CAF50; }
.expense { color: #F44336; }
</style>
```

**Step 4: Verify report page**

Run: `npm run dev`
Expected: Navigate to /report, see pie chart and bar chart (with sample data if transactions exist).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add monthly report view with pie and bar charts"
```

---

## Phase 5: PDF Bill Import & Reconciliation

### Task 12: PDF Parser Architecture

**Files:**
- Create: `src/services/parsers/base-parser.js`
- Create: `src/services/parsers/manual-parser.js`
- Create: `src/services/parsers/index.js`
- Create: `src/__tests__/services/parsers.test.js`

**Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest'
import { detectBank, parseStatement } from '../../services/parsers/index.js'

describe('parser registry', () => {
  it('returns manual parser for unknown bank', () => {
    const result = detectBank('Some random text content')
    expect(result).toBe('manual')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/parsers.test.js`
Expected: FAIL

**Step 3: Implement parser architecture**

Create: `src/services/parsers/base-parser.js`

```js
export class BaseParser {
  /** @returns {boolean} Whether this parser can handle the given PDF text */
  detect(text) { return false }

  /**
   * Parse statement text into transactions
   * @param {string} text - Raw PDF text content
   * @returns {Array<{date: string, merchant: string, amount: number, currency: string, cardLast4: string}>}
   */
  parse(text) { return [] }
}
```

Create: `src/services/parsers/manual-parser.js`

```js
import { BaseParser } from './base-parser.js'

export class ManualParser extends BaseParser {
  detect() { return true }

  parse(text) {
    // Manual parser returns raw lines for user to map
    return { raw: true, lines: text.split('\n').filter(l => l.trim()) }
  }
}
```

Create: `src/services/parsers/index.js`

```js
import { ManualParser } from './manual-parser.js'

const parsers = []
const manualParser = new ManualParser()

export function registerParser(parser) {
  parsers.push(parser)
}

export function detectBank(text) {
  for (const parser of parsers) {
    if (parser.detect(text)) return parser.bankName || 'unknown'
  }
  return 'manual'
}

export function parseStatement(text) {
  for (const parser of parsers) {
    if (parser.detect(text)) return parser.parse(text)
  }
  return manualParser.parse(text)
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/services/parsers.test.js`
Expected: 1 test passes.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add plugin-based PDF parser architecture"
```

---

### Task 13: Reconciliation Service

**Files:**
- Create: `src/services/reconcile.js`
- Create: `src/__tests__/services/reconcile.test.js`

**Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest'
import { reconcile } from '../../services/reconcile.js'

describe('reconcile service', () => {
  const billItems = [
    { date: '2026-02-03', merchant: '全聯福利中心', amount: 385 },
    { date: '2026-02-05', merchant: 'momo購物', amount: 1200 },
    { date: '2026-02-08', merchant: '台灣大哥大', amount: 499 }
  ]

  const manualRecords = [
    { id: 1, date: '2026-02-03', amount: 385, category: '購物', note: '全聯' },
    { id: 2, date: '2026-02-05', amount: 1199, category: '購物', note: 'momo' },
    { id: 3, date: '2026-02-10', amount: 180, category: '飲食', note: '星巴克' }
  ]

  it('matches exact date+amount', () => {
    const result = reconcile(billItems, manualRecords)
    const matched = result.find(r => r.billItem?.amount === 385)
    expect(matched.status).toBe('matched')
  })

  it('flags amount mismatch', () => {
    const result = reconcile(billItems, manualRecords)
    const mismatch = result.find(r => r.billItem?.amount === 1200)
    expect(mismatch.status).toBe('amount_mismatch')
    expect(mismatch.diff).toBe(1)
  })

  it('flags bill-only items', () => {
    const result = reconcile(billItems, manualRecords)
    const billOnly = result.find(r => r.billItem?.amount === 499)
    expect(billOnly.status).toBe('bill_only')
  })

  it('flags manual-only items', () => {
    const result = reconcile(billItems, manualRecords)
    const manualOnly = result.find(r => r.manualRecord?.id === 3)
    expect(manualOnly.status).toBe('manual_only')
  })

  it('computes match rate', () => {
    const result = reconcile(billItems, manualRecords)
    const matched = result.filter(r => r.status === 'matched').length
    const total = billItems.length
    expect(matched / total).toBeCloseTo(1 / 3)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/services/reconcile.test.js`
Expected: FAIL

**Step 3: Implement reconciliation service**

Create: `src/services/reconcile.js`

```js
/**
 * Reconcile bill items against manual records.
 *
 * @param {Array} billItems - [{date, merchant, amount}]
 * @param {Array} manualRecords - [{id, date, amount, category, note}]
 * @returns {Array} Reconciliation results
 */
export function reconcile(billItems, manualRecords) {
  const results = []
  const usedManualIds = new Set()

  // Match bill items to manual records
  for (const bill of billItems) {
    // Exact match: same date + same amount
    let match = manualRecords.find(
      m => !usedManualIds.has(m.id) && m.date === bill.date && m.amount === bill.amount
    )

    if (match) {
      usedManualIds.add(match.id)
      results.push({ status: 'matched', billItem: bill, manualRecord: match })
      continue
    }

    // Amount mismatch: same date, close amount
    match = manualRecords.find(
      m => !usedManualIds.has(m.id) && m.date === bill.date && Math.abs(m.amount - bill.amount) <= Math.max(bill.amount * 0.05, 10)
    )

    if (match) {
      usedManualIds.add(match.id)
      results.push({
        status: 'amount_mismatch',
        billItem: bill,
        manualRecord: match,
        diff: Math.abs(bill.amount - match.amount)
      })
      continue
    }

    // Bill only
    results.push({ status: 'bill_only', billItem: bill, manualRecord: null })
  }

  // Manual only (not matched to any bill item)
  for (const manual of manualRecords) {
    if (!usedManualIds.has(manual.id)) {
      results.push({ status: 'manual_only', billItem: null, manualRecord: manual })
    }
  }

  return results
}

export function getMatchRate(results) {
  const billCount = results.filter(r => r.billItem).length
  if (billCount === 0) return 0
  const matched = results.filter(r => r.status === 'matched').length
  return matched / billCount
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/services/reconcile.test.js`
Expected: 5 tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add bill reconciliation service"
```

---

### Task 14: Reconcile View

**Files:**
- Modify: `src/views/ReconcileView.vue`
- Create: `src/components/ReconcileResult.vue`

**Step 1: Implement ReconcileResult component**

Create: `src/components/ReconcileResult.vue`

```vue
<template>
  <div class="reconcile-item" :class="item.status">
    <span class="status-icon">{{ icon }}</span>
    <div class="item-details">
      <div class="item-main">
        <span>{{ displayDate }}</span>
        <span>{{ displayMerchant }}</span>
        <span class="amount">${{ displayAmount.toLocaleString() }}</span>
      </div>
      <div class="item-note">{{ note }}</div>
    </div>
    <button v-if="item.status === 'bill_only'" class="quick-add" @click="$emit('quickAdd', item.billItem)">
      補記
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })
defineEmits(['quickAdd'])

const icon = computed(() => {
  const icons = { matched: '✅', amount_mismatch: '⚠️', bill_only: '❌', manual_only: '🔍' }
  return icons[props.item.status]
})

const displayDate = computed(() => {
  const src = props.item.billItem || props.item.manualRecord
  return src?.date?.slice(5) || ''
})

const displayMerchant = computed(() =>
  props.item.billItem?.merchant || props.item.manualRecord?.note || ''
)

const displayAmount = computed(() =>
  props.item.billItem?.amount || props.item.manualRecord?.amount || 0
)

const note = computed(() => {
  if (props.item.status === 'amount_mismatch') return `你記 $${props.item.manualRecord.amount}（差 $${props.item.diff}）`
  if (props.item.status === 'bill_only') return '漏記'
  if (props.item.status === 'manual_only') return '帳單無此筆'
  return '已對帳'
})
</script>

<style scoped>
.reconcile-item { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #f0f0f0; }
.status-icon { font-size: 18px; }
.item-details { flex: 1; }
.item-main { display: flex; gap: 8px; align-items: baseline; }
.amount { margin-left: auto; font-weight: bold; }
.item-note { font-size: 12px; color: #999; }
.quick-add { padding: 4px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
</style>
```

**Step 2: Implement ReconcileView with PDF upload**

Modify: `src/views/ReconcileView.vue`

```vue
<template>
  <div class="reconcile-view">
    <h2>帳單對帳</h2>

    <div v-if="!results">
      <div class="upload-area">
        <input type="file" accept=".pdf" @change="onFileSelect" ref="fileInput" hidden />
        <button class="upload-btn" @click="$refs.fileInput.click()">選擇 PDF 帳單</button>
      </div>

      <div v-if="needPassword" class="form-group">
        <label>PDF 密碼</label>
        <input type="password" v-model="password" placeholder="身分證字號或其他密碼" />
        <button @click="processPdf">解鎖並匯入</button>
      </div>

      <div v-if="loading" class="loading">解析中...</div>
    </div>

    <div v-else>
      <div class="summary-bar">
        對帳率：{{ matchRate }}%（{{ matchedCount }}/{{ totalBillItems }} 筆吻合）
      </div>

      <ReconcileResult
        v-for="(item, idx) in results"
        :key="idx"
        :item="item"
        @quick-add="quickAdd"
      />

      <button class="reset-btn" @click="reset">重新對帳</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { parseStatement } from '../services/parsers/index.js'
import { reconcile, getMatchRate } from '../services/reconcile.js'
import ReconcileResult from '../components/ReconcileResult.vue'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

const txStore = useTransactionsStore()
const results = ref(null)
const needPassword = ref(false)
const password = ref('')
const loading = ref(false)
let selectedFile = null

const matchedCount = computed(() => results.value?.filter(r => r.status === 'matched').length || 0)
const totalBillItems = computed(() => results.value?.filter(r => r.billItem).length || 0)
const matchRate = computed(() => {
  if (!totalBillItems.value) return 0
  return Math.round((matchedCount.value / totalBillItems.value) * 100)
})

onMounted(() => txStore.loadAll())

function onFileSelect(e) {
  selectedFile = e.target.files[0]
  if (selectedFile) {
    needPassword.value = true
  }
}

async function processPdf() {
  if (!selectedFile) return
  loading.value = true

  try {
    const arrayBuffer = await selectedFile.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password: password.value || undefined })
    const pdf = await loadingTask.promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      fullText += content.items.map(item => item.str).join(' ') + '\n'
    }

    const parsed = parseStatement(fullText)

    if (parsed.raw) {
      // Manual parser fallback - show raw lines for now
      // TODO: implement manual column mapping UI
      alert('無法自動辨識銀行格式，請手動對應欄位（功能開發中）')
      loading.value = false
      return
    }

    // Run reconciliation
    const now = new Date()
    const monthTxs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
    results.value = reconcile(parsed, monthTxs)
  } catch (err) {
    if (err.name === 'PasswordException') {
      alert('密碼錯誤，請重新輸入')
    } else {
      alert('PDF 解析失敗：' + err.message)
    }
  } finally {
    loading.value = false
  }
}

async function quickAdd(billItem) {
  await txStore.addTransaction({
    amount: billItem.amount,
    type: 'expense',
    category: '',
    channel: '一般',
    cardId: null,
    date: billItem.date,
    note: billItem.merchant
  })
  // Re-run reconciliation
  const now = new Date()
  const monthTxs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
  const billItems = results.value.filter(r => r.billItem).map(r => r.billItem)
  results.value = reconcile(billItems, monthTxs)
}

function reset() {
  results.value = null
  needPassword.value = false
  password.value = ''
  selectedFile = null
}
</script>

<style scoped>
.reconcile-view { max-width: 480px; margin: 0 auto; }
.upload-area { text-align: center; padding: 32px; }
.upload-btn { padding: 16px 32px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
.form-group { margin: 16px 0; }
.form-group label { display: block; margin-bottom: 4px; }
.form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; }
.form-group button { padding: 10px 24px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; }
.summary-bar { background: #E8F5E9; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px; font-weight: bold; }
.loading { text-align: center; padding: 32px; color: #999; }
.reset-btn { width: 100%; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; margin-top: 16px; }
</style>
```

**Step 3: Verify reconcile page**

Run: `npm run dev`
Expected: Navigate to /reconcile, upload PDF button visible, password input appears after file select.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add PDF bill import and reconciliation view"
```

---

## Phase 6: Google Drive Sync

### Task 15: Google Drive Service

**Files:**
- Create: `src/services/gdrive.js`

**Step 1: Implement Google Drive API service**

Create: `src/services/gdrive.js`

```js
const CLIENT_ID = '' // User must set this
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'moneyman-backup.json'

let tokenClient = null
let accessToken = null

export function isConfigured() {
  return !!CLIENT_ID
}

export async function initGoogleAuth() {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          accessToken = response.access_token
          resolve(response)
        }
      })
      resolve()
    }
    document.head.appendChild(script)
  })
}

export function requestAuth() {
  if (tokenClient) tokenClient.requestAccessToken()
}

export async function uploadBackup(data) {
  if (!accessToken) throw new Error('未授權')

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  // Check if file already exists
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    // Update existing file
    const fileId = searchData.files[0].id
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: blob
    })
  } else {
    // Create new file
    const metadata = { name: FILE_NAME, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    })
  }
}

export async function downloadBackup() {
  if (!accessToken) throw new Error('未授權')

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (!searchData.files?.length) return null

  const fileId = searchData.files[0].id
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  return res.json()
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Google Drive API service for backup sync"
```

---

### Task 16: Settings View with Sync & Categories

**Files:**
- Modify: `src/views/SettingsView.vue`

**Step 1: Implement SettingsView**

```vue
<template>
  <div class="settings-view">
    <h2>設定</h2>

    <section>
      <h3>分類管理</h3>
      <div v-for="cat in categoriesStore.categories" :key="cat.id" class="cat-item">
        <span>{{ cat.icon }} {{ cat.name }}</span>
        <button @click="deleteCat(cat.id)" class="delete-btn">刪除</button>
      </div>
      <div class="add-cat">
        <input v-model="newCatName" placeholder="新分類名稱" />
        <button @click="addCat">新增</button>
      </div>
    </section>

    <section>
      <h3>Google Drive 同步</h3>
      <p class="hint">手動上傳/下載資料，單一裝置修改後再同步。</p>
      <div class="sync-buttons">
        <button @click="upload" :disabled="syncing" class="upload-btn">📤 上傳備份</button>
        <button @click="download" :disabled="syncing" class="download-btn">📥 下載還原</button>
      </div>
      <div v-if="syncMsg" class="sync-msg">{{ syncMsg }}</div>
    </section>

    <section>
      <h3>對帳</h3>
      <router-link to="/reconcile" class="link-btn">前往帳單對帳</router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCategoriesStore } from '../stores/categories.js'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCardsStore } from '../stores/cards.js'
import { initGoogleAuth, requestAuth, uploadBackup, downloadBackup } from '../services/gdrive.js'
import { getRecords, clearStore, addRecord } from '../services/db.js'

const categoriesStore = useCategoriesStore()
const txStore = useTransactionsStore()
const cardsStore = useCardsStore()

const newCatName = ref('')
const syncing = ref(false)
const syncMsg = ref('')

onMounted(async () => {
  await categoriesStore.init()
  await initGoogleAuth()
})

async function addCat() {
  if (!newCatName.value.trim()) return
  await categoriesStore.addCategory({ name: newCatName.value.trim(), color: '#607D8B', icon: '📌' })
  newCatName.value = ''
}

async function deleteCat(id) {
  if (confirm('確定刪除？')) await categoriesStore.deleteCategory(id)
}

async function upload() {
  syncing.value = true
  syncMsg.value = ''
  try {
    requestAuth()
    // Wait a moment for auth callback
    await new Promise(r => setTimeout(r, 2000))

    const data = {
      transactions: await getRecords('transactions'),
      cards: await getRecords('cards'),
      categories: await getRecords('categories'),
      exportedAt: new Date().toISOString()
    }
    await uploadBackup(data)
    syncMsg.value = '上傳成功！'
  } catch (e) {
    syncMsg.value = '上傳失敗：' + e.message
  } finally {
    syncing.value = false
  }
}

async function download() {
  syncing.value = true
  syncMsg.value = ''
  try {
    requestAuth()
    await new Promise(r => setTimeout(r, 2000))

    const data = await downloadBackup()
    if (!data) { syncMsg.value = '沒有找到備份檔案'; return }

    if (!confirm('下載將覆蓋本地所有資料，確定繼續？')) return

    // Restore data
    await clearStore('transactions')
    await clearStore('cards')
    await clearStore('categories')

    for (const tx of data.transactions || []) await addRecord('transactions', tx)
    for (const card of data.cards || []) await addRecord('cards', card)
    for (const cat of data.categories || []) await addRecord('categories', cat)

    await txStore.loadAll()
    await cardsStore.init()
    await categoriesStore.init()

    syncMsg.value = `還原成功！（備份時間：${data.exportedAt}）`
  } catch (e) {
    syncMsg.value = '下載失敗：' + e.message
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.settings-view { max-width: 480px; margin: 0 auto; }
section { margin-bottom: 24px; }
.cat-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.delete-btn { background: none; border: none; color: #F44336; cursor: pointer; }
.add-cat { display: flex; gap: 8px; margin-top: 8px; }
.add-cat input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.add-cat button { padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
.hint { font-size: 13px; color: #999; margin-bottom: 8px; }
.sync-buttons { display: flex; gap: 8px; }
.upload-btn, .download-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.upload-btn { background: #2196F3; color: white; }
.download-btn { background: #FF9800; color: white; }
.sync-msg { margin-top: 8px; padding: 8px; background: #E8F5E9; border-radius: 4px; font-size: 13px; }
.link-btn { display: block; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px; text-decoration: none; color: #333; }
</style>
```

**Step 2: Verify settings page**

Run: `npm run dev`
Expected: Navigate to /settings, category management works, sync buttons visible.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add settings view with category management and Google Drive sync"
```

---

## Phase 7: Integration & Polish

### Task 17: Wire CardRecommend into Home View

**Files:**
- Create: `src/components/CardRecommend.vue`
- Modify: `src/views/HomeView.vue`

**Step 1: Implement CardRecommend component**

Create: `src/components/CardRecommend.vue`

```vue
<template>
  <div class="card-recommend" v-if="recommendation">
    <h3>💡 建議刷這張</h3>
    <div class="rec-card">
      <div class="rec-name">{{ recommendation.cardName }}</div>
      <div class="rec-detail">
        {{ channel }} 回饋 {{ (recommendation.rate * 100).toFixed(1) }}%
        → 預估 ${{ recommendation.estimatedReward.toFixed(0) }}
      </div>
      <div v-if="recommendation.thresholdGap" class="rec-threshold">
        再刷 ${{ recommendation.thresholdGap.toLocaleString() }} 達標
        → 額外 ${{ recommendation.thresholdBonus.toLocaleString() }} 回饋
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCardsStore } from '../stores/cards.js'
import { useTransactionsStore } from '../stores/transactions.js'
import { recommendCard } from '../services/recommend.js'

const cardsStore = useCardsStore()
const txStore = useTransactionsStore()
const channel = ref('一般')

const recommendation = computed(() => {
  if (!cardsStore.cards.length) return null

  const now = new Date()
  const monthTxs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)

  const spending = {}
  const channelSpending = {}
  for (const card of cardsStore.cards) {
    const cardTxs = monthTxs.filter(t => t.cardId === card.id && t.type === 'expense')
    spending[card.id] = cardTxs.reduce((s, t) => s + t.amount, 0)
    channelSpending[card.id] = {}
    for (const t of cardTxs) {
      const ch = t.channel || '一般'
      const rule = card.channelRules?.find(r => r.channel === ch)
      if (rule) {
        channelSpending[card.id][ch] = (channelSpending[card.id][ch] || 0) + t.amount * rule.rate
      }
    }
  }

  const results = recommendCard({
    cards: cardsStore.cards,
    channel: channel.value,
    amount: 1000,
    currentSpending: spending,
    currentChannelSpending: channelSpending,
    today: now
  })

  return results[0] || null
})
</script>

<style scoped>
.card-recommend { background: #FFF3E0; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
.rec-card { margin-top: 8px; }
.rec-name { font-weight: bold; font-size: 16px; }
.rec-detail { font-size: 14px; color: #666; margin-top: 4px; }
.rec-threshold { font-size: 13px; color: #E65100; margin-top: 4px; }
</style>
```

**Step 2: Add CardProgress and CardRecommend to HomeView**

Add imports and components to HomeView's `<script setup>`:

```js
import CardProgress from '../components/CardProgress.vue'
import CardRecommend from '../components/CardRecommend.vue'
import { useCardsStore } from '../stores/cards.js'

const cardsStore = useCardsStore()
// Add cardsStore.init() to onMounted
```

Add to template between summary-card and recent transactions:

```vue
<CardRecommend />
<div v-for="card in cardsStore.cards" :key="card.id">
  <CardProgress :card="card" :spent="getCardSpent(card.id)" />
</div>
```

**Step 3: Verify integration**

Run: `npm run dev`
Expected: Home page shows card progress bars and recommendation when cards exist.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate card recommendation and progress into home view"
```

---

### Task 18: Run All Tests & Final Build

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Fix any failing tests**

Address any failures.

**Step 3: Build for production**

Run: `npm run build`
Expected: Build succeeds, output in `dist/`.

**Step 4: Test production build**

Run: `npm run preview`
Expected: App loads, all features work, PWA installable.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: all tests passing, production build verified"
```

---

## Summary

```
Phase 1: Scaffolding     → Tasks 1-3  (project, router, IndexedDB)
Phase 2: Core Data       → Tasks 4-7  (categories, transactions, views)
Phase 3: Cards           → Tasks 8-10 (cards store, recommendation, UI)
Phase 4: Reports         → Task 11    (charts, report view)
Phase 5: PDF/Reconcile   → Tasks 12-14 (parsers, reconcile, view)
Phase 6: Sync            → Tasks 15-16 (Google Drive, settings)
Phase 7: Integration     → Tasks 17-18 (wire up, test, build)
```

Total: 18 tasks, ~7 phases, each task is independently committable.
