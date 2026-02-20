import { describe, it, expect } from 'vitest'
import { reconcile } from '../../services/reconcile.js'

describe('reconcile service', () => {
  const billItems = [
    { date: '2026-02-03', merchant: '全聯福利中心', amount: 385 },
    { date: '2026-02-05', merchant: 'momo購物', amount: 1200 },
    { date: '2026-02-08', merchant: '台灣大哥大', amount: 499 }
  ]

  const manualRecords = [
    { id: 1, date: '2026-02-03', amount: 385, category: '購物', note: '全聯' },
    { id: 2, date: '2026-02-05', amount: 1199, category: '購物', note: 'momo' },
    { id: 3, date: '2026-02-10', amount: 180, category: '飲食', note: '星巴克' }
  ]

  it('matches exact date+amount', () => {
    const result = reconcile(billItems, manualRecords)
    const matched = result.find(r => r.billItem?.amount === 385)
    expect(matched.status).toBe('matched')
  })

  it('flags amount mismatch', () => {
    const result = reconcile(billItems, manualRecords)
    const mismatch = result.find(r => r.billItem?.amount === 1200)
    expect(mismatch.status).toBe('amount_mismatch')
    expect(mismatch.diff).toBe(1)
  })

  it('flags bill-only items', () => {
    const result = reconcile(billItems, manualRecords)
    const billOnly = result.find(r => r.billItem?.amount === 499)
    expect(billOnly.status).toBe('bill_only')
  })

  it('flags manual-only items', () => {
    const result = reconcile(billItems, manualRecords)
    const manualOnly = result.find(r => r.manualRecord?.id === 3)
    expect(manualOnly.status).toBe('manual_only')
  })

  it('computes match rate', () => {
    const result = reconcile(billItems, manualRecords)
    const matched = result.filter(r => r.status === 'matched').length
    const total = billItems.length
    expect(matched / total).toBeCloseTo(1 / 3)
  })
})
