import { describe, it, expect, beforeEach } from 'vitest'
import { initDB, addRecord, getRecords, updateRecord, deleteRecord } from '../../services/db.js'

describe('db service', () => {
  beforeEach(async () => {
    const db = await initDB()
    const tx = db.transaction('transactions', 'readwrite')
    await tx.objectStore('transactions').clear()
    await tx.done
  })

  it('adds and retrieves a transaction', async () => {
    const record = {
      amount: 100,
      type: 'expense',
      category: '飲食',
      channel: '超商',
      cardId: null,
      date: '2026-02-19',
      note: '午餐'
    }
    const id = await addRecord('transactions', record)
    expect(id).toBeDefined()

    const records = await getRecords('transactions')
    expect(records).toHaveLength(1)
    expect(records[0].amount).toBe(100)
    expect(records[0].category).toBe('飲食')
  })

  it('updates a transaction', async () => {
    const id = await addRecord('transactions', { amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    await updateRecord('transactions', { id, amount: 200, type: 'expense', category: '飲食', date: '2026-02-19' })

    const records = await getRecords('transactions')
    expect(records[0].amount).toBe(200)
  })

  it('deletes a transaction', async () => {
    const id = await addRecord('transactions', { amount: 100, type: 'expense', category: '飲食', date: '2026-02-19' })
    await deleteRecord('transactions', id)

    const records = await getRecords('transactions')
    expect(records).toHaveLength(0)
  })
})
