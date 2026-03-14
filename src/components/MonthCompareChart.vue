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
            <template v-if="val.pct !== null">({{ val.pct > 0 ? '+' : '' }}{{ val.pct }}%)</template>
            <template v-else>(新增)</template>
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
              <template v-if="vsLastMonth.pct !== null">({{ vsLastMonth.pct > 0 ? '+' : '' }}{{ vsLastMonth.pct }}%)</template>
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
              <template v-if="vsLastYear.pct !== null">({{ vsLastYear.pct > 0 ? '+' : '' }}{{ vsLastYear.pct }}%)</template>
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
import { useCategoriesStore } from '../stores/categories.js'
import PieChart from './PieChart.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps({ currentYear: Number, currentMonth: Number })
const emit = defineEmits(['drill-down'])

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
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
  const txs = txStore.getMonthTransactions(b.year, b.month).filter(t => {
    if (t.type !== 'expense') return false
    const name = categoriesStore.getCategoryName(t.category) || '未分類'
    return name === cat
  })
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
