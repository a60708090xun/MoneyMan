<template>
  <div class="export-cwmoney">
    <!-- Loading meta -->
    <div v-if="loading" class="loading">載入中...</div>

    <!-- Mode: Edit-writeback (has original .iDB) -->
    <template v-else-if="hasOriginalIdb">
      <!-- Step 1: Summary -->
      <div v-if="step === 'summary'">
        <div class="info-box">
          <p>原始檔案：{{ importInfo.fileName }}</p>
          <p>匯入時間：{{ importInfo.importedAt?.slice(0, 10) }}</p>
          <p>原始筆數：{{ changeSummary.originalCount.toLocaleString() }} 筆</p>
        </div>
        <div class="change-summary">
          <span>修改 {{ changeSummary.updated }} 筆</span>
          <span>新增 {{ changeSummary.inserted }} 筆</span>
          <span>刪除 {{ changeSummary.deleted }} 筆</span>
        </div>
        <div class="actions">
          <button @click="doExport" class="export-btn">匯出 .iDB</button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <!-- Step 2: Exporting -->
      <div v-if="step === 'exporting'">
        <p>匯出中...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 50%"></div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-if="step === 'done'">
        <div class="done-msg">
          <p>匯出完成！</p>
          <p>更新 {{ changeSummary.updated }} 筆 / 新增 {{ changeSummary.inserted }} 筆 / 刪除 {{ changeSummary.deleted }} 筆</p>
        </div>
        <div class="actions">
          <button @click="downloadFile" class="download-btn">下載 .iDB</button>
          <button @click="uploadGDrive" class="gdrive-btn" :disabled="uploading">上傳到 Google Drive</button>
        </div>
        <div v-if="uploadMsg" class="sync-msg">{{ uploadMsg }}</div>
        <button @click="reset" class="link-btn">完成</button>
      </div>
    </template>

    <!-- Mode: Fresh export (no original .iDB) -->
    <template v-else>
      <!-- Step 1: Settings -->
      <div v-if="step === 'settings'">
        <div class="info-box">
          <p>MoneyMan 目前共 {{ totalCount.toLocaleString() }} 筆交易</p>
        </div>
        <div class="range-inputs">
          <input type="date" v-model="startDate" />
          <span>～</span>
          <input type="date" v-model="endDate" />
        </div>
        <p class="range-count">此區間共 {{ rangeCount.toLocaleString() }} 筆</p>
        <div class="actions">
          <button @click="doFreshExport" class="export-btn" :disabled="rangeCount === 0">匯出 .iDB</button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <!-- Step 2: Exporting -->
      <div v-if="step === 'exporting'">
        <p>匯出中...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 50%"></div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-if="step === 'done'">
        <div class="done-msg">
          <p>匯出完成！</p>
          <p>共匯出 {{ exportedCount }} 筆交易、{{ exportedCatCount }} 個分類</p>
        </div>
        <div class="actions">
          <button @click="downloadFile" class="download-btn">下載 .iDB</button>
          <button @click="uploadGDrive" class="gdrive-btn" :disabled="uploading">上傳到 Google Drive</button>
        </div>
        <div v-if="uploadMsg" class="sync-msg">{{ uploadMsg }}</div>
        <button @click="reset" class="link-btn">完成</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'
import { getCWMoneyMeta } from '../services/db.js'
import { buildExportDB, buildFreshExportDB, computeChangeSummary } from '../services/cwmoney-exporter.js'
import { requestAuth, uploadIDB, isConfigured } from '../services/gdrive.js'

const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const loading = ref(true)
const error = ref('')
const step = ref('')

// Edit-writeback state
const hasOriginalIdb = ref(false)
const importInfo = ref({})
const changeSummary = ref({ updated: 0, inserted: 0, deleted: 0, originalCount: 0 })

// Fresh export state
const totalCount = ref(0)
const startDate = ref('')
const endDate = ref('')
const exportedCount = ref(0)
const exportedCatCount = ref(0)

// Shared state
let exportedBytes = null
const uploading = ref(false)
const uploadMsg = ref('')

const rangeCount = computed(() => {
  if (!startDate.value || !endDate.value) return totalCount.value
  return txStore.transactions.filter(t => t.date >= startDate.value && t.date <= endDate.value).length
})

