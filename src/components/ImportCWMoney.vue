<template>
  <div class="import-cwmoney">
    <!-- Step 1: File selection -->
    <div v-if="step === 'select'">
      <input type="file" accept=".iDB,.idb" @change="onFileSelect" ref="fileInput" hidden />
      <button class="select-btn" @click="$refs.fileInput.click()">選擇 .iDB 檔案</button>
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <!-- Step 2: Date range -->
    <div v-if="step === 'range'">
      <div class="range-info">
        <p>資料範圍：{{ dateRange.min }} ～ {{ dateRange.max }}</p>
        <p>共 {{ dateRange.count.toLocaleString() }} 筆</p>
      </div>
      <div class="range-inputs">
        <input type="date" v-model="startDate" :min="dateRange.min" :max="dateRange.max" />
        <span>～</span>
        <input type="date" v-model="endDate" :min="dateRange.min" :max="dateRange.max" />
      </div>
      <p class="range-count">此區間共 {{ rangeCount.toLocaleString() }} 筆</p>
      <div class="actions">
        <button @click="step = 'select'" class="back-btn">返回</button>
        <button @click="loadPreview" class="next-btn" :disabled="loading">預覽</button>
      </div>
      <div v-if="loading" class="loading">載入中...</div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="step === 'preview'">
      <h4>匯入預覽</h4>

      <p class="section-label">最早 10 筆</p>
      <div class="preview-table">
        <div v-for="(r, i) in preview.first10" :key="'f'+i" class="preview-row">
          <span class="pr-date">{{ r.date }}</span>
          <span class="pr-type" :class="r.type">{{ r.type === 'income' ? '收' : '支' }}</span>
          <span class="pr-cat">{{ resolveCategoryDisplay(r) }}</span>
          <span class="pr-amount">${{ r.amount.toLocaleString() }}</span>
          <span class="pr-account">{{ r.account }}</span>
        </div>
      </div>

      <p class="section-label omit" v-if="rangeCount > 20">── 中間省略 {{ (rangeCount - 20).toLocaleString() }} 筆 ──</p>

      <p class="section-label">最晚 10 筆</p>
      <div class="preview-table">
        <div v-for="(r, i) in preview.last10" :key="'l'+i" class="preview-row">
          <span class="pr-date">{{ r.date }}</span>
          <span class="pr-type" :class="r.type">{{ r.type === 'income' ? '收' : '支' }}</span>
          <span class="pr-cat">{{ resolveCategoryDisplay(r) }}</span>
          <span class="pr-amount">${{ r.amount.toLocaleString() }}</span>
          <span class="pr-account">{{ r.account }}</span>
        </div>
      </div>

      <div class="preview-stats">
        <p>此區間共 {{ rangeCount.toLocaleString() }} 筆（支出 {{ expenseCount.toLocaleString() }} / 收入 {{ incomeCount.toLocaleString() }}）</p>
        <p>預估重複 {{ duplicateCount }} 筆將跳過</p>
      </div>

      <div class="actions">
        <button @click="step = 'range'" class="back-btn">返回調整</button>
        <button @click="doImport" class="next-btn">確認匯入</button>
      </div>
    </div>

    <!-- Step 4: Importing -->
    <div v-if="step === 'importing'">
      <p>匯入中... {{ importProgress.current }} / {{ importProgress.total }}</p>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Step 5: Done -->
    <div v-if="step === 'done'">
      <div class="done-msg">
        <p>匯入完成！</p>
        <p>新增 {{ importResult.added.toLocaleString() }} 筆</p>
        <p>新增分類 {{ importResult.categoriesAdded }} 個</p>
        <p>跳過重複 {{ importResult.skipped.toLocaleString() }} 筆</p>
      </div>
      <button @click="reset" class="next-btn">完成</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import {
  openIDB, parseDateRange, parseCategories, parseAccounts,
  parseRecords, getRecordCount, getPreviewRecords
} from '../services/cwmoney-parser.js'

const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const step = ref('select')
const error = ref('')
const loading = ref(false)

let sqliteDb = null
let cwCategories = null
let cwAccounts = null

