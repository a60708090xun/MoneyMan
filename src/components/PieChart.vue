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
