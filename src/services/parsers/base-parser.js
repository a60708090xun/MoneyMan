export class BaseParser {
  /** @returns {boolean} Whether this parser can handle the given PDF text */
  detect(text) { return false }

  /**
   * Parse statement text into transactions
   * @param {string} text - Raw PDF text content
   * @returns {Array<{date: string, merchant: string, amount: number, currency: string, cardLast4: string}>}
   */
  parse(text) { return [] }
}
