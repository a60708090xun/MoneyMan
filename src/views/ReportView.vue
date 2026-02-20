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
import { useCategoriesStore } from '../stores/categories.js'
import PieChart from '../components/PieChart.vue'
import BarChart from '../components/BarChart.vue'

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
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

onMounted(async () => {
  await categoriesStore.init()
  await txStore.loadAll()
})
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
