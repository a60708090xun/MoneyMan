<template>
  <div class="manual-mapping">
    <h3>手動欄位對應</h3>
    <p class="hint">無法自動辨識銀行格式，請手動指定各欄位。</p>

    <div class="preview-scroll">
      <table class="preview-table">
        <thead>
          <tr>
            <th v-for="(_, ci) in columnCount" :key="ci">
              <select v-model="columnRoles[ci]">
                <option value="skip">略過</option>
                <option value="date">日期</option>
                <option value="merchant">商家</option>
                <option value="amount">金額</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in previewRows" :key="ri" :class="{ dimmed: isHeaderRow(ri) }">
            <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mapping-actions">
      <label>
        <input type="checkbox" v-model="skipFirstRow" /> 第一行是標題（略過）
      </label>
    </div>

    <div class="btn-row">
      <button class="confirm-btn" @click="applyMapping" :disabled="!canApply">確認匯入</button>
      <button class="cancel-btn" @click="$emit('cancel')">取消</button>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({ lines: Array })
const emit = defineEmits(['mapped', 'cancel'])

const skipFirstRow = ref(true)
const error = ref('')

// Split lines into columns by 2+ spaces or tabs
const splitRows = computed(() =>
  props.lines.map(line => line.split(/\s{2,}|\t/).filter(s => s.trim()))
)

const columnCount = computed(() =>
  Math.max(...splitRows.value.map(r => r.length), 1)
)

const previewRows = computed(() =>
  splitRows.value.slice(0, 10).map(row => {
    // Pad to columnCount (create new array to avoid mutating splitRows)
    const padded = [...row]
    while (padded.length < columnCount.value) padded.push('')
    return padded
  })
)

const columnRoles = ref([])

watch(columnCount, () => initRoles())

const initRoles = () => {
  const count = columnCount.value
  columnRoles.value = Array(count).fill('skip')

  // Auto-detect: first column with date-like pattern = date, last numeric = amount
  const sample = splitRows.value.find((_, i) => skipFirstRow.value ? i > 0 : true) || splitRows.value[0]
  if (sample) {
    for (let i = 0; i < sample.length; i++) {
      if (/\d{1,4}[\/\-]\d{1,2}([\/\-]\d{1,2})?/.test(sample[i]) && !columnRoles.value.includes('date')) {
        columnRoles.value[i] = 'date'
      } else if (/^[\d,]+$/.test(sample[i].replace(/,/g, '')) && !columnRoles.value.includes('amount')) {
        columnRoles.value[i] = 'amount'
      }
    }
    // If we found date & amount, assign the longest remaining text column as merchant
    if (columnRoles.value.includes('date') && columnRoles.value.includes('amount')) {
      let maxLen = 0, merchantIdx = -1
      for (let i = 0; i < sample.length; i++) {
        if (columnRoles.value[i] === 'skip' && sample[i].length > maxLen) {
          maxLen = sample[i].length
          merchantIdx = i
        }
      }
      if (merchantIdx >= 0) columnRoles.value[merchantIdx] = 'merchant'
    }
  }
}
initRoles()

function isHeaderRow(ri) {
  return skipFirstRow.value && ri === 0
}

const canApply = computed(() =>
  columnRoles.value.includes('date') && columnRoles.value.includes('amount')
)

function applyMapping() {
  error.value = ''
  const dateIdx = columnRoles.value.indexOf('date')
  const amountIdx = columnRoles.value.indexOf('amount')
  const merchantIdx = columnRoles.value.indexOf('merchant')

  const results = []
  const startIdx = skipFirstRow.value ? 1 : 0

  const currentYear = new Date().getFullYear()

  for (let i = startIdx; i < splitRows.value.length; i++) {
    const row = splitRows.value[i]
    if (row.length <= Math.max(dateIdx, amountIdx)) continue

    const rawDate = row[dateIdx]?.trim()
    const rawAmount = row[amountIdx]?.trim()
    const merchant = merchantIdx >= 0 ? row[merchantIdx]?.trim() : ''

    if (!rawDate || !rawAmount) continue

    // Parse amount
    const amount = parseInt(rawAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    // Parse date: try MM/DD, YYYY/MM/DD, YYYY-MM-DD
    let date = ''
    const fullMatch = rawDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    const shortMatch = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})/)
    if (fullMatch) {
      date = `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`
    } else if (shortMatch) {
      date = `${currentYear}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`
    } else {
      continue
    }

    results.push({ date, merchant, amount, currency: 'TWD', cardLast4: '' })
  }

  if (results.length === 0) {
    error.value = '無法從所選欄位中解析出任何交易，請檢查欄位對應。'
    return
  }

  emit('mapped', results)
}
</script>

<style scoped>
.manual-mapping { margin-top: 16px; }
.hint { font-size: 13px; color: #999; margin-bottom: 12px; }
.preview-scroll { overflow-x: auto; margin-bottom: 12px; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.preview-table th, .preview-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
.preview-table th { background: #f5f5f5; }
.preview-table select { width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }
.dimmed { opacity: 0.4; }
.mapping-actions { margin-bottom: 12px; font-size: 14px; }
.btn-row { display: flex; gap: 8px; }
.confirm-btn { flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; }
.confirm-btn:disabled { background: #ccc; }
.cancel-btn { flex: 1; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }
.error-msg { margin-top: 8px; padding: 8px; background: #FFEBEE; color: #C62828; border-radius: 4px; font-size: 13px; }
</style>
