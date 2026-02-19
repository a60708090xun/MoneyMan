<template>
  <div class="cards-view">
    <h2>信用卡管理</h2>

    <div v-for="card in cardsStore.cards" :key="card.id">
      <CardProgress :card="card" :spent="getSpent(card.id)" />
      <div class="card-actions">
        <button @click="editCard(card)">編輯</button>
        <button @click="removeCard(card.id)" class="delete">刪除</button>
      </div>
    </div>

    <button class="add-btn" @click="showForm = true">+ 新增信用卡</button>

    <div v-if="showForm" class="card-form">
      <h3>{{ editingCard ? '編輯' : '新增' }}信用卡</h3>
      <div class="form-group">
        <label>名稱</label>
        <input v-model="form.name" />
      </div>
      <div class="form-group">
        <label>銀行</label>
        <input v-model="form.bank" />
      </div>
      <div class="form-group">
        <label>結算日（每月幾號）</label>
        <input type="number" v-model.number="form.billingCycleDay" min="1" max="31" />
      </div>
      <!-- Channel Rules -->
      <div class="form-group">
        <label>通路回饋規則</label>
        <div v-for="(rule, i) in form.channelRules" :key="i" class="rule-row">
          <select v-model="rule.channel">
            <option value="一般">一般</option>
            <option value="網購">網購</option>
            <option value="超商">超商</option>
            <option value="餐飲">餐飲</option>
            <option value="交通">交通</option>
          </select>
          <input type="number" v-model.number="rule.rate" step="0.01" placeholder="回饋率" style="width: 80px;" />
          <input type="number" v-model.number="rule.monthlyCap" placeholder="月上限（選填）" style="width: 100px;" />
          <button @click="form.channelRules.splice(i, 1)" class="delete-btn">✕</button>
        </div>
        <button @click="form.channelRules.push({ channel: '一般', rate: 0.01, monthlyCap: null })" class="add-rule-btn">+ 新增通路規則</button>
      </div>

      <!-- Thresholds -->
      <div class="form-group">
        <label>消費門檻</label>
        <div v-for="(t, i) in form.thresholds" :key="i" class="rule-row">
          <input type="number" v-model.number="t.amount" placeholder="門檻金額" style="width: 120px;" />
          <input type="number" v-model.number="t.rewardValue" placeholder="回饋金額" style="width: 100px;" />
          <button @click="form.thresholds.splice(i, 1)" class="delete-btn">✕</button>
        </div>
        <button @click="form.thresholds.push({ amount: 0, rewardValue: 0 })" class="add-rule-btn">+ 新增門檻</button>
      </div>

      <button @click="saveCard">儲存</button>
      <button @click="showForm = false">取消</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useCardsStore } from '../stores/cards.js'
import { useTransactionsStore } from '../stores/transactions.js'
import CardProgress from '../components/CardProgress.vue'

const cardsStore = useCardsStore()
const txStore = useTransactionsStore()

const showForm = ref(false)
const editingCard = ref(null)
const form = reactive({ name: '', bank: '', billingCycleDay: 1, thresholds: [], channelRules: [] })

onMounted(async () => {
  await cardsStore.init()
  await txStore.loadAll()
})

function getSpent(cardId) {
  const now = new Date()
  const txs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
  return txs.filter(t => t.cardId === cardId && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
}

function editCard(card) {
  editingCard.value = card
  Object.assign(form, JSON.parse(JSON.stringify(card)))
  showForm.value = true
}

async function saveCard() {
  if (editingCard.value) {
    await cardsStore.editCard({ ...form, id: editingCard.value.id })
  } else {
    await cardsStore.addCard({ ...form })
  }
  showForm.value = false
  editingCard.value = null
  Object.assign(form, { name: '', bank: '', billingCycleDay: 1, thresholds: [], channelRules: [] })
}

async function removeCard(id) {
  if (confirm('確定刪除這張卡？')) {
    await cardsStore.deleteCard(id)
  }
}
</script>

<style scoped>
.cards-view { max-width: 480px; margin: 0 auto; }
.card-actions { display: flex; gap: 8px; margin-bottom: 16px; }
.card-actions button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; }
.card-actions .delete { color: #F44336; border-color: #F44336; }
.add-btn { width: 100%; padding: 12px; border: 2px dashed #ddd; background: none; border-radius: 8px; cursor: pointer; color: #666; }
.card-form { background: #f9f9f9; padding: 16px; border-radius: 12px; margin-top: 16px; }
.form-group { margin-bottom: 8px; }
.form-group label { display: block; font-size: 14px; color: #666; }
.form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.rule-row { display: flex; gap: 4px; align-items: center; margin-bottom: 4px; }
.rule-row select, .rule-row input { padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.delete-btn { background: none; border: none; color: #F44336; cursor: pointer; font-size: 16px; padding: 4px; }
.add-rule-btn { background: none; border: 1px dashed #999; border-radius: 4px; padding: 6px 12px; cursor: pointer; color: #666; font-size: 13px; margin-top: 4px; }
</style>
