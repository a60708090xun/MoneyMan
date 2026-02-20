<template>
  <div class="home-view">
    <h2>MoneyMan</h2>

    <div class="month-nav">
      <button @click="prevMonth">&lt;</button>
      <span>{{ year }}年 {{ month }}月</span>
      <button @click="nextMonth">&gt;</button>
    </div>

    <div class="summary-card">
      <div class="summary-row">
        <span>收入</span>
        <span class="income">+${{ summary.income.toLocaleString() }}</span>
      </div>
      <div class="summary-row">
        <span>支出</span>
        <span class="expense">-${{ summary.expense.toLocaleString() }}</span>
      </div>
      <div class="summary-row total">
        <span>結餘</span>
        <span :class="summary.balance >= 0 ? 'income' : 'expense'">
          ${{ summary.balance.toLocaleString() }}
        </span>
      </div>
    </div>

    <div v-if="cardsStore.cards.length">
      <h3>卡片進度</h3>
      <CardProgress
        v-for="card in cardsStore.cards"
        :key="card.id"
        :card="card"
        :spent="getCardSpent(card.id)"
      />
      <CardRecommend
        :cards="cardsStore.cards"
        :transactions="monthTxs"
      />
    </div>

    <h3>最近紀錄</h3>
    <div v-if="recentTx.length === 0" class="empty">還沒有紀錄</div>
    <div v-for="tx in recentTx" :key="tx.id" class="tx-item" @click="editTx(tx.id)">
      <div class="tx-left">
        <span class="tx-category">{{ categoriesStore.getFullCategoryName(tx.category, tx.subcategory) }}</span>
        <span class="tx-note">{{ tx.note || tx.channel || '' }}</span>
      </div>
      <span :class="tx.type === 'income' ? 'income' : 'expense'">
        {{ tx.type === 'income' ? '+' : '-' }}${{ tx.amount.toLocaleString() }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import { useCardsStore } from '../stores/cards.js'
import CardProgress from '../components/CardProgress.vue'
import CardRecommend from '../components/CardRecommend.vue'

const router = useRouter()
const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
const cardsStore = useCardsStore()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

const summary = computed(() => txStore.getMonthlySummary(year.value, month.value))
const recentTx = computed(() =>
  txStore.getMonthTransactions(year.value, month.value)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
)
const monthTxs = computed(() => txStore.getMonthTransactions(year.value, month.value))

function getCardSpent(cardId) {
  return txStore.getMonthTransactions(year.value, month.value)
    .filter(t => t.cardId === cardId && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
}

function prevMonth() {
  if (month.value === 1) { month.value = 12; year.value-- }
  else month.value--
}
function nextMonth() {
  if (month.value === 12) { month.value = 1; year.value++ }
  else month.value++
}
function editTx(id) { router.push(`/add/${id}`) }

onMounted(async () => {
  await categoriesStore.init()
  await txStore.loadAll()
  await cardsStore.init()
})
</script>

<style scoped>
.month-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.month-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.summary-card { background: #f9f9f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
.summary-row.total { border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-weight: bold; }
.income { color: #4CAF50; }
.expense { color: #F44336; }
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
}
.tx-left { display: flex; flex-direction: column; }
.tx-category { font-weight: 500; }
.tx-note { font-size: 12px; color: #999; }
.empty { text-align: center; color: #999; padding: 40px 0; }
</style>
