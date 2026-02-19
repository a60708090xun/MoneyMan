import { BaseParser } from './base-parser.js'

export class ManualParser extends BaseParser {
  detect() { return true }

  parse(text) {
    // Manual parser returns raw lines for user to map
    return { raw: true, lines: text.split('\n').filter(l => l.trim()) }
  }
}
