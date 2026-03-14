import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'
import { useCategoriesStore } from './categories.js'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref([])

  async function loadAll() {
    transactions.value = await getRecords('transactions')
  }

  async function addTransaction(tx) {
    const id = await addRecord('transactions', tx)
    transactions.value.push({ ...tx, id })
    return id
  }

  async function editTransaction(tx) {
    await updateRecord('transactions', tx)
    const idx = transactions.value.findIndex(t => t.id === tx.id)
    if (idx !== -1) transactions.value[idx] = tx
  }

  async function deleteTransaction(id) {
    await deleteRecord('transactions', id)
    transactions.value = transactions.value.filter(t => t.id !== id)
  }

  function getMonthTransactions(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return transactions.value.filter(t => t.date && t.date.startsWith(prefix))
  }

  function getMonthlySummary(year, month) {
    const txs = getMonthTransactions(year, month)
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expense, balance: income - expense }
  }

  function getCategoryBreakdown(year, month) {
    const catStore = useCategoriesStore()
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const breakdown = {}
    for (const t of txs) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      breakdown[name] = (breakdown[name] || 0) + t.amount
    }
    return breakdown
  }

  function getTransactionsByDateRange(startDate, endDate) {
    return transactions.value.filter(t => t.date && t.date >= startDate && t.date <= endDate)
  }

  function getDailyTotals(year, month) {
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const daily = {}
    for (const t of txs) {
      const day = parseInt(t.date.substring(8, 10))
      daily[day] = (daily[day] || 0) + t.amount
    }
    return daily
  }

  function getYearTransactions(year) {
    const prefix = `${year}-`
    return transactions.value.filter(t => t.date && t.date.startsWith(prefix))
  }

  function getYearlySummary(year) {
    const yearTxs = getYearTransactions(year)
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const monthTxs = yearTxs.filter(t => t.date.startsWith(prefix))
      const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { month, income, expense, balance: income - expense }
    })
  }

  function getYearlyCategoryBreakdown(year, topN = 5) {
    const catStore = useCategoriesStore()
    const yearTxs = getYearTransactions(year).filter(t => t.type === 'expense')
    const catTotals = {}
    for (const t of yearTxs) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      catTotals[name] = (catTotals[name] || 0) + t.amount
    }
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
    const topCategories = sorted.slice(0, topN).map(([name]) => name)

    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const monthTxs = yearTxs.filter(t => t.date.startsWith(prefix))
      const data = {}
      let otherTotal = 0
      for (const t of monthTxs) {
        const name = catStore.getCategoryName(t.category) || '未分類'
        if (topCategories.includes(name)) {
          data[name] = (data[name] || 0) + t.amount
        } else {
          otherTotal += t.amount
        }
      }
      if (otherTotal > 0) data['其他'] = otherTotal
      return { month, data }
    })
    return { categories: [...topCategories, ...(months.some(m => m.data['其他']) ? ['其他'] : [])], months }
  }

  function getMonthComparison(yearA, monthA, yearB, monthB) {
    const catStore = useCategoriesStore()
    const txsA = getMonthTransactions(yearA, monthA).filter(t => t.type === 'expense')
    const txsB = getMonthTransactions(yearB, monthB).filter(t => t.type === 'expense')

    const allCategories = new Set()
    const sumA = {}, sumB = {}
    for (const t of txsA) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      allCategories.add(name)
      sumA[name] = (sumA[name] || 0) + t.amount
    }
    for (const t of txsB) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      allCategories.add(name)
      sumB[name] = (sumB[name] || 0) + t.amount
    }

    const categories = {}
    let totalA = 0, totalB = 0
    for (const name of allCategories) {
      const a = sumA[name] || 0
      const b = sumB[name] || 0
      categories[name] = {
        monthA: a, monthB: b,
        diff: b - a,
        pct: a === 0 ? (b > 0 ? 100 : 0) : Math.round((b - a) / a * 1000) / 10
      }
      totalA += a
      totalB += b
    }
    return { categories, totalA, totalB, diff: totalB - totalA, pct: totalA === 0 ? (totalB > 0 ? 100 : 0) : Math.round((totalB - totalA) / totalA * 1000) / 10 }
  }

  function getHeatmapByWeekdayHour(startDate, endDate) {
    const txs = transactions.value.filter(t =>
      t.type === 'expense' && t.date && t.date >= startDate && t.date <= endDate + '\uffff' && t.date.includes('T')
    )
    const map = {}
    for (const t of txs) {
      const dt = new Date(t.date)
      const weekday = (dt.getDay() + 6) % 7 // Mon=0, Sun=6
      const hour = dt.getHours()
      const key = `${weekday}-${hour}`
      if (!map[key]) map[key] = { weekday, hour, total: 0, count: 0 }
      map[key].total += t.amount
      map[key].count++
    }
    return Object.values(map)
  }

  function getHeatmapByDay(startDate, endDate) {
    const txs = transactions.value.filter(t =>
      t.type === 'expense' && t.date && t.date >= startDate && t.date <= endDate + '\uffff'
    )
    const map = {}
    for (const t of txs) {
      const day = t.date.substring(0, 10)
      if (!map[day]) map[day] = { total: 0, count: 0 }
      map[day].total += t.amount
      map[day].count++
    }
    return map
  }

  function getHeatmapByCategoryMonth(year, topN = 8) {
    const catStore = useCategoriesStore()
    const yearTxs = getYearTransactions(year).filter(t => t.type === 'expense')
    const catTotals = {}
    for (const t of yearTxs) {
      const name = catStore.getCategoryName(t.category) || '未分類'
      catTotals[name] = (catTotals[name] || 0) + t.amount
    }
    const topCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name]) => name)

    const result = []
    for (const category of topCategories) {
      for (let month = 1; month <= 12; month++) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`
        const total = yearTxs
          .filter(t => t.date.startsWith(prefix) && (catStore.getCategoryName(t.category) || '未分類') === category)
          .reduce((s, t) => s + t.amount, 0)
        result.push({ category, month, total })
      }
    }
    return result
  }

  function isDuplicate({ amount, category, subcategory, date }) {
    return transactions.value.some(t =>
      t.date === date &&
      t.amount === amount &&
      t.category === category &&
      (t.subcategory ?? null) === (subcategory ?? null)
    )
  }

  return {
    transactions, loadAll, addTransaction, editTransaction, deleteTransaction,
    getMonthTransactions, getTransactionsByDateRange, getMonthlySummary, getCategoryBreakdown, getDailyTotals,
    isDuplicate,
    getYearlySummary, getYearlyCategoryBreakdown, getMonthComparison,
    getHeatmapByWeekdayHour, getHeatmapByDay, getHeatmapByCategoryMonth
  }
})
