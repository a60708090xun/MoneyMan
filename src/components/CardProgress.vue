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
