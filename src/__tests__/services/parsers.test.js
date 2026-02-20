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
})
