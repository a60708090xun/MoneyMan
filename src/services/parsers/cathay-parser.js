import { BaseParser } from './base-parser.js'

export class CathayParser extends BaseParser {
  bankName = '國泰世華'

  detect(text) {
    return /國泰世華/.test(text)
  }

  parse(text) {
    const results = []
    const lines = text.split('\n')

    // Detect statement year from header (e.g. "115年02月" or "2026年02月" or "2026/02")
    let statementYear = new Date().getFullYear()
    const yearMatch = text.match(/(\d{3,4})\s*年\s*(\d{1,2})\s*月/)
    if (yearMatch) {
      const y = parseInt(yearMatch[1])
      statementYear = y < 1000 ? y + 1911 : y // ROC year conversion
    }

    // Cathay format: MM/DD or MM/DD MM/DD followed by merchant and amount
    // Common patterns:
    //   記帳日   交易日   交易說明                  金額
    //   02/03   02/03   全聯福利中心             385
    //   02/05   02/04   MOMO購物網             1,200
    const txPattern = /(\d{1,2})\/(\d{1,2})\s+\d{1,2}\/\d{1,2}\s+(.+?)\s+([\d,]+)\s*$/
    // Simpler single-date pattern
    const txPatternSimple = /(\d{1,2})\/(\d{1,2})\s+(.+?)\s+([\d,]+)\s*$/

    for (const line of lines) {
      let match = txPattern.exec(line.trim()) || txPatternSimple.exec(line.trim())
      if (!match) continue

      const month = match[1].padStart(2, '0')
      const day = match[2].padStart(2, '0')
      const merchant = match[3].trim()
      const amount = parseInt(match[4].replace(/,/g, ''))

      if (isNaN(amount) || amount <= 0) continue
      // Skip header-like lines
      if (/記帳日|交易日|交易說明|金額/.test(merchant)) continue

      results.push({
        date: `${statementYear}-${month}-${day}`,
        merchant,
        amount,
        currency: 'TWD',
        cardLast4: ''
      })
    }

    // Try to extract card last 4 digits
    const cardMatch = text.match(/卡號[^\d]*(\d{4})\s*$|末四碼[^\d]*(\d{4})/m)
    if (cardMatch) {
      const last4 = cardMatch[1] || cardMatch[2]
      results.forEach(r => r.cardLast4 = last4)
    }

    return results
  }
}
