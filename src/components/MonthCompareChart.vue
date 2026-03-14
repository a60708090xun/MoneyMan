<template>
  <div>
    <p style="text-align:center;color:#999;">跨月比較（待實作）</p>
  </div>
</template>

<script setup>
defineProps({ currentYear: Number, currentMonth: Number })
defineEmits(['drill-down'])
</script>
