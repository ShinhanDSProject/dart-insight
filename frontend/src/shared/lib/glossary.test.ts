import { describe, expect, it } from 'vitest'
import { glossary } from './glossary'

describe('glossary', () => {
  it('모든 용어에 이름과 뜻 풀이가 비어 있지 않다', () => {
    const entries = Object.values(glossary)
    expect(entries).toHaveLength(9)
    for (const entry of entries) {
      expect(entry.term.trim()).not.toBe('')
      expect(entry.definition.trim()).not.toBe('')
    }
  })
})
