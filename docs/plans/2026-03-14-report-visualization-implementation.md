# Report Visualization Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance ReportView with yearly trends, month comparison, and heatmap charts via tab navigation, plus datetime support for transactions.

**Architecture:** Extend existing ReportView with tab switching. Add new computed getters to transactions store for yearly/cross-month aggregation. Create four new components (YearlyTrendChart, MonthCompareChart, HeatmapChart, DrillDownPanel). All charts use Chart.js + vue-chartjs + chartjs-chart-matrix.

**Tech Stack:** Vue 3 (Composition API), Chart.js, vue-chartjs, chartjs-chart-matrix, Pinia, Vitest

---

### Task 1: Install chartjs-chart-matrix dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install chartjs-chart-matrix`

**Step 2: Verify installation**

Run: `npm ls chartjs-chart-matrix`
Expected: shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chartjs-chart-matrix dependency"
```

---

### Task 2: Migrate date field to datetime-local in AddView

**Files:**
- Modify: `src/views/AddView.vue:30-31` (date input)
- Modify: `src/views/AddView.vue:122` (default value)
- Test: `src/__tests__/stores/transactions.test.js`

**Step 1: Write test for datetime transactions**

Add to `src/__tests__/stores/transactions.test.js`:

```javascript
it('handles datetime-local format in date field', async () => {
  const store = useTransactionsStore()
  const catId = catStore.categories[0].id
  await store.addTransaction({
    amount: 100, type: 'expense', category: catId,
    date: '2026-03-14T14:30', note: 'test'
  })
  // getMonthTransactions uses startsWith prefix, should still work
  const txs = store.getMonthTransactions(2026, 3)
  expect(txs).toHaveLength(1)
  expect(txs[0].date).toBe('2026-03-14T14:30')
})

it('getMonthlySummary works with mixed date formats', async () => {
  const store = useTransactionsStore()
  const catId = catStore.categories[0].id
  await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-01' })
  await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-02T10:00' })
  const summary = store.getMonthlySummary(2026, 3)
  expect(summary.expense).toBe(300)
})
```

**Step 2: Run test to verify it passes** (existing `getMonthTransactions` uses `startsWith` which handles both formats)

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: PASS (startsWith prefix matching works with datetime strings too)

**Step 3: Update AddView date input**

In `src/views/AddView.vue`, change line 31:
```html
<!-- Before -->
<input type="date" v-model="form.date" />
<!-- After -->
<input type="datetime-local" v-model="form.date" />
```

Change line 122, the `today` default value:
```javascript
// Before
const today = new Date().toISOString().split('T')[0]
// After
const today = (() => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
})()
```

**Step 4: Update getDailyTotals to handle datetime**

In `src/stores/transactions.js`, the `getDailyTotals` function uses `t.date.split('-')[2]` which would break with `2026-03-14T14:30`. Fix:

```javascript
// Before
const day = parseInt(t.date.split('-')[2])
// After
const day = parseInt(t.date.substring(8, 10))
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/views/AddView.vue src/stores/transactions.js src/__tests__/stores/transactions.test.js
git commit -m "feat: migrate date field to datetime-local for time tracking"
```

---

### Task 3: Add yearly and cross-month store getters

**Files:**
- Modify: `src/stores/transactions.js`
- Test: `src/__tests__/stores/transactions.test.js`

**Step 1: Write failing tests for new getters**

Add to `src/__tests__/stores/transactions.test.js`:

```javascript
describe('yearly and cross-month getters', () => {
  let store, catId, catId2

  beforeEach(async () => {
    store = useTransactionsStore()
    catId = catStore.categories[0].id  // 飲食
    catId2 = catStore.categories[1].id // 交通
  })

  it('getYearlySummary returns 12 months of income/expense/balance', async () => {
    await store.addTransaction({ amount: 1000, type: 'income', category: catId, date: '2026-01-15' })
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-20' })
    await store.addTransaction({ amount: 500, type: 'expense', category: catId, date: '2026-03-10' })
    const result = store.getYearlySummary(2026)
    expect(result).toHaveLength(12)
    expect(result[0]).toEqual({ month: 1, income: 1000, expense: 300, balance: 700 })
    expect(result[1]).toEqual({ month: 2, income: 0, expense: 0, balance: 0 })
    expect(result[2]).toEqual({ month: 3, income: 0, expense: 500, balance: -500 })
  })

  it('getYearlyCategoryBreakdown returns top N categories per month', async () => {
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
    await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-05' })
    const result = store.getYearlyCategoryBreakdown(2026, 5)
    // result: { categories: ['飲食', '交通', ...], months: [ {month:1, data: {'飲食': 300, '交通': 100}}, ... ] }
    expect(result.categories).toContain('飲食')
    expect(result.months[0].data['飲食']).toBe(300)
    expect(result.months[0].data['交通']).toBe(100)
  })

  it('getMonthComparison returns category diffs between two months', async () => {
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
    await store.addTransaction({ amount: 500, type: 'expense', category: catId, date: '2026-02-05' })
    await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
    const result = store.getMonthComparison(2026, 1, 2026, 2)
    // { categories: { '飲食': { monthA: 300, monthB: 500, diff: 200, pct: 66.7 }, '交通': { monthA: 100, monthB: 0, diff: -100, pct: -100 } }, totalA, totalB }
    expect(result.categories['飲食'].monthA).toBe(300)
    expect(result.categories['飲食'].monthB).toBe(500)
    expect(result.categories['飲食'].diff).toBe(200)
    expect(result.totalA).toBe(400)
    expect(result.totalB).toBe(500)
  })

  it('getHeatmapByWeekdayHour aggregates by weekday and hour', async () => {
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-09T14:30' }) // Monday
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-09T14:45' }) // Monday
    await store.addTransaction({ amount: 50, type: 'expense', category: catId, date: '2026-03-10T09:00' })  // Tuesday
    const result = store.getHeatmapByWeekdayHour('2026-02-14', '2026-03-14')
    // result: array of { weekday: 0-6 (Mon-Sun), hour: 0-23, total: number, count: number }
    const mondayAt14 = result.find(r => r.weekday === 0 && r.hour === 14)
    expect(mondayAt14.total).toBe(300)
    expect(mondayAt14.count).toBe(2)
  })

  it('getHeatmapByDay returns daily totals for a date range', async () => {
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-01' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-01T15:00' })
    await store.addTransaction({ amount: 50, type: 'expense', category: catId, date: '2026-03-05' })
    const result = store.getHeatmapByDay('2026-03-01', '2026-03-31')
    // result: { '2026-03-01': { total: 300, count: 2 }, '2026-03-05': { total: 50, count: 1 } }
    expect(result['2026-03-01'].total).toBe(300)
    expect(result['2026-03-05'].count).toBe(1)
  })

  it('getHeatmapByCategoryMonth returns category x month matrix', async () => {
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
    await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-05' })
    const result = store.getHeatmapByCategoryMonth(2026, 8)
    // result: array of { category: name, month: 1-12, total: number }
    const food_jan = result.find(r => r.category === '飲食' && r.month === 1)
    expect(food_jan.total).toBe(300)
  })
})
```

**Step 2: Run test to verify they fail**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: FAIL — functions don't exist yet

**Step 3: Implement the getters**

Add to `src/stores/transactions.js` inside `defineStore`, before the `return` statement:

```javascript
function getYearTransactions(year) {
  const prefix = `${year}-`
  return transactions.value.filter(t => t.date && t.date.startsWith(prefix))
}

