import { describe, expect, it } from 'vitest'
import { formatInteger } from './numberFormat'

describe('formatInteger', () => {
  it('세 자리마다 쉼표를 넣는다', () => {
    expect(formatInteger(1234567)).toBe('1,234,567')
  })

  it('작은 수와 0은 그대로 보인다', () => {
    expect(formatInteger(0)).toBe('0')
    expect(formatInteger(999)).toBe('999')
  })
})
