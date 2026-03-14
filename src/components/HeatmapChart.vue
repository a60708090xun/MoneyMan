<template>
  <div>
    <div class="year-nav">
      <button @click="$emit('update:year', year - 1)">&lt;</button>
      <span>{{ year }} 年</span>
      <button @click="$emit('update:year', year + 1)">&gt;</button>
    </div>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'weekdayHour' }" @click="mode = 'weekdayHour'">星期x時段</button>
      <button :class="{ active: mode === 'calendar' }" @click="mode = 'calendar'">日曆格</button>
      <button :class="{ active: mode === 'categoryMonth' }" @click="mode = 'categoryMonth'">分類x月份</button>
    </div>

    <!-- Weekday x Hour heatmap -->
    <div v-if="mode === 'weekdayHour'">
      <div class="range-toggle">
        <button v-for="r in ranges" :key="r.label" :class="{ active: range === r.value }" @click="range = r.value">
          {{ r.label }}
        </button>
      </div>
      <div class="heatmap-grid weekday-hour">
        <div class="heatmap-row header">
          <span class="label"></span>
          <span v-for="h in 24" :key="h" class="cell header-cell">{{ h - 1 }}</span>
        </div>
        <div v-for="(dayName, d) in weekdays" :key="d" class="heatmap-row">
          <span class="label">{{ dayName }}</span>
          <span
            v-for="h in 24"
            :key="h"
            class="cell"
            :style="{ backgroundColor: getWeekdayHourColor(d, h - 1) }"
            :title="getWeekdayHourTooltip(d, h - 1)"
            @click="drillDownWeekdayHour(d, h - 1)"
          ></span>
        </div>
      </div>
    </div>

    <!-- Calendar heatmap (GitHub-style) -->
    <div v-if="mode === 'calendar'">
      <div class="calendar-grid">
        <div class="calendar-months">
          <span v-for="m in 12" :key="m" class="month-label">{{ m }}月</span>
        </div>
        <div class="calendar-rows">
          <div v-for="(dayName, d) in ['一','二','三','四','五','六','日']" :key="d" class="calendar-row">
            <span class="day-label">{{ d % 2 === 0 ? dayName : '' }}</span>
            <span
              v-for="(day, i) in calendarDays.filter(dd => dd.weekday === d)"
              :key="i"
              class="cal-cell"
              :style="{ backgroundColor: getCalendarColor(day.date) }"
              :title="getCalendarTooltip(day.date)"
              @click="drillDownDay(day.date)"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Category x Month heatmap -->
    <div v-if="mode === 'categoryMonth'">
      <div class="heatmap-grid cat-month">
        <div class="heatmap-row header">
          <span class="label cat-label"></span>
          <span v-for="m in 12" :key="m" class="cell header-cell">{{ m }}月</span>
        </div>
        <div v-for="cat in catMonthCategories" :key="cat" class="heatmap-row">
          <span class="label cat-label">{{ cat }}</span>
          <span
            v-for="m in 12"
            :key="m"
            class="cell"
            :style="{ backgroundColor: getCatMonthColor(cat, m) }"
            :title="getCatMonthTooltip(cat, m)"
            @click="drillDownCatMonth(cat, m)"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTransactionsStore } from '../stores/transactions.js'
import { useCategoriesStore } from '../stores/categories.js'

const props = defineProps({ year: Number })
const emit = defineEmits(['update:year', 'drill-down'])

const txStore = useTransactionsStore()
const categoriesStore = useCategoriesStore()
const mode = ref('weekdayHour')
const range = ref(3)

const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
const ranges = [
  { label: '1月', value: 1 },
  { label: '3月', value: 3 },
  { label: '6月', value: 6 },
  { label: '1年', value: 12 }
]

// Color interpolation helper
function heatColor(value, max) {
  if (!value || !max) return '#ebedf0'
  const intensity = Math.min(value / max, 1)
  const levels = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
  const idx = Math.min(Math.floor(intensity * (levels.length - 1)), levels.length - 1)
  return levels[idx]
}

// Weekday x Hour
const weekdayHourData = computed(() => {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getFullYear(), now.getMonth() - range.value, now.getDate())
    .toISOString().split('T')[0]
  return txStore.getHeatmapByWeekdayHour(start, end)
})

const weekdayHourMax = computed(() =>
  Math.max(...weekdayHourData.value.map(d => d.total), 1)
)

function findWeekdayHour(weekday, hour) {
  return weekdayHourData.value.find(d => d.weekday === weekday && d.hour === hour)
}

function getWeekdayHourColor(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  return heatColor(d?.total || 0, weekdayHourMax.value)
}

function getWeekdayHourTooltip(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  if (!d) return `${weekdays[weekday]} ${hour}:00 — 無消費`
  return `${weekdays[weekday]} ${hour}:00-${hour + 1}:00：$${d.total.toLocaleString()}（${d.count} 筆）`
}

