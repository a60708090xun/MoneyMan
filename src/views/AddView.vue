<template>
  <div class="add-view">
    <h2>{{ isEdit ? '編輯紀錄' : '新增紀錄' }}</h2>

    <div class="type-toggle">
      <button :class="{ active: form.type === 'expense' }" @click="form.type = 'expense'">支出</button>
      <button :class="{ active: form.type === 'income' }" @click="form.type = 'income'">收入</button>
    </div>

    <div class="form-group">
      <label>金額</label>
      <input type="number" v-model.number="form.amount" placeholder="0" inputmode="decimal" />
    </div>

    <div class="form-group">
      <label>日期</label>
      <input type="date" v-model="form.date" />
    </div>

    <div class="form-group">
      <label>分類</label>
      <div class="category-grid">
        <button
          v-for="cat in categoriesStore.categories"
          :key="cat.id"
          :class="{ active: form.category === cat.name }"
          @click="form.category = cat.name"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
    </div>

    <div class="form-group" v-if="form.type === 'expense'">
      <label>通路</label>
      <select v-model="form.channel">
        <option value="一般">一般</option>
        <option value="網購">網購</option>
        <option value="超商">超商</option>
        <option value="餐飲">餐飲</option>
        <option value="交通">交通</option>
      </select>
    </div>

    <div class="form-group" v-if="form.type === 'expense' && cardsStore.cards.length">
      <label>信用卡</label>
      <select v-model="form.cardId">
        <option :value="null">不指定</option>
        <option v-for="card in cardsStore.cards" :key="card.id" :value="card.id">
          {{ card.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>備註</label>
      <input type="text" v-model="form.note" placeholder="選填" />
    </div>

    <button class="save-btn" @click="save" :disabled="!form.amount">
      {{ isEdit ? '更新' : '儲存' }}
    </button>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import { useCardsStore } from '../stores/cards.js'
import { getRecord } from '../services/db.js'

const route = useRoute()
const router = useRouter()
const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
const cardsStore = useCardsStore()

const isEdit = computed(() => !!route.params.id)
const today = new Date().toISOString().split('T')[0]

const form = reactive({
  amount: null,
  type: 'expense',
  category: '',
  channel: '一般',
  cardId: null,
  date: today,
  note: ''
})

onMounted(async () => {
  await categoriesStore.init()
  await cardsStore.init()
  if (route.params.id) {
    const tx = await getRecord('transactions', Number(route.params.id))
    if (tx) Object.assign(form, tx)
  }
})

async function save() {
  if (!form.amount) return
  if (isEdit.value) {
    await txStore.editTransaction({ ...form, id: Number(route.params.id) })
  } else {
    await txStore.addTransaction({ ...form })
  }
  router.push('/')
}
</script>

<style scoped>
.add-view { max-width: 480px; margin: 0 auto; }
.type-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
.type-toggle button {
  flex: 1; padding: 8px; border: 1px solid #ddd; background: #fff;
  border-radius: 8px; cursor: pointer;
}
.type-toggle button.active { background: #4CAF50; color: white; border-color: #4CAF50; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 14px; color: #666; margin-bottom: 4px; }
.form-group input, .form-group select {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;
}
.category-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.category-grid button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 14px;
}
.category-grid button.active { background: #E8F5E9; border-color: #4CAF50; }
.save-btn {
  width: 100%; padding: 14px; background: #4CAF50; color: white;
  border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 16px;
}
.save-btn:disabled { background: #ccc; }
</style>
