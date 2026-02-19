import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

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
    const txs = getMonthTransactions(year, month).filter(t => t.type === 'expense')
    const breakdown = {}
    for (const t of txs) {
      breakdown[t.category] = (breakdown[t.category] || 0) + t.amount
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
      const day = parseInt(t.date.split('-')[2])
      daily[day] = (daily[day] || 0) + t.amount
    }
    return daily
  }

  return {
    transactions, loadAll, addTransaction, editTransaction, deleteTransaction,
    getMonthTransactions, getTransactionsByDateRange, getMonthlySummary, getCategoryBreakdown, getDailyTotals
  }
})
