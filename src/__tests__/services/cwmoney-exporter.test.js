import { describe, it, expect } from 'vitest'
import { buildExportDB, buildFreshExportDB, computeChangeSummary } from '../../services/cwmoney-exporter.js'

// Helper: create a minimal CWMoney SQLite database using sql.js
async function createMockCWMoneyDB() {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`CREATE TABLE rec_table (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER,
    i_account INTEGER, i_remark TEXT, i_type TEXT
  )`)
  db.run(`CREATE TABLE kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
  db.run(`CREATE TABLE acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`)

  // Insert sample data
  db.run(`INSERT INTO kind_table VALUES (1, '食物飲品', 'k1', 0)`)
  db.run(`INSERT INTO kinds_table VALUES (1, 1, '早餐', 'k1', 0), (2, 1, '午餐', 'k1', 1)`)
  db.run(`INSERT INTO acc_table VALUES (1, '現金', 'm1', 0)`)

  // 1706745600 = 2024-02-01 UTC
  db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type)
          VALUES (100, 1706745600, 1, 1, 1, '早餐便利商店', '1')`)
  db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type)
          VALUES (150, 1706745600, 1, 2, 1, '午餐便當', '1')`)

  return { db, bytes: db.export() }
}

describe('cwmoney-exporter', () => {
  describe('computeChangeSummary', () => {
    it('counts updated, inserted, and deleted records', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      // MoneyMan transactions: cwId=1 updated, cwId=2 deleted (missing), cwId=null is new
      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: '改過的早餐', category: 10, subcategory: 20, account: '現金' },
        { id: 3, cwId: null, amount: 50, type: 'expense', date: '2024-02-02', note: '新紀錄', category: 10, subcategory: 20, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const summary = await computeChangeSummary(originalIdb, transactions, categoryMapping, accountMapping)
      expect(summary.updated).toBe(1)
      expect(summary.inserted).toBe(1)
      expect(summary.deleted).toBe(1)
    })
  })

  describe('buildExportDB', () => {
    it('updates existing records in the .iDB', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: '改過的早餐', category: 10, subcategory: 20, account: '現金' },
        { id: 2, cwId: 2, amount: 150, type: 'expense', date: '2024-02-01', note: '午餐便當', category: 10, subcategory: 21, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      // Verify by reading the result
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT _id, i_money, i_remark FROM rec_table ORDER BY _id')
      expect(rows[0].values).toHaveLength(2)
      expect(rows[0].values[0][1]).toBe(200)       // updated amount
      expect(rows[0].values[0][2]).toBe('改過的早餐') // updated note
      resultDb.close()
    })

    it('deletes records not present in MoneyMan', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      // Only cwId=1 remains, cwId=2 was deleted in MoneyMan
      const transactions = [
        { id: 1, cwId: 1, amount: 100, type: 'expense', date: '2024-02-01', note: '早餐便利商店', category: 10, subcategory: 20, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT COUNT(*) FROM rec_table')
      expect(rows[0].values[0][0]).toBe(1)
      resultDb.close()
    })

    it('inserts new records (no cwId)', async () => {
      const { bytes } = await createMockCWMoneyDB()
      const originalIdb = new Uint8Array(bytes)

      const transactions = [
        { id: 1, cwId: 1, amount: 100, type: 'expense', date: '2024-02-01', note: '早餐便利商店', category: 10, subcategory: 20, account: '現金' },
        { id: 2, cwId: 2, amount: 150, type: 'expense', date: '2024-02-01', note: '午餐便當', category: 10, subcategory: 21, account: '現金' },
        { id: 3, cwId: null, amount: 50, type: 'income', date: '2024-02-02', note: '新收入', category: 30, subcategory: null, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10, 'expense_child_1': 20, 'expense_child_2': 21 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const resultDb = new SQL.Database(resultBytes)

      const rows = resultDb.exec('SELECT COUNT(*) FROM rec_table')
      expect(rows[0].values[0][0]).toBe(3)

      const newRow = resultDb.exec("SELECT i_money, i_remark, i_type FROM rec_table WHERE i_remark = '新收入'")
      expect(newRow[0].values[0][0]).toBe(50)
      expect(newRow[0].values[0][2]).toBe('2')  // income
      resultDb.close()
    })

    it('preserves unknown tables and columns', async () => {
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const db = new SQL.Database()

      // Create standard tables + an unknown table
      db.run(`CREATE TABLE rec_table (_id INTEGER PRIMARY KEY AUTOINCREMENT, i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER, i_account INTEGER, i_remark TEXT, i_type TEXT, i_photo TEXT)`)
      db.run(`CREATE TABLE kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`)
      db.run(`CREATE TABLE acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`)
      db.run(`CREATE TABLE budget_table (_id INTEGER PRIMARY KEY, amount REAL)`)

      db.run(`INSERT INTO kind_table VALUES (1, '食物', 'k1', 0)`)
      db.run(`INSERT INTO acc_table VALUES (1, '現金', 'm1', 0)`)
      db.run(`INSERT INTO budget_table VALUES (1, 5000)`)
      db.run(`INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type, i_photo) VALUES (100, 1706745600, 1, 0, 1, 'test', '1', 'photo.jpg')`)

      const originalIdb = new Uint8Array(db.export())
      db.close()

      const transactions = [
        { id: 1, cwId: 1, amount: 200, type: 'expense', date: '2024-02-01', note: 'updated', category: 10, subcategory: null, account: '現金' }
      ]

      const categoryMapping = { 'expense_parent_1': 10 }
      const accountMapping = { 1: '現金' }

      const resultBytes = await buildExportDB(originalIdb, transactions, categoryMapping, accountMapping)

      const resultDb = new SQL.Database(resultBytes)

      // budget_table should still exist
      const budget = resultDb.exec('SELECT * FROM budget_table')
      expect(budget[0].values[0][1]).toBe(5000)

      // i_photo column should be preserved
      const rec = resultDb.exec('SELECT i_photo FROM rec_table WHERE _id = 1')
      expect(rec[0].values[0][0]).toBe('photo.jpg')

      resultDb.close()
    })
  })

  describe('buildFreshExportDB', () => {
    it('creates a valid CWMoney .iDB from MoneyMan data', async () => {
      const categories = [
        { id: 1, name: '飲食', type: 'expense', parentId: null, icon: '🍔', color: '#F44336' },
        { id: 2, name: '早餐', type: 'expense', parentId: 1, icon: '🥐', color: '#F44336' },
        { id: 3, name: '薪水', type: 'income', parentId: null, icon: '💰', color: '#4CAF50' }
      ]

      const transactions = [
        { id: 1, amount: 80, type: 'expense', date: '2024-02-01', note: '早餐', category: 1, subcategory: 2, account: '現金' },
        { id: 2, amount: 45000, type: 'income', date: '2024-02-05', note: '月薪', category: 3, subcategory: null, account: '銀行' }
      ]

      const resultBytes = await buildFreshExportDB(transactions, categories)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const db = new SQL.Database(resultBytes)

      // Check rec_table
      const recs = db.exec('SELECT COUNT(*) FROM rec_table')
      expect(recs[0].values[0][0]).toBe(2)

      // Check expense category tables
      const kinds = db.exec('SELECT kindtext FROM kind_table')
      expect(kinds[0].values[0][0]).toBe('飲食')

      const kindsChildren = db.exec('SELECT kindstext FROM kinds_table')
      expect(kindsChildren[0].values[0][0]).toBe('早餐')

      // Check income category tables
      const inKinds = db.exec('SELECT kindtext FROM in_kind_table')
      expect(inKinds[0].values[0][0]).toBe('薪水')

      // Check accounts
      const accs = db.exec('SELECT acctext FROM acc_table ORDER BY accsort')
      expect(accs[0].values.map(r => r[0])).toContain('現金')
      expect(accs[0].values.map(r => r[0])).toContain('銀行')

      db.close()
    })

    it('only exports categories referenced by transactions', async () => {
      const categories = [
        { id: 1, name: '飲食', type: 'expense', parentId: null, icon: '🍔', color: '#F44336' },
        { id: 2, name: '早餐', type: 'expense', parentId: 1, icon: '🥐', color: '#F44336' },
        { id: 3, name: '交通', type: 'expense', parentId: null, icon: '🚗', color: '#2196F3' },
        { id: 4, name: '薪水', type: 'income', parentId: null, icon: '💰', color: '#4CAF50' }
      ]

      // Only references category 1 (飲食) and subcategory 2 (早餐), NOT 交通 or 薪水
      const transactions = [
        { id: 1, amount: 80, type: 'expense', date: '2024-02-01', note: '早餐', category: 1, subcategory: 2, account: '現金' }
      ]

      const resultBytes = await buildFreshExportDB(transactions, categories)

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const db = new SQL.Database(resultBytes)

      // Only 飲食 should be in kind_table (not 交通)
      const kinds = db.exec('SELECT COUNT(*) FROM kind_table')
      expect(kinds[0].values[0][0]).toBe(1)

      // No income categories should be exported
      const inKinds = db.exec('SELECT COUNT(*) FROM in_kind_table')
      expect(inKinds[0].values[0][0]).toBe(0)

      db.close()
    })

    it('handles empty transactions', async () => {
      const resultBytes = await buildFreshExportDB([], [])

      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      const db = new SQL.Database(resultBytes)

      const recs = db.exec('SELECT COUNT(*) FROM rec_table')
      expect(recs[0].values[0][0]).toBe(0)
      db.close()
    })
  })

  describe('integrity check', () => {
    it('computeChangeSummary throws on corrupted .iDB', async () => {
      // Use garbage bytes — sql.js cannot open this as a database
      const corrupted = new Uint8Array([0, 1, 2, 3])
      await expect(computeChangeSummary(corrupted, [], {}, {})).rejects.toThrow()
    })

    it('buildExportDB throws on corrupted .iDB', async () => {
      const corrupted = new Uint8Array([0, 1, 2, 3])
      await expect(buildExportDB(corrupted, [], {}, {})).rejects.toThrow()
    })
  })
})