const dateRange = ref({ min: '', max: '', count: 0 })
const startDate = ref('')
const endDate = ref('')
const rangeCount = ref(0)
const preview = ref({ first10: [], last10: [] })
const expenseCount = ref(0)
const incomeCount = ref(0)
const duplicateCount = ref(0)

const importProgress = ref({ current: 0, total: 0 })
const importResult = ref({ added: 0, skipped: 0, categoriesAdded: 0 })
const progressPercent = computed(() => {
  if (!importProgress.value.total) return 0
  return Math.round((importProgress.value.current / importProgress.value.total) * 100)
})

// CWMoney category lookup for display in preview
let cwCategoryLookup = {}

function buildCategoryLookup() {
  if (!cwCategories) return
  cwCategoryLookup = {}
  for (const p of cwCategories.expenseParents) {
    cwCategoryLookup[`expense_parent_${p.cwId}`] = p.name
  }
  for (const c of cwCategories.expenseChildren) {
    const parentName = cwCategoryLookup[`expense_parent_${c.cwParentId}`] || ''
    cwCategoryLookup[`expense_child_${c.cwId}`] = `${parentName}/${c.name}`
  }
  for (const p of cwCategories.incomeParents) {
    cwCategoryLookup[`income_parent_${p.cwId}`] = p.name
  }
  for (const c of cwCategories.incomeChildren) {
    const parentName = cwCategoryLookup[`income_parent_${c.cwParentId}`] || ''
    cwCategoryLookup[`income_child_${c.cwId}`] = `${parentName}/${c.name}`
  }
}

function resolveCategoryDisplay(record) {
  const prefix = record.type === 'income' ? 'income' : 'expense'
  return cwCategoryLookup[`${prefix}_child_${record.cwKinds}`]
    || cwCategoryLookup[`${prefix}_parent_${record.cwKind}`]
    || '未分類'
}

async function onFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  error.value = ''
  loading.value = true
  try {
    sqliteDb = await openIDB(file)
    cwCategories = parseCategories(sqliteDb)
    cwAccounts = parseAccounts(sqliteDb)
    buildCategoryLookup()

    const range = parseDateRange(sqliteDb)
    dateRange.value = range
    startDate.value = range.min
    endDate.value = range.max
    rangeCount.value = range.count

    step.value = 'range'
  } catch (err) {
    error.value = '檔案解析失敗：' + err.message
  } finally {
    loading.value = false
  }
}

async function loadPreview() {
  if (!sqliteDb) return
  loading.value = true
  try {
    rangeCount.value = getRecordCount(sqliteDb, startDate.value, endDate.value)
    preview.value = getPreviewRecords(sqliteDb, startDate.value, endDate.value, cwAccounts)

    // Count expense/income from preview + total count
    const allRecords = parseRecords(sqliteDb, startDate.value, endDate.value, cwAccounts)
    expenseCount.value = allRecords.filter(r => r.type === 'expense').length
    incomeCount.value = allRecords.filter(r => r.type === 'income').length

    // Estimate duplicates (simple date+amount match)
    await txStore.loadAll()
    let dupes = 0
    for (const r of allRecords) {
      const exists = txStore.transactions.some(t => t.date === r.date && t.amount === r.amount)
      if (exists) dupes++
    }
    duplicateCount.value = dupes

    step.value = 'preview'
  } catch (err) {
    error.value = '預覽載入失敗：' + err.message
  } finally {
    loading.value = false
  }
}

const defaultColors = ['#F44336', '#2196F3', '#9C27B0', '#FF9800', '#795548', '#E91E63', '#3F51B5', '#00BCD4', '#8BC34A', '#CDDC39', '#607D8B', '#FF5722']
let colorIdx = 0
const nextColor = () => defaultColors[colorIdx++ % defaultColors.length]

