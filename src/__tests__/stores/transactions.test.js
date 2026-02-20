import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions.js'
import { clearStore } from '../../services/db.js'

describe('transactions store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('transactions')
  })

  it('adds a transaction', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({
      amount: 150,
      type: 'expense',
      category: '飲食',
      channel: '超商',
      cardId: null,
      date: '2026-02-19',
      note: '午餐'
    })
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0].amount).toBe(150)
  })

  it('computes monthly totals', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 1000, type: 'income', category: '薪資', date: '2026-02-01' })
    await store.addTransaction({ amount: 300, type: 'expense', category: '飲食', date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: '交通', date: '2026-02-10' })

    const summary = store.getMonthlySummary(2026, 2)
    expect(summary.income).toBe(1000)
    expect(summary.expense).toBe(500)
    expect(summary.balance).toBe(500)
  })

  it('computes category breakdown for a month', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 300, type: 'expense', category: '飲食', date: '2026-02-05' })
    await store.addTransaction({ amount: 200, type: 'expense', category: '飲食', date: '2026-02-06' })
    await store.addTransaction({ amount: 100, type: 'expense', category: '交通', date: '2026-02-07' })

    const breakdown = store.getCategoryBreakdown(2026, 2)
    expect(breakdown['飲食']).toBe(500)
    expect(breakdown['交通']).toBe(100)
  })

  it('deletes a transaction', async () => {
    const store = useTransactionsStore()
    await store.addTransaction({ amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    const id = store.transactions[0].id
    await store.deleteTransaction(id)
    expect(store.transactions).toHaveLength(0)
  })
})
