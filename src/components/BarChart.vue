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
