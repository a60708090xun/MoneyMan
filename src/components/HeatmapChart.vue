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
