import { ManualParser } from './manual-parser.js'
import { CathayParser } from './cathay-parser.js'
import { EsunParser } from './esun-parser.js'

const parsers = []
const manualParser = new ManualParser()

// Register built-in parsers
registerParser(new CathayParser())
registerParser(new EsunParser())

export function registerParser(parser) {
  parsers.push(parser)
}

export function detectBank(text) {
  for (const parser of parsers) {
    if (parser.detect(text)) return parser.bankName || 'unknown'
  }
  return 'manual'
}

export function parseStatement(text) {
  for (const parser of parsers) {
    if (parser.detect(text)) return parser.parse(text)
  }
  return manualParser.parse(text)
}
