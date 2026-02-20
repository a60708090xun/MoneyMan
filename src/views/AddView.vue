<template>
  <div class="add-view">
    <h2>{{ isEdit ? '編輯紀錄' : '新增紀錄' }}</h2>

    <div class="type-toggle">
      <button :class="{ active: form.type === 'expense' }" @click="switchType('expense')">支出</button>
      <button :class="{ active: form.type === 'income' }" @click="switchType('income')">收入</button>
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
      <label>大分類</label>
      <div class="category-grid">
        <button
          v-for="cat in parentCategories"
          :key="cat.id"
          :class="{ active: form.category === cat.id }"
          @click="selectParent(cat.id)"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
    </div>

    <div class="form-group" v-if="childCategories.length">
      <label>子分類</label>
      <div class="category-grid">
        <button
          v-for="cat in childCategories"
          :key="cat.id"
          :class="{ active: form.subcategory === cat.id }"
          @click="form.subcategory = cat.id"
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
      <label>帳戶</label>
      <input type="text" v-model="form.account" placeholder="現金" />
    </div>

    <div class="form-group">
      <label>備註</label>
      <input type="text" v-model="form.note" placeholder="選填" />
    </div>

    <button class="save-btn" @click="save" :disabled="!form.amount">
      {{ isEdit ? '更新' : '儲存' }}
    </button>

    <button v-if="isEdit" class="delete-btn" @click="remove">刪除此筆</button>
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
  category: null,
  subcategory: null,
  channel: '一般',
  cardId: null,
  date: today,
  note: '',
  account: '現金'
})

const parentCategories = computed(() => categoriesStore.getParents(form.type))
const childCategories = computed(() => {
  if (!form.category) return []
  return categoriesStore.getChildren(form.category)
})

function selectParent(id) {
  form.category = id
  const children = categoriesStore.getChildren(id)
  form.subcategory = children.length > 0 ? children[0].id : null
}

function switchType(type) {
  form.type = type
  form.category = null
  form.subcategory = null
  const parents = categoriesStore.getParents(type)
  if (parents.length) selectParent(parents[0].id)
}

onMounted(async () => {
  await categoriesStore.init()
  await cardsStore.init()
  if (route.params.id) {
    const tx = await getRecord('transactions', Number(route.params.id))
    if (tx) Object.assign(form, tx)
  } else {
    const parents = categoriesStore.getParents(form.type)
    if (parents.length) selectParent(parents[0].id)
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

async function remove() {
  if (!confirm('確定刪除這筆紀錄？')) return
  try {
    await txStore.deleteTransaction(Number(route.params.id))
    router.push('/')
  } catch (e) {
    alert('刪除失敗：' + e.message)
  }
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
.delete-btn {
  width: 100%; padding: 14px; background: none; color: #F44336;
  border: 1px solid #F44336; border-radius: 8px; font-size: 16px;
  cursor: pointer; margin-top: 8px;
}
</style>
