<template>
  <div class="reconcile-view">
    <h2>帳單對帳</h2>

    <div v-if="!results">
      <div class="upload-area">
        <input type="file" accept=".pdf" @change="onFileSelect" ref="fileInput" hidden />
        <button class="upload-btn" @click="$refs.fileInput.click()">選擇 PDF 帳單</button>
      </div>

      <div v-if="needPassword" class="form-group">
        <label>PDF 密碼</label>
        <input type="password" v-model="password" placeholder="身分證字號或其他密碼" />
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button @click="processPdf">解鎖並匯入</button>
          <button @click="reset" style="background: #999;">重新選擇</button>
        </div>
      </div>

      <div v-if="loading" class="loading">解析中...</div>
    </div>

    <div v-else>
      <div class="summary-bar">
        對帳率：{{ matchRate }}%（{{ matchedCount }}/{{ totalBillItems }} 筆吻合）
      </div>

      <ReconcileResult
        v-for="(item, idx) in results"
        :key="idx"
        :item="item"
        @quick-add="quickAdd"
      />

      <button class="reset-btn" @click="reset">重新對帳</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { parseStatement } from '../services/parsers/index.js'
import { reconcile } from '../services/reconcile.js'
import ReconcileResult from '../components/ReconcileResult.vue'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

const txStore = useTransactionsStore()
const results = ref(null)
const parsedBillItems = ref([])
const needPassword = ref(false)
const password = ref('')
const loading = ref(false)
let selectedFile = null

const matchedCount = computed(() => results.value?.filter(r => r.status === 'matched').length || 0)
const totalBillItems = computed(() => results.value?.filter(r => r.billItem).length || 0)
const matchRate = computed(() => {
  if (!totalBillItems.value) return 0
  return Math.round((matchedCount.value / totalBillItems.value) * 100)
})

onMounted(() => txStore.loadAll())

function onFileSelect(e) {
  selectedFile = e.target.files[0]
  if (selectedFile) {
    needPassword.value = true
  }
}

async function processPdf() {
  if (!selectedFile) return
  loading.value = true

  try {
    const arrayBuffer = await selectedFile.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password: password.value || undefined })
    const pdf = await loadingTask.promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      fullText += content.items.map(item => item.str).join(' ') + '\n'
    }

    const parsed = parseStatement(fullText)

    if (parsed.raw) {
      alert('無法自動辨識銀行格式，請手動對應欄位（功能開發中）')
      loading.value = false
      return
    }

    parsedBillItems.value = parsed

    // Run reconciliation
    const now = new Date()
    const monthTxs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
    results.value = reconcile(parsedBillItems.value, monthTxs)
  } catch (err) {
    if (err.name === 'PasswordException') {
      password.value = ''
      alert('密碼錯誤，請重新輸入')
    } else {
      needPassword.value = false
      password.value = ''
      selectedFile = null
      alert('PDF 解析失敗：' + err.message)
    }
  } finally {
    loading.value = false
  }
}

async function quickAdd(billItem) {
  await txStore.addTransaction({
    amount: billItem.amount,
    type: 'expense',
    category: '',
    channel: '一般',
    cardId: null,
    date: billItem.date,
    note: billItem.merchant
  })
  const now = new Date()
  const monthTxs = txStore.getMonthTransactions(now.getFullYear(), now.getMonth() + 1)
  results.value = reconcile(parsedBillItems.value, monthTxs)
}

function reset() {
  results.value = null
  parsedBillItems.value = []
  needPassword.value = false
  password.value = ''
  selectedFile = null
}
</script>

<style scoped>
.reconcile-view { max-width: 480px; margin: 0 auto; }
.upload-area { text-align: center; padding: 32px; }
.upload-btn { padding: 16px 32px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
.form-group { margin: 16px 0; }
.form-group label { display: block; margin-bottom: 4px; }
.form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; }
.form-group button { padding: 10px 24px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; }
.summary-bar { background: #E8F5E9; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 16px; font-weight: bold; }
.loading { text-align: center; padding: 32px; color: #999; }
.reset-btn { width: 100%; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; margin-top: 16px; }
</style>
