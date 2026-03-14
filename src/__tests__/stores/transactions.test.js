import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions.js'
import { useCategoriesStore } from '../../stores/categories.js'
import { clearStore } from '../../services/db.js'

describe('transactions store', () => {
  let catStore

  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('transactions')
    await clearStore('categories')
    catStore = useCategoriesStore()
    await catStore.init()
  })

  it('adds a transaction with subcategory and account', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({
      amount: 150, type: 'expense', category: catId, subcategory: null,
      channel: '超商', cardId: null, date: '2026-02-19', note: '午餐', account: '現金'
    })
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0].category).toBe(catId)
    expect(store.transactions[0].account).toBe('現金')
  })

  it('computes monthly totals', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 1000, type: 'income', category: catId, date: '2026-02-01' })
    await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-10' })
    const summary = store.getMonthlySummary(2026, 2)
    expect(summary.income).toBe(1000)
    expect(summary.expense).toBe(500)
    expect(summary.balance).toBe(500)
  })

  it('computes category breakdown with names', async () => {
    const store = useTransactionsStore()
    const cat1 = catStore.categories[0].id // 飲食
    const cat2 = catStore.categories[1].id // 交通
    await store.addTransaction({ amount: 300, type: 'expense', category: cat1, date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: cat1, date: '2026-02-06' })
    await store.addTransaction({ amount: 100, type: 'expense', category: cat2, date: '2026-02-07' })
    const breakdown = store.getCategoryBreakdown(2026, 2)
    expect(breakdown['飲食']).toBe(500)
    expect(breakdown['交通']).toBe(100)
  })

  it('checks duplicates correctly', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, subcategory: null, date: '2026-02-19' })
    expect(store.isDuplicate({ amount: 100, category: catId, subcategory: null, date: '2026-02-19' })).toBe(true)
    expect(store.isDuplicate({ amount: 200, category: catId, subcategory: null, date: '2026-02-19' })).toBe(false)
  })

  it('deletes a transaction', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-02-19' })
    const id = store.transactions[0].id
    await store.deleteTransaction(id)
    expect(store.transactions).toHaveLength(0)
  })

  it('handles datetime-local format in date field', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({
      amount: 100, type: 'expense', category: catId,
      date: '2026-03-14T14:30', note: 'test'
    })
    // getMonthTransactions uses startsWith prefix, should still work
    const txs = store.getMonthTransactions(2026, 3)
    expect(txs).toHaveLength(1)
    expect(txs[0].date).toBe('2026-03-14T14:30')
  })

  it('getMonthlySummary works with mixed date formats', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-01' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-02T10:00' })
    const summary = store.getMonthlySummary(2026, 3)
    expect(summary.expense).toBe(300)
  })

  it('getDailyTotals handles datetime-local format', async () => {
    const store = useTransactionsStore()
    const catId = catStore.categories[0].id
    await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-14T14:30' })
    await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-14' })
    const daily = store.getDailyTotals(2026, 3)
    expect(daily[14]).toBe(300)
  })

  describe('yearly and cross-month getters', () => {
    let store, catId, catId2

    beforeEach(async () => {
      store = useTransactionsStore()
      catId = catStore.categories[0].id  // 飲食
      catId2 = catStore.categories[1].id // 交通
    })

    it('getYearlySummary returns 12 months of income/expense/balance', async () => {
      await store.addTransaction({ amount: 1000, type: 'income', category: catId, date: '2026-01-15' })
      await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-20' })
      await store.addTransaction({ amount: 500, type: 'expense', category: catId, date: '2026-03-10' })
      const result = store.getYearlySummary(2026)
      expect(result).toHaveLength(12)
      expect(result[0]).toEqual({ month: 1, income: 1000, expense: 300, balance: 700 })
      expect(result[1]).toEqual({ month: 2, income: 0, expense: 0, balance: 0 })
      expect(result[2]).toEqual({ month: 3, income: 0, expense: 500, balance: -500 })
    })

    it('getYearlyCategoryBreakdown returns top N categories per month', async () => {
      await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
      await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
      await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-05' })
      const result = store.getYearlyCategoryBreakdown(2026, 5)
      expect(result.categories).toContain('飲食')
      expect(result.months[0].data['飲食']).toBe(300)
      expect(result.months[0].data['交通']).toBe(100)
    })

    it('getMonthComparison returns category diffs between two months', async () => {
      await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
      await store.addTransaction({ amount: 500, type: 'expense', category: catId, date: '2026-02-05' })
      await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
      const result = store.getMonthComparison(2026, 1, 2026, 2)
      expect(result.categories['飲食'].monthA).toBe(300)
      expect(result.categories['飲食'].monthB).toBe(500)
      expect(result.categories['飲食'].diff).toBe(200)
      expect(result.totalA).toBe(400)
      expect(result.totalB).toBe(500)
    })

    it('getMonthComparison returns null pct when monthA is zero', async () => {
      await store.addTransaction({ amount: 500, type: 'expense', category: catId, date: '2026-02-05' })
      const result = store.getMonthComparison(2026, 1, 2026, 2)
      expect(result.categories['飲食'].monthA).toBe(0)
      expect(result.categories['飲食'].monthB).toBe(500)
      expect(result.categories['飲食'].pct).toBeNull()
      expect(result.pct).toBeNull()
    })

    it('getHeatmapByWeekdayHour aggregates by weekday and hour', async () => {
      await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-09T14:30' }) // Monday
      await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-09T14:45' }) // Monday
      await store.addTransaction({ amount: 50, type: 'expense', category: catId, date: '2026-03-10T09:00' })  // Tuesday
      const result = store.getHeatmapByWeekdayHour('2026-02-14', '2026-03-14')
      const mondayAt14 = result.find(r => r.weekday === 0 && r.hour === 14)
      expect(mondayAt14.total).toBe(300)
      expect(mondayAt14.count).toBe(2)
    })

    it('getHeatmapByDay returns daily totals for a date range', async () => {
      await store.addTransaction({ amount: 100, type: 'expense', category: catId, date: '2026-03-01' })
      await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-03-01T15:00' })
      await store.addTransaction({ amount: 50, type: 'expense', category: catId, date: '2026-03-05' })
      const result = store.getHeatmapByDay('2026-03-01', '2026-03-31')
      expect(result['2026-03-01'].total).toBe(300)
      expect(result['2026-03-05'].count).toBe(1)
    })

    it('getHeatmapByCategoryMonth returns category x month matrix', async () => {
      await store.addTransaction({ amount: 300, type: 'expense', category: catId, date: '2026-01-05' })
      await store.addTransaction({ amount: 100, type: 'expense', category: catId2, date: '2026-01-10' })
      await store.addTransaction({ amount: 200, type: 'expense', category: catId, date: '2026-02-05' })
      const result = store.getHeatmapByCategoryMonth(2026, 8)
      const food_jan = result.find(r => r.category === '飲食' && r.month === 1)
      expect(food_jan.total).toBe(300)
    })
  })
})