function getYearlySummary(year) {
  const yearTxs = getYearTransactions(year)
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const monthTxs = yearTxs.filter(t => t.date.startsWith(prefix))
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { month, income, expense, balance: income - expense }
  })
}

function getYearlyCategoryBreakdown(year, topN = 5) {
  const catStore = useCategoriesStore()
  const yearTxs = getYearTransactions(year).filter(t => t.type === 'expense')
  // Gather all category totals to determine top N
  const catTotals = {}
  for (const t of yearTxs) {
    const name = catStore.getCategoryName(t.category) || '未分類'
    catTotals[name] = (catTotals[name] || 0) + t.amount
  }
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const topCategories = sorted.slice(0, topN).map(([name]) => name)

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const monthTxs = yearTxs.filter(t => t.date.startsWith(prefix))
    const data = {}
    let otherTotal = 0
    for (const t of monthTxs) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      if (topCategories.includes(name)) {
        data[name] = (data[name] || 0) + t.amount
      } else {
        otherTotal += t.amount
      }
    }
    if (otherTotal > 0) data['其他'] = otherTotal
    return { month, data }
  })
  const categories = otherTotal => [...topCategories, ...(months.some(m => m.data['其他']) ? ['其他'] : [])]
  return { categories: [...topCategories, ...(months.some(m => m.data['其他']) ? ['其他'] : [])], months }
}

function getMonthComparison(yearA, monthA, yearB, monthB) {
  const catStore = useCategoriesStore()
  const txsA = getMonthTransactions(yearA, monthA).filter(t => t.type === 'expense')
  const txsB = getMonthTransactions(yearB, monthB).filter(t => t.type === 'expense')

  const allCategories = new Set()
  const sumA = {}, sumB = {}
  for (const t of txsA) {
    const name = catStore.getCategoryName(t.category) || '未分類'
    allCategories.add(name)
    sumA[name] = (sumA[name] || 0) + t.amount
  }
  for (const t of txsB) {
    const name = catStore.getCategoryName(t.category) || '未分類'
    allCategories.add(name)
    sumB[name] = (sumB[name] || 0) + t.amount
  }

  const categories = {}
  let totalA = 0, totalB = 0
  for (const name of allCategories) {
    const a = sumA[name] || 0
    const b = sumB[name] || 0
    categories[name] = {
      monthA: a, monthB: b,
      diff: b - a,
      pct: a === 0 ? (b > 0 ? 100 : 0) : Math.round((b - a) / a * 1000) / 10
    }
    totalA += a
    totalB += b
  }
  return { categories, totalA, totalB, diff: totalB - totalA, pct: totalA === 0 ? (totalB > 0 ? 100 : 0) : Math.round((totalB - totalA) / totalA * 1000) / 10 }
}

function getHeatmapByWeekdayHour(startDate, endDate) {
  const txs = transactions.value.filter(t =>
    t.type === 'expense' && t.date && t.date >= startDate && t.date <= endDate + '\uffff' && t.date.includes('T')
  )
  const map = {}
  for (const t of txs) {
    const dt = new Date(t.date)
    const weekday = (dt.getDay() + 6) % 7 // Mon=0, Sun=6
    const hour = dt.getHours()
    const key = `${weekday}-${hour}`
    if (!map[key]) map[key] = { weekday, hour, total: 0, count: 0 }
    map[key].total += t.amount
    map[key].count++
  }
  return Object.values(map)
}

function getHeatmapByDay(startDate, endDate) {
  const txs = transactions.value.filter(t =>
    t.type === 'expense' && t.date && t.date >= startDate && t.date <= endDate + '\uffff'
  )
  const map = {}
  for (const t of txs) {
    const day = t.date.substring(0, 10)
    if (!map[day]) map[day] = { total: 0, count: 0 }
    map[day].total += t.amount
    map[day].count++
  }
  return map
}

