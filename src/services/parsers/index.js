import { ManualParser } from './manual-parser.js'

const parsers = []
const manualParser = new ManualParser()

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
