import { describe, it, expect } from 'vitest'
import { detectBank, parseStatement } from '../../services/parsers/index.js'

describe('parser registry', () => {
  it('returns manual parser for unknown bank', () => {
    const result = detectBank('Some random text content')
    expect(result).toBe('manual')
  })

  it('manual parser returns raw lines', () => {
    const result = parseStatement('line one\nline two\n\nline three')
    expect(result.raw).toBe(true)
    expect(result.lines).toHaveLength(3)
  })

  it('detects 國泰世華', () => {
    expect(detectBank('國泰世華銀行信用卡帳單')).toBe('國泰世華')
  })

  it('detects 玉山銀行', () => {
    expect(detectBank('玉山銀行 E.SUN BANK 帳單')).toBe('玉山銀行')
  })
})

describe('cathay parser', () => {
  it('parses dual-date format transactions', () => {
    const text = `國泰世華銀行信用卡對帳單
115年02月
卡號末四碼 1234
記帳日 交易日 交易說明 金額
02/03 02/03 全聯福利中心 385
02/05 02/04 MOMO購物網 1,200`

    const results = parseStatement(text)
    expect(results).toHaveLength(2)
    expect(results[0].date).toBe('2026-02-03')
    expect(results[0].merchant).toBe('全聯福利中心')
    expect(results[0].amount).toBe(385)
    expect(results[0].cardLast4).toBe('1234')
    expect(results[1].amount).toBe(1200)
  })
})

describe('esun parser', () => {
  it('parses short-date format transactions', () => {
    const text = `玉山銀行 信用卡帳單
115年03月
02/10 星巴克咖啡 180
02/15 台灣大哥大 499`

    const results = parseStatement(text)
    expect(results).toHaveLength(2)
    expect(results[0].date).toBe('2026-02-10')
    expect(results[0].merchant).toBe('星巴克咖啡')
    expect(results[0].amount).toBe(180)
    expect(results[1].amount).toBe(499)
  })
})