function getHeatmapByCategoryMonth(year, topN = 8) {
  const catStore = useCategoriesStore()
  const yearTxs = getYearTransactions(year).filter(t => t.type === 'expense')
  // Determine top N categories
  const catTotals = {}
  for (const t of yearTxs) {
    const name = catStore.getCategoryName(t.category) || '未分類'
    catTotals[name] = (catTotals[name] || 0) + t.amount
  }
  const topCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name]) => name)

  const result = []
  for (const category of topCategories) {
    for (let month = 1; month <= 12; month++) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const total = yearTxs
        .filter(t => t.date.startsWith(prefix) && (catStore.getCategoryName(t.category) || '未分類') === category)
        .reduce((s, t) => s + t.amount, 0)
      result.push({ category, month, total })
    }
  }
  return result
}
```

Update the `return` statement to export new getters:

```javascript
return {
  transactions, loadAll, addTransaction, editTransaction, deleteTransaction,
  getMonthTransactions, getTransactionsByDateRange, getMonthlySummary, getCategoryBreakdown, getDailyTotals,
  isDuplicate,
  getYearlySummary, getYearlyCategoryBreakdown, getMonthComparison,
  getHeatmapByWeekdayHour, getHeatmapByDay, getHeatmapByCategoryMonth
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/stores/transactions.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/stores/transactions.js src/__tests__/stores/transactions.test.js
git commit -m "feat: add yearly trend, month comparison, and heatmap store getters"
```

---

### Task 4: Create DrillDownPanel component

**Files:**
- Create: `src/components/DrillDownPanel.vue`

**Step 1: Create the component**

```vue
<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="visible" class="drilldown-overlay" @click.self="$emit('close')">
        <div class="drilldown-panel">
          <div class="panel-header">
            <h3>{{ title }}</h3>
            <button class="close-btn" @click="$emit('close')">&times;</button>
          </div>
          <div class="panel-body">
            <div v-if="!transactions.length" class="empty">沒有交易紀錄</div>
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="tx-row"
              @click="$router.push(`/add/${tx.id}`)"
            >
              <div class="tx-left">
                <span class="tx-date">{{ formatDate(tx.date) }}</span>
                <span class="tx-category">{{ getCategoryName(tx.category) }}</span>
                <span v-if="tx.note" class="tx-note">{{ tx.note }}</span>
              </div>
              <span class="tx-amount" :class="tx.type">
                {{ tx.type === 'income' ? '+' : '-' }}${{ tx.amount.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useCategoriesStore } from '../stores/categories.js'

defineProps({
  visible: Boolean,
  title: { type: String, default: '交易明細' },
  transactions: { type: Array, default: () => [] }
})
defineEmits(['close'])

const categoriesStore = useCategoriesStore()

function getCategoryName(id) {
  return categoriesStore.getCategoryName(id) || '未分類'
}

function formatDate(date) {
  if (!date) return ''
  return date.includes('T') ? date.replace('T', ' ') : date
}
</script>

<style scoped>
.drilldown-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center;
}
.drilldown-panel {
  background: #fff; border-radius: 16px 16px 0 0; width: 100%; max-width: 480px;
  max-height: 60vh; display: flex; flex-direction: column;
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px; border-bottom: 1px solid #eee;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
.panel-body { overflow-y: auto; padding: 8px 16px 16px; }
.empty { text-align: center; color: #999; padding: 24px; }
.tx-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f5f5f5; cursor: pointer;
}
.tx-row:hover { background: #fafafa; }
.tx-left { display: flex; flex-direction: column; gap: 2px; }
.tx-date { font-size: 12px; color: #999; }
.tx-category { font-size: 14px; }
.tx-note { font-size: 12px; color: #666; }
.tx-amount { font-weight: bold; white-space: nowrap; }
.tx-amount.expense { color: #F44336; }
.tx-amount.income { color: #4CAF50; }

.panel-enter-active, .panel-leave-active { transition: all 0.3s ease; }
.panel-enter-from .drilldown-panel, .panel-leave-to .drilldown-panel { transform: translateY(100%); }
.panel-enter-from, .panel-leave-to { opacity: 0; }
</style>
```

**Step 2: Commit**

```bash
git add src/components/DrillDownPanel.vue
git commit -m "feat: add DrillDownPanel bottom sheet component"
```

---

### Task 5: Add tab navigation to ReportView

**Files:**
- Modify: `src/views/ReportView.vue`

**Step 1: Refactor ReportView with tabs**

Replace the entire `src/views/ReportView.vue` with tab structure. The "月報表" tab retains all existing content. Other tabs show placeholder text for now.

```vue
<template>
  <div class="report-view">
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 月報表 (existing) -->
    <div v-if="activeTab === 'monthly'">
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

    <!-- 年度趨勢 -->
    <div v-if="activeTab === 'yearly'">
      <YearlyTrendChart
        :year="year"
        @update:year="year = $event"
        @drill-down="openDrillDown"
      />
    </div>

    <!-- 跨月比較 -->
    <div v-if="activeTab === 'compare'">
      <MonthCompareChart
        :current-year="year"
        :current-month="month"
        @drill-down="openDrillDown"
      />
    </div>

    <!-- 消費熱力圖 -->
    <div v-if="activeTab === 'heatmap'">
      <HeatmapChart
        :year="year"
        @update:year="year = $event"
        @drill-down="openDrillDown"
      />
    </div>

    <DrillDownPanel
      :visible="drillDown.visible"
      :title="drillDown.title"
      :transactions="drillDown.transactions"
      @close="drillDown.visible = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import PieChart from '../components/PieChart.vue'
import BarChart from '../components/BarChart.vue'
import YearlyTrendChart from '../components/YearlyTrendChart.vue'
import MonthCompareChart from '../components/MonthCompareChart.vue'
import HeatmapChart from '../components/HeatmapChart.vue'
import DrillDownPanel from '../components/DrillDownPanel.vue'

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()

const tabs = [
  { key: 'monthly', label: '月報表' },
  { key: 'yearly', label: '年度趨勢' },
  { key: 'compare', label: '跨月比較' },
  { key: 'heatmap', label: '熱力圖' }
]
const activeTab = ref('monthly')

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

// Drill down state
const drillDown = reactive({ visible: false, title: '', transactions: [] })

function openDrillDown({ title, transactions }) {
  drillDown.title = title
  drillDown.transactions = transactions
  drillDown.visible = true
}

onMounted(async () => {
  await categoriesStore.init()
  await txStore.loadAll()
})
</script>

<style scoped>
.report-view { max-width: 480px; margin: 0 auto; }
.tab-bar { display: flex; gap: 4px; margin-bottom: 16px; overflow-x: auto; }
.tab-bar button {
  flex-shrink: 0; padding: 8px 14px; border: 1px solid #ddd; background: #fff;
  border-radius: 8px; cursor: pointer; font-size: 14px; white-space: nowrap;
}
.tab-bar button.active { background: #4CAF50; color: white; border-color: #4CAF50; }
.month-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.month-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.summary-card { background: #f9f9f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
.summary-row.total { border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-weight: bold; }
.income { color: #4CAF50; }
.expense { color: #F44336; }
</style>
```

**Step 2: Create placeholder YearlyTrendChart**

Create `src/components/YearlyTrendChart.vue`:

```vue
<template>
  <div>
    <div class="year-nav">
      <button @click="$emit('update:year', year - 1)">&lt;</button>
      <span>{{ year }} 年</span>
      <button @click="$emit('update:year', year + 1)">&gt;</button>
    </div>
    <p style="text-align:center;color:#999;">年度趨勢圖（待實作）</p>
  </div>
</template>

<script setup>
defineProps({ year: Number })
defineEmits(['update:year', 'drill-down'])
</script>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.year-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
</style>
```

**Step 3: Create placeholder MonthCompareChart**

Create `src/components/MonthCompareChart.vue`:

```vue
<template>
  <div>
    <p style="text-align:center;color:#999;">跨月比較（待實作）</p>
  </div>
</template>

<script setup>
defineProps({ currentYear: Number, currentMonth: Number })
defineEmits(['drill-down'])
</script>
```

**Step 4: Create placeholder HeatmapChart**

Create `src/components/HeatmapChart.vue`:

```vue
<template>
  <div>
    <div class="year-nav">
      <button @click="$emit('update:year', year - 1)">&lt;</button>
      <span>{{ year }} 年</span>
      <button @click="$emit('update:year', year + 1)">&gt;</button>
    </div>
    <p style="text-align:center;color:#999;">消費熱力圖（待實作）</p>
  </div>
</template>

<script setup>
defineProps({ year: Number })
defineEmits(['update:year', 'drill-down'])
</script>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.year-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
</style>
```

**Step 5: Run tests and dev server to verify no regressions**

Run: `npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/views/ReportView.vue src/components/YearlyTrendChart.vue src/components/MonthCompareChart.vue src/components/HeatmapChart.vue
git commit -m "feat: add tab navigation to ReportView with placeholder charts"
```

---

### Task 6: Implement YearlyTrendChart

**Files:**
- Modify: `src/components/YearlyTrendChart.vue`

**Step 1: Implement the full component**

Replace `src/components/YearlyTrendChart.vue`:

```vue
<template>
  <div>
    <div class="year-nav">
      <button @click="$emit('update:year', year - 1)">&lt;</button>
      <span>{{ year }} 年</span>
      <button @click="$emit('update:year', year + 1)">&gt;</button>
    </div>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'expense' }" @click="mode = 'expense'">月支出</button>
      <button :class="{ active: mode === 'triple' }" @click="mode = 'triple'">收支結餘</button>
      <button :class="{ active: mode === 'stacked' }" @click="mode = 'stacked'">分類趨勢</button>
    </div>

    <Line v-if="mode !== 'stacked'" :data="lineData" :options="lineOptions" @click="handleClick" ref="chartRef" />
    <Line v-else :data="stackedData" :options="stackedOptions" @click="handleClick" ref="chartRef" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale,
  Tooltip, Legend, Filler
} from 'chart.js'
import { useTransactionsStore } from '../stores/transactions.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

const props = defineProps({ year: Number })
const emit = defineEmits(['update:year', 'drill-down'])

const txStore = useTransactionsStore()
const mode = ref('expense')
const chartRef = ref(null)

const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const yearlySummary = computed(() => txStore.getYearlySummary(props.year))

const lineData = computed(() => {
  const summary = yearlySummary.value
  if (mode.value === 'expense') {
    return {
      labels,
      datasets: [{
        label: '支出',
        data: summary.map(m => m.expense),
        borderColor: '#F44336',
        backgroundColor: 'rgba(244,67,54,0.1)',
        fill: true, tension: 0.3
      }]
    }
  }
  return {
    labels,
    datasets: [
      { label: '支出', data: summary.map(m => m.expense), borderColor: '#F44336', tension: 0.3 },
      { label: '收入', data: summary.map(m => m.income), borderColor: '#4CAF50', tension: 0.3 },
      { label: '結餘', data: summary.map(m => m.balance), borderColor: '#2196F3', tension: 0.3 }
    ]
  }
})

const lineOptions = {
  responsive: true,
  plugins: { tooltip: { mode: 'index', intersect: false } },
  scales: { y: { beginAtZero: true } },
  onClick: (event, elements) => {
    if (elements.length > 0) {
      const monthIndex = elements[0].index
      const month = monthIndex + 1
      const txs = txStore.getMonthTransactions(props.year, month)
      emit('drill-down', { title: `${props.year} 年 ${month} 月`, transactions: txs })
    }
  }
}

const categoryBreakdown = computed(() => txStore.getYearlyCategoryBreakdown(props.year, 5))

const stackColors = ['#F44336', '#2196F3', '#FF9800', '#9C27B0', '#4CAF50', '#795548']

const stackedData = computed(() => {
  const bd = categoryBreakdown.value
  return {
    labels,
    datasets: bd.categories.map((cat, i) => ({
      label: cat,
      data: bd.months.map(m => m.data[cat] || 0),
      backgroundColor: stackColors[i % stackColors.length] + '80',
      borderColor: stackColors[i % stackColors.length],
      fill: true, tension: 0.3
    }))
  }
})

const stackedOptions = {
  responsive: true,
  plugins: { tooltip: { mode: 'index', intersect: false } },
  scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } },
  onClick: (event, elements) => {
    if (elements.length > 0) {
      const monthIndex = elements[0].index
      const month = monthIndex + 1
      const txs = txStore.getMonthTransactions(props.year, month).filter(t => t.type === 'expense')
      emit('drill-down', { title: `${props.year} 年 ${month} 月支出`, transactions: txs })
    }
  }
}
</script>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.year-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.mode-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.mode-toggle button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 13px;
}
.mode-toggle button.active { background: #E8F5E9; border-color: #4CAF50; color: #2E7D32; }
</style>
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/components/YearlyTrendChart.vue
git commit -m "feat: implement YearlyTrendChart with expense, triple-line, and stacked modes"
```

---

### Task 7: Implement MonthCompareChart

**Files:**
- Modify: `src/components/MonthCompareChart.vue`

**Step 1: Implement the full component**

Replace `src/components/MonthCompareChart.vue`:

```vue
<template>
  <div>
    <div class="mode-toggle">
      <button :class="{ active: mode === 'dual' }" @click="mode = 'dual'">雙月比較</button>
      <button :class="{ active: mode === 'multi' }" @click="mode = 'multi'">多月疊圖</button>
      <button :class="{ active: mode === 'period' }" @click="mode = 'period'">同期比較</button>
    </div>

    <!-- Mode A: Dual month comparison -->
    <div v-if="mode === 'dual'">
      <div class="dual-selectors">
        <input type="month" v-model="monthA" />
        <span>vs</span>
        <input type="month" v-model="monthB" />
      </div>
      <div class="dual-pies">
        <div class="pie-col">
          <h4>{{ monthA }}</h4>
          <PieChart :breakdown="breakdownA" />
        </div>
        <div class="pie-col">
          <h4>{{ monthB }}</h4>
          <PieChart :breakdown="breakdownB" />
        </div>
      </div>
      <div class="diff-table" v-if="comparison">
        <div class="diff-header">
          <span>分類</span><span>{{ monthA }}</span><span>{{ monthB }}</span><span>增減</span>
        </div>
        <div
          v-for="(val, cat) in comparison.categories"
          :key="cat"
          class="diff-row"
          @click="drillDownCategory(cat)"
        >
          <span>{{ cat }}</span>
          <span>${{ val.monthA.toLocaleString() }}</span>
          <span>${{ val.monthB.toLocaleString() }}</span>
          <span :class="val.diff > 0 ? 'up' : val.diff < 0 ? 'down' : ''">
            {{ val.diff > 0 ? '+' : '' }}${{ val.diff.toLocaleString() }}
            ({{ val.pct > 0 ? '+' : '' }}{{ val.pct }}%)
          </span>
        </div>
        <div class="diff-row total">
          <span>合計</span>
          <span>${{ comparison.totalA.toLocaleString() }}</span>
          <span>${{ comparison.totalB.toLocaleString() }}</span>
          <span :class="comparison.diff > 0 ? 'up' : comparison.diff < 0 ? 'down' : ''">
            {{ comparison.diff > 0 ? '+' : '' }}${{ comparison.diff.toLocaleString() }}
          </span>
        </div>
      </div>
    </div>

    <!-- Mode B: Multi-month overlay -->
    <div v-if="mode === 'multi'">
      <div class="multi-selectors">
        <label v-for="m in availableMonths" :key="m">
          <input type="checkbox" :value="m" v-model="selectedMonths" :disabled="!selectedMonths.includes(m) && selectedMonths.length >= 4" />
          {{ m }}
        </label>
      </div>
      <Bar v-if="selectedMonths.length" :data="multiBarData" :options="multiBarOptions" />
    </div>

    <!-- Mode C: Period comparison -->
    <div v-if="mode === 'period'">
      <div class="period-cards">
        <div class="period-card" @click="goToDual(currentYear, currentMonth, prevYear, prevMonth)">
          <h4>本月 vs 上月</h4>
          <div v-if="vsLastMonth" class="period-summary">
            <span :class="vsLastMonth.diff > 0 ? 'up' : 'down'">
              {{ vsLastMonth.diff > 0 ? '+' : '' }}${{ vsLastMonth.diff.toLocaleString() }}
              ({{ vsLastMonth.pct > 0 ? '+' : '' }}{{ vsLastMonth.pct }}%)
            </span>
            <div class="top-changes">
              <div v-for="c in topChangesLastMonth" :key="c.name" class="change-item">
                {{ c.name }}: {{ c.diff > 0 ? '+' : '' }}${{ c.diff.toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
        <div class="period-card" @click="goToDual(currentYear, currentMonth, currentYear - 1, currentMonth)">
          <h4>本月 vs 去年同月</h4>
          <div v-if="vsLastYear" class="period-summary">
            <span :class="vsLastYear.diff > 0 ? 'up' : 'down'">
              {{ vsLastYear.diff > 0 ? '+' : '' }}${{ vsLastYear.diff.toLocaleString() }}
              ({{ vsLastYear.pct > 0 ? '+' : '' }}{{ vsLastYear.pct }}%)
            </span>
            <div class="top-changes">
              <div v-for="c in topChangesLastYear" :key="c.name" class="change-item">
                {{ c.name }}: {{ c.diff > 0 ? '+' : '' }}${{ c.diff.toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { useTransactionsStore } from '../stores/transactions.js'
import PieChart from './PieChart.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps({ currentYear: Number, currentMonth: Number })
const emit = defineEmits(['drill-down'])

const txStore = useTransactionsStore()
const mode = ref('dual')

// Helpers
function parseMonth(str) {
  const [y, m] = str.split('-').map(Number)
  return { year: y, month: m }
}
function formatMonth(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

// Dual mode
const monthA = ref(formatMonth(
  props.currentMonth === 1 ? props.currentYear - 1 : props.currentYear,
  props.currentMonth === 1 ? 12 : props.currentMonth - 1
))
const monthB = ref(formatMonth(props.currentYear, props.currentMonth))

const breakdownA = computed(() => {
  const { year, month } = parseMonth(monthA.value)
  return txStore.getCategoryBreakdown(year, month)
})
const breakdownB = computed(() => {
  const { year, month } = parseMonth(monthB.value)
  return txStore.getCategoryBreakdown(year, month)
})
const comparison = computed(() => {
  const a = parseMonth(monthA.value)
  const b = parseMonth(monthB.value)
  return txStore.getMonthComparison(a.year, a.month, b.year, b.month)
})

function drillDownCategory(cat) {
  const b = parseMonth(monthB.value)
  const txs = txStore.getMonthTransactions(b.year, b.month).filter(t => t.type === 'expense')
  emit('drill-down', { title: `${monthB.value} / ${cat}`, transactions: txs })
}

// Multi mode
const availableMonths = computed(() => {
  const months = []
  for (let i = 11; i >= 0; i--) {
    let y = props.currentYear, m = props.currentMonth - i
    if (m <= 0) { m += 12; y-- }
    months.push(formatMonth(y, m))
  }
  return months
})
const selectedMonths = ref([
  formatMonth(
    props.currentMonth === 1 ? props.currentYear - 1 : props.currentYear,
    props.currentMonth === 1 ? 12 : props.currentMonth - 1
  ),
  formatMonth(props.currentYear, props.currentMonth)
])

const multiBarColors = ['#F44336', '#2196F3', '#FF9800', '#9C27B0']

const multiBarData = computed(() => {
  // Gather all categories across selected months
  const allCats = new Set()
  const monthData = selectedMonths.value.map(m => {
    const { year, month } = parseMonth(m)
    const bd = txStore.getCategoryBreakdown(year, month)
    Object.keys(bd).forEach(c => allCats.add(c))
    return { label: m, breakdown: bd }
  })
  const categories = [...allCats].sort()
  return {
    labels: categories,
    datasets: monthData.map((md, i) => ({
      label: md.label,
      data: categories.map(c => md.breakdown[c] || 0),
      backgroundColor: multiBarColors[i % multiBarColors.length]
    }))
  }
})

const multiBarOptions = {
  responsive: true,
  plugins: { tooltip: { mode: 'index' } },
  scales: { y: { beginAtZero: true } }
}

// Period mode
const prevYear = computed(() => props.currentMonth === 1 ? props.currentYear - 1 : props.currentYear)
const prevMonth = computed(() => props.currentMonth === 1 ? 12 : props.currentMonth - 1)

const vsLastMonth = computed(() =>
  txStore.getMonthComparison(prevYear.value, prevMonth.value, props.currentYear, props.currentMonth)
)
const vsLastYear = computed(() =>
  txStore.getMonthComparison(props.currentYear - 1, props.currentMonth, props.currentYear, props.currentMonth)
)

function getTopChanges(comp) {
  if (!comp) return []
  return Object.entries(comp.categories)
    .map(([name, val]) => ({ name, diff: val.diff }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3)
}

const topChangesLastMonth = computed(() => getTopChanges(vsLastMonth.value))
const topChangesLastYear = computed(() => getTopChanges(vsLastYear.value))

function goToDual(yA, mA, yB, mB) {
  mode.value = 'dual'
  monthA.value = formatMonth(yB, mB)
  monthB.value = formatMonth(yA, mA)
}
</script>

<style scoped>
.mode-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.mode-toggle button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 13px;
}
.mode-toggle button.active { background: #E8F5E9; border-color: #4CAF50; color: #2E7D32; }

.dual-selectors { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
.dual-selectors input { padding: 6px; border: 1px solid #ddd; border-radius: 8px; }
.dual-pies { display: flex; gap: 8px; }
.pie-col { flex: 1; text-align: center; }
.pie-col h4 { margin: 0 0 8px; font-size: 14px; color: #666; }

.diff-table { margin-top: 16px; font-size: 13px; }
.diff-header { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 8px 0; border-bottom: 2px solid #ddd; font-weight: bold; }
.diff-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 6px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
.diff-row:hover { background: #fafafa; }
.diff-row.total { font-weight: bold; border-top: 2px solid #ddd; }
.up { color: #F44336; }
.down { color: #4CAF50; }

.multi-selectors { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; font-size: 13px; }
.multi-selectors label { display: flex; align-items: center; gap: 4px; }

.period-cards { display: flex; flex-direction: column; gap: 12px; }
.period-card {
  background: #f9f9f9; border-radius: 12px; padding: 16px; cursor: pointer;
}
.period-card:hover { background: #f0f0f0; }
.period-card h4 { margin: 0 0 8px; }
.period-summary span { font-size: 20px; font-weight: bold; }
.top-changes { margin-top: 8px; }
.change-item { font-size: 13px; color: #666; padding: 2px 0; }
</style>
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/components/MonthCompareChart.vue
git commit -m "feat: implement MonthCompareChart with dual, multi, and period modes"
```

---

### Task 8: Implement HeatmapChart

**Files:**
- Modify: `src/components/HeatmapChart.vue`

**Step 1: Implement the full component**

Replace `src/components/HeatmapChart.vue`:

```vue
<template>
  <div>
    <div class="year-nav">
      <button @click="$emit('update:year', year - 1)">&lt;</button>
      <span>{{ year }} 年</span>
      <button @click="$emit('update:year', year + 1)">&gt;</button>
    </div>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'weekdayHour' }" @click="mode = 'weekdayHour'">星期x時段</button>
      <button :class="{ active: mode === 'calendar' }" @click="mode = 'calendar'">日曆格</button>
      <button :class="{ active: mode === 'categoryMonth' }" @click="mode = 'categoryMonth'">分類x月份</button>
    </div>

    <!-- Weekday x Hour heatmap -->
    <div v-if="mode === 'weekdayHour'">
      <div class="range-toggle">
        <button v-for="r in ranges" :key="r.label" :class="{ active: range === r.value }" @click="range = r.value">
          {{ r.label }}
        </button>
      </div>
      <div class="heatmap-grid weekday-hour">
        <div class="heatmap-row header">
          <span class="label"></span>
          <span v-for="h in 24" :key="h" class="cell header-cell">{{ h - 1 }}</span>
        </div>
        <div v-for="(dayName, d) in weekdays" :key="d" class="heatmap-row">
          <span class="label">{{ dayName }}</span>
          <span
            v-for="h in 24"
            :key="h"
            class="cell"
            :style="{ backgroundColor: getWeekdayHourColor(d, h - 1) }"
            :title="getWeekdayHourTooltip(d, h - 1)"
            @click="drillDownWeekdayHour(d, h - 1)"
          ></span>
        </div>
      </div>
    </div>

    <!-- Calendar heatmap (GitHub-style) -->
    <div v-if="mode === 'calendar'">
      <div class="calendar-grid">
        <div class="calendar-months">
          <span v-for="m in 12" :key="m" class="month-label">{{ m }}月</span>
        </div>
        <div class="calendar-rows">
          <div v-for="(dayName, d) in ['一','二','三','四','五','六','日']" :key="d" class="calendar-row">
            <span class="day-label">{{ d % 2 === 0 ? dayName : '' }}</span>
            <span
              v-for="(day, i) in calendarDays.filter(dd => dd.weekday === d)"
              :key="i"
              class="cal-cell"
              :style="{ backgroundColor: getCalendarColor(day.date) }"
              :title="getCalendarTooltip(day.date)"
              @click="drillDownDay(day.date)"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Category x Month heatmap -->
    <div v-if="mode === 'categoryMonth'">
      <div class="heatmap-grid cat-month">
        <div class="heatmap-row header">
          <span class="label cat-label"></span>
          <span v-for="m in 12" :key="m" class="cell header-cell">{{ m }}月</span>
        </div>
        <div v-for="cat in catMonthCategories" :key="cat" class="heatmap-row">
          <span class="label cat-label">{{ cat }}</span>
          <span
            v-for="m in 12"
            :key="m"
            class="cell"
            :style="{ backgroundColor: getCatMonthColor(cat, m) }"
            :title="getCatMonthTooltip(cat, m)"
            @click="drillDownCatMonth(cat, m)"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'

const props = defineProps({ year: Number })
const emit = defineEmits(['update:year', 'drill-down'])

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
const mode = ref('weekdayHour')
const range = ref(3)

const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
const ranges = [
  { label: '1月', value: 1 },
  { label: '3月', value: 3 },
  { label: '6月', value: 6 },
  { label: '1年', value: 12 }
]

// Color interpolation helper
function heatColor(value, max) {
  if (!value || !max) return '#ebedf0'
  const intensity = Math.min(value / max, 1)
  const levels = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
  const idx = Math.min(Math.floor(intensity * (levels.length - 1)), levels.length - 1)
  return levels[idx]
}

// Weekday x Hour
const weekdayHourData = computed(() => {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getFullYear(), now.getMonth() - range.value, now.getDate())
    .toISOString().split('T')[0]
  return txStore.getHeatmapByWeekdayHour(start, end)
})

const weekdayHourMax = computed(() =>
  Math.max(...weekdayHourData.value.map(d => d.total), 1)
)

function findWeekdayHour(weekday, hour) {
  return weekdayHourData.value.find(d => d.weekday === weekday && d.hour === hour)
}

function getWeekdayHourColor(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  return heatColor(d?.total || 0, weekdayHourMax.value)
}

function getWeekdayHourTooltip(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  if (!d) return `${weekdays[weekday]} ${hour}:00 — 無消費`
  return `${weekdays[weekday]} ${hour}:00-${hour + 1}:00：$${d.total.toLocaleString()}（${d.count} 筆）`
}

function drillDownWeekdayHour(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  if (!d || !d.count) return
  // Filter transactions matching weekday and hour
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getFullYear(), now.getMonth() - range.value, now.getDate())
    .toISOString().split('T')[0]
  const txs = txStore.transactions.filter(t => {
    if (!t.date || t.type !== 'expense' || !t.date.includes('T')) return false
    if (t.date < start || t.date > end + '\uffff') return false
    const dt = new Date(t.date)
    return (dt.getDay() + 6) % 7 === weekday && dt.getHours() === hour
  })
  emit('drill-down', { title: `${weekdays[weekday]} ${hour}:00-${hour + 1}:00`, transactions: txs })
}

// Calendar
const calendarDays = computed(() => {
  const days = []
  const start = new Date(props.year, 0, 1)
  const end = new Date(props.year, 11, 31)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({
      date: d.toISOString().split('T')[0],
      weekday: (d.getDay() + 6) % 7  // Mon=0
    })
  }
  return days
})

const calendarData = computed(() => {
  const start = `${props.year}-01-01`
  const end = `${props.year}-12-31`
  return txStore.getHeatmapByDay(start, end)
})

const calendarMax = computed(() => {
  const vals = Object.values(calendarData.value).map(d => d.total)
  return Math.max(...vals, 1)
})

function getCalendarColor(date) {
  const d = calendarData.value[date]
  return heatColor(d?.total || 0, calendarMax.value)
}

function getCalendarTooltip(date) {
  const d = calendarData.value[date]
  if (!d) return `${date}：無消費`
  return `${date}：$${d.total.toLocaleString()}（${d.count} 筆）`
}

function drillDownDay(date) {
  const d = calendarData.value[date]
  if (!d) return
  const txs = txStore.transactions.filter(t =>
    t.type === 'expense' && t.date && t.date.startsWith(date)
  )
  emit('drill-down', { title: date, transactions: txs })
}

// Category x Month
const catMonthData = computed(() => txStore.getHeatmapByCategoryMonth(props.year, 8))

const catMonthCategories = computed(() => {
  const cats = new Set(catMonthData.value.map(d => d.category))
  return [...cats]
})

const catMonthMax = computed(() =>
  Math.max(...catMonthData.value.map(d => d.total), 1)
)

function findCatMonth(cat, month) {
  return catMonthData.value.find(d => d.category === cat && d.month === month)
}

function getCatMonthColor(cat, month) {
  const d = findCatMonth(cat, month)
  return heatColor(d?.total || 0, catMonthMax.value)
}

function getCatMonthTooltip(cat, month) {
  const d = findCatMonth(cat, month)
  if (!d || !d.total) return `${cat} / ${month}月：無消費`
  return `${cat} / ${month}月：$${d.total.toLocaleString()}`
}

function drillDownCatMonth(cat, month) {
  const d = findCatMonth(cat, month)
  if (!d || !d.total) return
  const prefix = `${props.year}-${String(month).padStart(2, '0')}`
  const txs = txStore.getMonthTransactions(props.year, month).filter(t => {
    if (t.type !== 'expense') return false
    const name = categoriesStore.getCategoryName(t.category) || '未分類'
    return name === cat
  })
  emit('drill-down', { title: `${cat} / ${props.year} 年 ${month} 月`, transactions: txs })
}
</script>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.year-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.mode-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.mode-toggle button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 13px;
}
.mode-toggle button.active { background: #E8F5E9; border-color: #4CAF50; color: #2E7D32; }

.range-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.range-toggle button {
  padding: 4px 10px; border: 1px solid #ddd; background: #fff;
  border-radius: 12px; cursor: pointer; font-size: 12px;
}
.range-toggle button.active { background: #E3F2FD; border-color: #2196F3; color: #1565C0; }

.heatmap-grid { overflow-x: auto; font-size: 11px; }
.heatmap-row { display: flex; align-items: center; }
.heatmap-row.header .header-cell { font-size: 10px; color: #999; text-align: center; }
.label { width: 40px; flex-shrink: 0; font-size: 11px; color: #666; text-align: right; padding-right: 4px; }
.cat-label { width: 60px; }
.cell { width: 16px; height: 16px; margin: 1px; border-radius: 2px; cursor: pointer; flex-shrink: 0; }
.cell:hover { outline: 1px solid #333; }

.calendar-grid { overflow-x: auto; }
.calendar-months { display: flex; margin-left: 24px; margin-bottom: 4px; }
.month-label { flex: 1; font-size: 11px; color: #666; }
.calendar-rows { display: flex; flex-direction: column; }
.calendar-row { display: flex; align-items: center; }
.day-label { width: 20px; font-size: 10px; color: #999; text-align: right; padding-right: 4px; flex-shrink: 0; }
.cal-cell { width: 12px; height: 12px; margin: 1px; border-radius: 2px; cursor: pointer; flex-shrink: 0; }
.cal-cell:hover { outline: 1px solid #333; }
</style>
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/components/HeatmapChart.vue
git commit -m "feat: implement HeatmapChart with weekday-hour, calendar, and category-month modes"
```

---

### Task 9: Final integration test and cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

**Step 2: Run dev server and verify**

Run: `npm run dev`
Manually verify:
- ReportView shows 4 tabs
- Monthly tab works as before
- Yearly trend tab shows line chart with 3 modes
- Month comparison tab shows dual/multi/period modes
- Heatmap tab shows 3 heatmap modes
- Drill down panel opens on chart click
- datetime-local input works in AddView

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete report visualization enhancement"
```
