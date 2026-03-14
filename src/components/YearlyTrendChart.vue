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

    <Line v-if="mode !== 'stacked'" :data="lineData" :options="lineOptions" />
    <Line v-else :data="stackedData" :options="stackedOptions" />
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