function drillDownWeekdayHour(weekday, hour) {
  const d = findWeekdayHour(weekday, hour)
  if (!d || !d.count) return
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getFullYear(), now.getMonth() - range.value, now.getDate())
    .toISOString().split('T')[0]
  const txs = txStore.transactions.filter(t => {
    if (!t.date || t.type !== 'expense' || !t.date.includes('T')) return false
    if (t.date < start || t.date > end + '\uffff') return false
    const dt = new Date(t.date)
    return (dt.getDay() + 6) % 7 === weekday && dt.getHours() === hour
  })
  emit('drill-down', { title: `${weekdays[weekday]} ${hour}:00-${hour + 1}:00`, transactions: txs })
}

// Calendar
const calendarDays = computed(() => {
  const days = []
  const start = new Date(props.year, 0, 1)
  const end = new Date(props.year, 11, 31)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({
      date: d.toISOString().split('T')[0],
      weekday: (d.getDay() + 6) % 7  // Mon=0
    })
  }
  return days
})

const calendarData = computed(() => {
  const start = `${props.year}-01-01`
  const end = `${props.year}-12-31`
  return txStore.getHeatmapByDay(start, end)
})

const calendarMax = computed(() => {
  const vals = Object.values(calendarData.value).map(d => d.total)
  return Math.max(...vals, 1)
})

function getCalendarColor(date) {
  const d = calendarData.value[date]
  return heatColor(d?.total || 0, calendarMax.value)
}

function getCalendarTooltip(date) {
  const d = calendarData.value[date]
  if (!d) return `${date}：無消費`
  return `${date}：$${d.total.toLocaleString()}（${d.count} 筆）`
}

function drillDownDay(date) {
  const d = calendarData.value[date]
  if (!d) return
  const txs = txStore.transactions.filter(t =>
    t.type === 'expense' && t.date && t.date.startsWith(date)
  )
  emit('drill-down', { title: date, transactions: txs })
}

// Category x Month
const catMonthData = computed(() => txStore.getHeatmapByCategoryMonth(props.year, 8))

const catMonthCategories = computed(() => {
  const cats = new Set(catMonthData.value.map(d => d.category))
  return [...cats]
})

const catMonthMax = computed(() =>
  Math.max(...catMonthData.value.map(d => d.total), 1)
)

function findCatMonth(cat, month) {
  return catMonthData.value.find(d => d.category === cat && d.month === month)
}

function getCatMonthColor(cat, month) {
  const d = findCatMonth(cat, month)
  return heatColor(d?.total || 0, catMonthMax.value)
}

function getCatMonthTooltip(cat, month) {
  const d = findCatMonth(cat, month)
  if (!d || !d.total) return `${cat} / ${month}月：無消費`
  return `${cat} / ${month}月：$${d.total.toLocaleString()}`
}

function drillDownCatMonth(cat, month) {
  const d = findCatMonth(cat, month)
  if (!d || !d.total) return
  const txs = txStore.getMonthTransactions(props.year, month).filter(t => {
    if (t.type !== 'expense') return false
    const name = categoriesStore.getCategoryName(t.category) || '未分類'
    return name === cat
  })
  emit('drill-down', { title: `${cat} / ${props.year} 年 ${month} 月`, transactions: txs })
}
</script>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
.year-nav button { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
.mode-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.mode-toggle button {
  padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 13px;
}
.mode-toggle button.active { background: #E8F5E9; border-color: #4CAF50; color: #2E7D32; }

.range-toggle { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.range-toggle button {
  padding: 4px 10px; border: 1px solid #ddd; background: #fff;
  border-radius: 12px; cursor: pointer; font-size: 12px;
}
.range-toggle button.active { background: #E3F2FD; border-color: #2196F3; color: #1565C0; }

.heatmap-grid { overflow-x: auto; font-size: 11px; }
.heatmap-row { display: flex; align-items: center; }
.heatmap-row.header .header-cell { font-size: 10px; color: #999; text-align: center; }
.label { width: 40px; flex-shrink: 0; font-size: 11px; color: #666; text-align: right; padding-right: 4px; }
.cat-label { width: 60px; }
.cell { width: 16px; height: 16px; margin: 1px; border-radius: 2px; cursor: pointer; flex-shrink: 0; }
.cell:hover { outline: 1px solid #333; }

.calendar-grid { overflow-x: auto; }
.calendar-months { display: flex; margin-left: 24px; margin-bottom: 4px; }
.month-label { flex: 1; font-size: 11px; color: #666; }
.calendar-rows { display: flex; flex-direction: column; }
.calendar-row { display: flex; align-items: center; }
.day-label { width: 20px; font-size: 10px; color: #999; text-align: right; padding-right: 4px; flex-shrink: 0; }
.cal-cell { width: 12px; height: 12px; margin: 1px; border-radius: 2px; cursor: pointer; flex-shrink: 0; }
.cal-cell:hover { outline: 1px solid #333; }
</style>
