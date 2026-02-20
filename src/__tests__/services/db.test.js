import { describe, it, expect, beforeEach } from 'vitest'
import { initDB, addRecord, getRecords, updateRecord, deleteRecord, resetDB, migrateData } from '../../services/db.js'

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

describe('db v2 schema', () => {
  beforeEach(async () => {
    resetDB()
  })

  it('has v2 indexes on transactions store', async () => {
    const db = await initDB()
    const txStore = db.transaction('transactions', 'readonly').objectStore('transactions')
    expect(txStore.indexNames.contains('date')).toBe(true)
    expect(txStore.indexNames.contains('category')).toBe(true)
    expect(txStore.indexNames.contains('cardId')).toBe(true)
    expect(txStore.indexNames.contains('subcategory')).toBe(true)
  })

  it('has v2 indexes on categories store', async () => {
    const db = await initDB()
    const catStore = db.transaction('categories', 'readonly').objectStore('categories')
    expect(catStore.indexNames.contains('parentId')).toBe(true)
    expect(catStore.indexNames.contains('type')).toBe(true)
  })
})

describe('migrateData', () => {
  beforeEach(async () => {
    resetDB()
    const db = await initDB()
    // Clear all stores before each migration test
    const tx = db.transaction(['transactions', 'categories'], 'readwrite')
    await tx.objectStore('transactions').clear()
    await tx.objectStore('categories').clear()
    await tx.done
  })

  it('adds type and parentId to categories missing them', async () => {
    const db = await initDB()

    // Insert old-format categories (no type, no parentId)
    const tx = db.transaction('categories', 'readwrite')
    await tx.objectStore('categories').put({ id: 1, name: '飲食' })
    await tx.objectStore('categories').put({ id: 2, name: '交通' })
    await tx.done

    await migrateData()

    const categories = await getRecords('categories')
    expect(categories).toHaveLength(2)
    for (const cat of categories) {
      expect(cat.type).toBe('expense')
      expect(cat.parentId).toBeNull()
    }
  })

  it('does not overwrite existing type and parentId on categories', async () => {
    const db = await initDB()

    // Insert already-migrated categories
    const tx = db.transaction('categories', 'readwrite')
    await tx.objectStore('categories').put({ id: 1, name: '薪水', type: 'income', parentId: null })
    await tx.objectStore('categories').put({ id: 2, name: '早餐', type: 'expense', parentId: 3 })
    await tx.done

    await migrateData()

    const categories = await getRecords('categories')
    const salary = categories.find(c => c.name === '薪水')
    const breakfast = categories.find(c => c.name === '早餐')
    expect(salary.type).toBe('income')
    expect(salary.parentId).toBeNull()
    expect(breakfast.type).toBe('expense')
    expect(breakfast.parentId).toBe(3)
  })

  it('converts string category to id in transactions', async () => {
    const db = await initDB()

    // Insert parent categories
    const catTx = db.transaction('categories', 'readwrite')
    await catTx.objectStore('categories').put({ id: 1, name: '飲食', type: 'expense', parentId: null })
    await catTx.objectStore('categories').put({ id: 2, name: '交通', type: 'expense', parentId: null })
    await catTx.done

    // Insert old-format transactions (category is a string)
    const txTx = db.transaction('transactions', 'readwrite')
    await txTx.objectStore('transactions').put({
      id: 1, amount: 100, type: 'expense', category: '飲食',
      date: '2026-02-19', note: '午餐'
    })
    await txTx.objectStore('transactions').put({
      id: 2, amount: 50, type: 'expense', category: '交通',
      date: '2026-02-19', note: '公車'
    })
    await txTx.done

    await migrateData()

    const records = await getRecords('transactions')
    const lunch = records.find(r => r.note === '午餐')
    const bus = records.find(r => r.note === '公車')
    expect(lunch.category).toBe(1)
    expect(lunch.subcategory).toBeNull()
    expect(lunch.account).toBeNull()
    expect(bus.category).toBe(2)
    expect(bus.subcategory).toBeNull()
    expect(bus.account).toBeNull()
  })

  it('does not modify transactions that already have numeric category', async () => {
    const db = await initDB()

    // Insert a transaction already migrated (category is a number)
    const txTx = db.transaction('transactions', 'readwrite')
    await txTx.objectStore('transactions').put({
      id: 1, amount: 100, type: 'expense', category: 1,
      subcategory: 5, account: 'cash',
      date: '2026-02-19', note: '午餐'
    })
    await txTx.done

    await migrateData()

    const records = await getRecords('transactions')
    expect(records[0].category).toBe(1)
    expect(records[0].subcategory).toBe(5)
    expect(records[0].account).toBe('cash')
  })
})