onMounted(async () => {
  await txStore.loadAll()
  await catStore.init()
  totalCount.value = txStore.transactions.length

  const originalIdb = await getCWMoneyMeta('original_idb')
  if (originalIdb) {
    hasOriginalIdb.value = true
    importInfo.value = (await getCWMoneyMeta('import_info')) || {}

    const categoryMapping = (await getCWMoneyMeta('category_mapping')) || {}
    const accountMapping = (await getCWMoneyMeta('account_mapping')) || {}

    changeSummary.value = await computeChangeSummary(
      originalIdb, txStore.transactions, categoryMapping, accountMapping
    )
    step.value = 'summary'
  } else {
    hasOriginalIdb.value = false
    // Set date range from transactions
    if (txStore.transactions.length) {
      const dates = txStore.transactions.map(t => t.date).sort()
      startDate.value = dates[0]
      endDate.value = dates[dates.length - 1]
    }
    step.value = 'settings'
  }

  loading.value = false
})

async function doExport() {
  step.value = 'exporting'
  error.value = ''
  try {
    const originalIdb = await getCWMoneyMeta('original_idb')
    const categoryMapping = (await getCWMoneyMeta('category_mapping')) || {}
    const accountMapping = (await getCWMoneyMeta('account_mapping')) || {}

    exportedBytes = await buildExportDB(originalIdb, txStore.transactions, categoryMapping, accountMapping)
    step.value = 'done'
  } catch (e) {
    error.value = '匯出失敗：' + e.message
    step.value = 'summary'
  }
}

async function doFreshExport() {
  step.value = 'exporting'
  error.value = ''
  try {
    const filtered = txStore.transactions.filter(t => t.date >= startDate.value && t.date <= endDate.value)
    exportedBytes = await buildFreshExportDB(filtered, catStore.categories)
    exportedCount.value = filtered.length
    exportedCatCount.value = catStore.categories.length
    step.value = 'done'
  } catch (e) {
    error.value = '匯出失敗：' + e.message
    step.value = 'settings'
  }
}

function downloadFile() {
  if (!exportedBytes) return
  const blob = new Blob([exportedBytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = hasOriginalIdb.value
    ? (importInfo.value.fileName || 'moneyman-export.iDB')
    : 'moneyman-export.iDB'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function uploadGDrive() {
  if (!exportedBytes) return
  uploading.value = true
  uploadMsg.value = ''
  try {
    if (!isConfigured()) {
      uploadMsg.value = '請先在 Google Drive 同步區塊設定 Client ID'
      return
    }
    await requestAuth()
    await uploadIDB(exportedBytes)
    uploadMsg.value = '上傳成功！'
  } catch (e) {
    uploadMsg.value = '上傳失敗：' + e.message
  } finally {
    uploading.value = false
  }
}

function reset() {
  step.value = hasOriginalIdb.value ? 'summary' : 'settings'
  exportedBytes = null
  uploadMsg.value = ''
}
</script>

<style scoped>
.export-cwmoney { margin-top: 8px; }
.info-box { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
.info-box p { margin: 4px 0; }
.change-summary { display: flex; gap: 12px; margin-bottom: 12px; font-size: 13px; color: #666; }
.range-inputs { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.range-inputs input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.range-count { font-size: 13px; color: #666; margin-bottom: 12px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.export-btn { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; }
.export-btn:disabled { background: #ccc; }
.download-btn { padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; }
.gdrive-btn { padding: 10px 20px; background: #FF9800; color: white; border: none; border-radius: 8px; cursor: pointer; }
.gdrive-btn:disabled { background: #ccc; }
.error { color: #F44336; margin-top: 8px; font-size: 13px; }
.loading { text-align: center; color: #999; padding: 16px; }
.progress-bar { height: 8px; background: #eee; border-radius: 4px; margin-top: 12px; }
.progress-fill { height: 100%; background: #4CAF50; border-radius: 4px; transition: width 0.3s; }
.done-msg { background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
.done-msg p { margin: 4px 0; }
.sync-msg { margin-top: 8px; padding: 8px; background: #E8F5E9; border-radius: 4px; font-size: 13px; }
.link-btn { display: block; text-align: center; padding: 8px; background: none; border: none; color: #999; cursor: pointer; margin-top: 8px; font-size: 13px; }
</style>
