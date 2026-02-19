<template>
  <div class="settings-view">
    <h2>設定</h2>

    <section>
      <h3>分類管理</h3>
      <div v-for="cat in categoriesStore.categories" :key="cat.id" class="cat-item">
        <span>{{ cat.icon }} {{ cat.name }}</span>
        <button @click="deleteCat(cat.id)" class="delete-btn">刪除</button>
      </div>
      <div class="add-cat">
        <input v-model="newCatName" placeholder="新分類名稱" />
        <button @click="addCat">新增</button>
      </div>
    </section>

    <section>
      <h3>Google Drive 同步</h3>
      <div v-if="!gdriveConfigured" class="gdrive-setup">
        <p class="hint">請輸入 Google Cloud Console 的 OAuth Client ID 以啟用同步功能。</p>
        <div class="add-cat">
          <input v-model="gdriveClientId" placeholder="Google OAuth Client ID" />
          <button @click="saveClientId">儲存</button>
        </div>
      </div>
      <div v-else>
        <p class="hint">手動上傳/下載資料，單一裝置修改後再同步。</p>
        <div class="sync-buttons">
          <button @click="upload" :disabled="syncing" class="upload-btn">📤 上傳備份</button>
          <button @click="download" :disabled="syncing" class="download-btn">📥 下載還原</button>
        </div>
        <button @click="resetClientId" class="link-btn" style="margin-top: 8px; font-size: 12px;">重設 Client ID</button>
      </div>
      <div v-if="syncMsg" class="sync-msg">{{ syncMsg }}</div>
    </section>

    <section>
      <h3>對帳</h3>
      <router-link to="/reconcile" class="link-btn">前往帳單對帳</router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCategoriesStore } from '../stores/categories.js'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCardsStore } from '../stores/cards.js'
import { initGoogleAuth, requestAuth, uploadBackup, downloadBackup, isConfigured, setClientId, getClientId } from '../services/gdrive.js'
import { getRecords, clearStore, updateRecord } from '../services/db.js'

const categoriesStore = useCategoriesStore()
const txStore = useTransactionsStore()
const cardsStore = useCardsStore()

const newCatName = ref('')
const syncing = ref(false)
const syncMsg = ref('')
const gdriveConfigured = ref(isConfigured())
const gdriveClientId = ref(getClientId())

onMounted(async () => {
  await categoriesStore.init()
  if (gdriveConfigured.value) {
    await initGoogleAuth()
  }
})

async function addCat() {
  if (!newCatName.value.trim()) return
  await categoriesStore.addCategory({ name: newCatName.value.trim(), color: '#607D8B', icon: '📌' })
  newCatName.value = ''
}

async function deleteCat(id) {
  if (confirm('確定刪除？')) await categoriesStore.deleteCategory(id)
}

async function saveClientId() {
  if (!gdriveClientId.value.trim()) return
  setClientId(gdriveClientId.value.trim())
  gdriveConfigured.value = true
  await initGoogleAuth()
}

function resetClientId() {
  setClientId('')
  gdriveConfigured.value = false
  gdriveClientId.value = ''
}

async function upload() {
  syncing.value = true
  syncMsg.value = ''
  try {
    await requestAuth()
    const data = {
      transactions: await getRecords('transactions'),
      cards: await getRecords('cards'),
      categories: await getRecords('categories'),
      exportedAt: new Date().toISOString()
    }
    await uploadBackup(data)
    syncMsg.value = '上傳成功！'
  } catch (e) {
    syncMsg.value = '上傳失敗：' + e.message
  } finally {
    syncing.value = false
  }
}

async function download() {
  syncing.value = true
  syncMsg.value = ''
  try {
    await requestAuth()
    const data = await downloadBackup()
    if (!data) { syncMsg.value = '沒有找到備份檔案'; return }
    if (!confirm('下載將覆蓋本地所有資料，確定繼續？')) return

    await clearStore('transactions')
    await clearStore('cards')
    await clearStore('categories')

    for (const tx of data.transactions || []) await updateRecord('transactions', tx)
    for (const card of data.cards || []) await updateRecord('cards', card)
    for (const cat of data.categories || []) await updateRecord('categories', cat)

    await txStore.loadAll()
    await cardsStore.init()
    await categoriesStore.init()

    syncMsg.value = `還原成功！（備份時間：${data.exportedAt}）`
  } catch (e) {
    syncMsg.value = '下載失敗：' + e.message
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.settings-view { max-width: 480px; margin: 0 auto; }
section { margin-bottom: 24px; }
.cat-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.delete-btn { background: none; border: none; color: #F44336; cursor: pointer; }
.add-cat { display: flex; gap: 8px; margin-top: 8px; }
.add-cat input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.add-cat button { padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
.hint { font-size: 13px; color: #999; margin-bottom: 8px; }
.sync-buttons { display: flex; gap: 8px; }
.upload-btn, .download-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.upload-btn { background: #2196F3; color: white; }
.download-btn { background: #FF9800; color: white; }
.sync-msg { margin-top: 8px; padding: 8px; background: #E8F5E9; border-radius: 4px; font-size: 13px; }
.link-btn { display: block; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px; text-decoration: none; color: #333; }
</style>
