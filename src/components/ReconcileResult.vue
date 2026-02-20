<template>
  <div class="reconcile-item" :class="item.status">
    <span class="status-icon">{{ icon }}</span>
    <div class="item-details">
      <div class="item-main">
        <span>{{ displayDate }}</span>
        <span>{{ displayMerchant }}</span>
        <span class="amount">${{ displayAmount.toLocaleString() }}</span>
      </div>
      <div class="item-note">{{ note }}</div>
    </div>
    <button v-if="item.status === 'bill_only'" class="quick-add" @click="$emit('quickAdd', item.billItem)">
      補記
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ item: Object })
defineEmits(['quickAdd'])

const icon = computed(() => {
  const icons = { matched: '✅', amount_mismatch: '⚠️', bill_only: '❌', manual_only: '🔍' }
  return icons[props.item.status]
})

const displayDate = computed(() => {
  const src = props.item.billItem || props.item.manualRecord
  return src?.date?.slice(5) || ''
})

const displayMerchant = computed(() =>
  props.item.billItem?.merchant || props.item.manualRecord?.note || ''
)

const displayAmount = computed(() =>
  props.item.billItem?.amount || props.item.manualRecord?.amount || 0
)

const note = computed(() => {
  if (props.item.status === 'amount_mismatch') return `你記 $${props.item.manualRecord.amount}（差 $${props.item.diff}）`
  if (props.item.status === 'bill_only') return '漏記'
  if (props.item.status === 'manual_only') return '帳單無此筆'
  return '已對帳'
})
</script>

<style scoped>
.reconcile-item { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid #f0f0f0; }
.status-icon { font-size: 18px; }
.item-details { flex: 1; }
.item-main { display: flex; gap: 8px; align-items: baseline; }
.amount { margin-left: auto; font-weight: bold; }
.item-note { font-size: 12px; color: #999; }
.quick-add { padding: 4px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
</style>
