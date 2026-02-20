import { describe, it, expect } from 'vitest'
import { parseDateRange, parseRecords, parseCategories, parseAccounts, getRecordCount, getPreviewRecords } from '../../services/cwmoney-parser.js'

// Mock sql.js database that returns canned results based on SQL patterns
function mockDB(handlers) {
  return {
    exec(sql) {
      for (const [pattern, result] of Object.entries(handlers)) {
        if (sql.includes(pattern)) return result
      }
      return []
    }
  }
}

describe('cwmoney-parser', () => {
  describe('parseDateRange', () => {
    it('returns min and max dates from rec_table', () => {
      const db = mockDB({
        'MIN(i_date)': [{ values: [[1372176000, 1771459200]] }],
        'COUNT(*)': [{ values: [[23009]] }]
      })
      const range = parseDateRange(db)
      expect(range.min).toBe('2013-06-25')
      expect(range.max).toBe('2026-02-19')
      expect(range.count).toBe(23009)
    })

    it('returns nulls for empty database', () => {
      const db = mockDB({})
      const range = parseDateRange(db)
      expect(range.min).toBeNull()
      expect(range.max).toBeNull()
      expect(range.count).toBe(0)
    })
  })

  describe('parseCategories', () => {
    it('parses expense and income categories', () => {
      const db = mockDB({
        'FROM kind_table': [{ values: [[1, '食物飲品', 'k1', 0], [2, '交通', 'k3', 1]] }],
        'FROM kinds_table': [{ values: [[1, 1, '早餐', 'k1', 0], [2, 1, '午餐', 'k1', 1]] }],
        'FROM in_kind_table': [{ values: [[1, '工作收入', 'i1', 0]] }],
        'FROM in_kinds_table': [{ values: [[1, 1, '薪水收入', 'i1', 0]] }]
      })
      const cats = parseCategories(db)
      expect(cats.expenseParents).toHaveLength(2)
      expect(cats.expenseParents[0]).toEqual({ cwId: 1, name: '食物飲品', pic: 'k1', sort: 0 })
      expect(cats.expenseChildren).toHaveLength(2)
      expect(cats.expenseChildren[0]).toEqual({ cwId: 1, cwParentId: 1, name: '早餐', pic: 'k1', sort: 0 })
      expect(cats.incomeParents).toHaveLength(1)
      expect(cats.incomeChildren).toHaveLength(1)
    })
  })

  describe('parseAccounts', () => {
    it('parses account id to name mapping', () => {
      const db = mockDB({
        'FROM acc_table': [{ values: [[1, '現金', 'm1'], [13, '信用卡-中信', 'm3']] }]
      })
      const accs = parseAccounts(db)
      expect(accs[1]).toBe('現金')
      expect(accs[13]).toBe('信用卡-中信')
    })
  })

  describe('parseRecords', () => {
    // Mock rows match explicit SELECT: _id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type
    it('converts rec_table rows to MoneyMan format', () => {
      const accounts = { 1: '現金' }
      // 1706745600 = 2024-02-01 00:00:00 UTC
      const db = mockDB({
        'FROM rec_table WHERE': [{
          values: [[1, '150', 1706745600, '1', '3', '1', '便當', '1']]
        }]
      })
      const records = parseRecords(db, '2024-01-01', '2024-12-31', accounts)
      expect(records).toHaveLength(1)
      expect(records[0].amount).toBe(150)
      expect(records[0].type).toBe('expense')
      expect(records[0].date).toBe('2024-02-01')
      expect(records[0].note).toBe('便當')
      expect(records[0].account).toBe('現金')
      expect(records[0].cwKind).toBe(1)
      expect(records[0].cwKinds).toBe(3)
      expect(records[0].channel).toBeNull()
      expect(records[0].cardId).toBeNull()
    })

    it('handles income type correctly', () => {
      const db = mockDB({
        'FROM rec_table WHERE': [{
          values: [[2, '45000', 1706745600, '1', '1', '1', '薪水', '2']]
        }]
      })
      const records = parseRecords(db, '2024-01-01', '2024-12-31', { 1: '現金' })
      expect(records[0].type).toBe('income')
      expect(records[0].amount).toBe(45000)
    })
  })

  describe('getRecordCount', () => {
    it('returns count for date range', () => {
      const db = mockDB({
        'COUNT(*)': [{ values: [[1228]] }]
      })
      expect(getRecordCount(db, '2025-01-01', '2026-02-18')).toBe(1228)
    })
  })

  describe('getPreviewRecords', () => {
    it('returns first10 and last10', () => {
      // Matches explicit SELECT: _id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type
      const row = [1, '100', 1706745600, '1', '1', '1', 'test', '1']
      const db = mockDB({
        'ASC LIMIT 10': [{ values: [row, row] }],
        'DESC LIMIT 10': [{ values: [row] }]
      })
      const preview = getPreviewRecords(db, '2024-01-01', '2024-12-31', { 1: '現金' })
      expect(preview.first10).toHaveLength(2)
      expect(preview.last10).toHaveLength(1)
    })
  })
})
