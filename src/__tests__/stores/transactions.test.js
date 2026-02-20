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
})
