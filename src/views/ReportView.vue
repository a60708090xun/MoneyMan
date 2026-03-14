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
