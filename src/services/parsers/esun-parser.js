import { BaseParser } from './base-parser.js'

export class EsunParser extends BaseParser {
  bankName = '玉山銀行'

  detect(text) {
    return /玉山銀行|E\.SUN/.test(text)
  }

  parse(text) {
    const results = []
    const lines = text.split('\n')

    // Detect statement year
    let statementYear = new Date().getFullYear()
    const yearMatch = text.match(/(\d{3,4})\s*年\s*(\d{1,2})\s*月/)
    if (yearMatch) {
      const y = parseInt(yearMatch[1])
      statementYear = y < 1000 ? y + 1911 : y
    }

    // E.SUN format variations:
    //   交易日期    說明              新臺幣金額
    //   02/03      全聯福利中心        385
    //   2026/02/03 全聯福利中心        385
    const txPatternFull = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(.+?)\s+([\d,]+)\s*$/
    const txPatternShort = /(\d{1,2})\/(\d{1,2})\s+(.+?)\s+([\d,]+)\s*$/

    for (const line of lines) {
      const trimmed = line.trim()

      let match = txPatternFull.exec(trimmed)
      if (match) {
        const year = parseInt(match[1])
        const month = match[2].padStart(2, '0')
        const day = match[3].padStart(2, '0')
        const merchant = match[4].trim()
        const amount = parseInt(match[5].replace(/,/g, ''))

        if (isNaN(amount) || amount <= 0) continue
        if (/交易日|說明|金額/.test(merchant)) continue

        results.push({
          date: `${year}-${month}-${day}`,
          merchant,
          amount,
          currency: 'TWD',
          cardLast4: ''
        })
        continue
      }

      match = txPatternShort.exec(trimmed)
      if (match) {
        const month = match[1].padStart(2, '0')
        const day = match[2].padStart(2, '0')
        const merchant = match[3].trim()
        const amount = parseInt(match[4].replace(/,/g, ''))

        if (isNaN(amount) || amount <= 0) continue
        if (/交易日|說明|金額/.test(merchant)) continue

        results.push({
          date: `${statementYear}-${month}-${day}`,
          merchant,
          amount,
          currency: 'TWD',
          cardLast4: ''
        })
      }
    }

    // Extract card last 4 digits
    const cardMatch = text.match(/卡號[^\d]*(\d{4})\s*$|末四碼[^\d]*(\d{4})/m)
    if (cardMatch) {
      const last4 = cardMatch[1] || cardMatch[2]
      results.forEach(r => r.cardLast4 = last4)
    }

    return results
  }
}