async function importCategories() {
  const mapping = { newCount: 0 }
  if (!cwCategories) return mapping

  await catStore.init()
  colorIdx = 0

  async function ensureParent(name, type) {
    const existing = catStore.categories.find(c => c.name === name && c.type === type && c.parentId === null)
    if (existing) return existing.id
    const id = await catStore.addCategory({ name, color: nextColor(), icon: '📁', type, parentId: null })
    mapping.newCount++
    return id
  }

  async function ensureChild(name, parentId, type) {
    const existing = catStore.categories.find(c => c.name === name && c.parentId === parentId)
    if (existing) return existing.id
    const parent = catStore.categories.find(c => c.id === parentId)
    const id = await catStore.addCategory({ name, color: parent?.color || nextColor(), icon: '📌', type, parentId })
    mapping.newCount++
    return id
  }

  for (const p of cwCategories.expenseParents) {
    mapping[`expense_parent_${p.cwId}`] = await ensureParent(p.name, 'expense')
  }
  for (const c of cwCategories.expenseChildren) {
    const parentId = mapping[`expense_parent_${c.cwParentId}`]
    if (parentId) mapping[`expense_child_${c.cwId}`] = await ensureChild(c.name, parentId, 'expense')
  }
  for (const p of cwCategories.incomeParents) {
    mapping[`income_parent_${p.cwId}`] = await ensureParent(p.name, 'income')
  }
  for (const c of cwCategories.incomeChildren) {
    const parentId = mapping[`income_parent_${c.cwParentId}`]
    if (parentId) mapping[`income_child_${c.cwId}`] = await ensureChild(c.name, parentId, 'income')
  }

  return mapping
}

async function doImport() {
  step.value = 'importing'
  const records = parseRecords(sqliteDb, startDate.value, endDate.value, cwAccounts)
  importProgress.value = { current: 0, total: records.length }

  const catMapping = await importCategories()
  importResult.value.categoriesAdded = catMapping.newCount

  await txStore.loadAll()
  let added = 0
  let skipped = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const prefix = r.type === 'income' ? 'income' : 'expense'
    const parentCatId = catMapping[`${prefix}_parent_${r.cwKind}`] || null
    const subCatId = catMapping[`${prefix}_child_${r.cwKinds}`] || null

    if (txStore.isDuplicate({ amount: r.amount, category: parentCatId, subcategory: subCatId, date: r.date })) {
      skipped++
    } else {
      await txStore.addTransaction({
        amount: r.amount, type: r.type, category: parentCatId, subcategory: subCatId,
        channel: null, cardId: null, date: r.date, note: r.note, account: r.account
      })
      added++
    }

    importProgress.value.current = i + 1
  }

  importResult.value.added = added
  importResult.value.skipped = skipped
  step.value = 'done'
}

function reset() {
  step.value = 'select'
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null }
  cwCategories = null
  cwAccounts = null
  cwCategoryLookup = {}
  error.value = ''
  preview.value = { first10: [], last10: [] }
  importResult.value = { added: 0, skipped: 0, categoriesAdded: 0 }
}
</script>

<style scoped>
.import-cwmoney { margin-top: 8px; }
.select-btn { padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.error { color: #F44336; margin-top: 8px; font-size: 13px; }
.range-info { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
.range-inputs { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.range-inputs input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.range-count { font-size: 13px; color: #666; margin-bottom: 12px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.back-btn { padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }
.next-btn { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; }
.next-btn:disabled { background: #ccc; }
.loading { text-align: center; color: #999; padding: 16px; }
.section-label { font-size: 13px; color: #666; margin: 12px 0 4px; font-weight: bold; }
.section-label.omit { text-align: center; color: #999; font-weight: normal; margin: 16px 0; }
.preview-table { font-size: 13px; }
.preview-row { display: flex; gap: 6px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; align-items: center; }
.pr-date { width: 85px; flex-shrink: 0; }
.pr-type { width: 24px; flex-shrink: 0; font-size: 12px; text-align: center; }
.pr-type.expense { color: #F44336; }
.pr-type.income { color: #4CAF50; }
.pr-cat { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-amount { width: 70px; text-align: right; flex-shrink: 0; }
.pr-account { width: 70px; flex-shrink: 0; font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-stats { background: #E8F5E9; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 13px; }
.progress-bar { height: 8px; background: #eee; border-radius: 4px; margin-top: 12px; }
.progress-fill { height: 100%; background: #4CAF50; border-radius: 4px; transition: width 0.3s; }
.done-msg { background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
.done-msg p { margin: 4px 0; }
</style>
