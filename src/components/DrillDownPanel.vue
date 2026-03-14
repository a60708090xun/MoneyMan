<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="visible" class="drilldown-overlay" @click.self="$emit('close')">
        <div class="drilldown-panel">
          <div class="panel-header">
            <h3>{{ title }}</h3>
            <button class="close-btn" @click="$emit('close')">&times;</button>
          </div>
          <div class="panel-body">
            <div v-if="!transactions.length" class="empty">沒有交易紀錄</div>
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="tx-row"
              @click="navigateToEdit(tx.id)"
            >
              <div class="tx-left">
                <span class="tx-date">{{ formatDate(tx.date) }}</span>
                <span class="tx-category">{{ getCategoryName(tx.category) }}</span>
                <span v-if="tx.note" class="tx-note">{{ tx.note }}</span>
              </div>
              <span class="tx-amount" :class="tx.type">
                {{ tx.type === 'income' ? '+' : '-' }}${{ tx.amount.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useCategoriesStore } from '../stores/categories.js'

defineProps({
  visible: Boolean,
  title: { type: String, default: '交易明細' },
  transactions: { type: Array, default: () => [] }
})
defineEmits(['close'])

const router = useRouter()
const categoriesStore = useCategoriesStore()

function navigateToEdit(id) {
  router.push(`/add/${id}`)
}

function getCategoryName(id) {
  return categoriesStore.getCategoryName(id) || '未分類'
}

function formatDate(date) {
  if (!date) return ''
  return date.includes('T') ? date.replace('T', ' ') : date
}
</script>

<style scoped>
.drilldown-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center;
}
.drilldown-panel {
  background: #fff; border-radius: 16px 16px 0 0; width: 100%; max-width: 480px;
  max-height: 60vh; display: flex; flex-direction: column;
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px; border-bottom: 1px solid #eee;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
.panel-body { overflow-y: auto; padding: 8px 16px 16px; }
.empty { text-align: center; color: #999; padding: 24px; }
.tx-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f5f5f5; cursor: pointer;
}
.tx-row:hover { background: #fafafa; }
.tx-left { display: flex; flex-direction: column; gap: 2px; }
.tx-date { font-size: 12px; color: #999; }
.tx-category { font-size: 14px; }
.tx-note { font-size: 12px; color: #666; }
.tx-amount { font-weight: bold; white-space: nowrap; }
.tx-amount.expense { color: #F44336; }
.tx-amount.income { color: #4CAF50; }

.panel-enter-active, .panel-leave-active { transition: all 0.3s ease; }
.panel-enter-from .drilldown-panel, .panel-leave-to .drilldown-panel { transform: translateY(100%); }
.panel-enter-from, .panel-leave-to { opacity: 0; }
</style>
