import { describe, expect, it } from 'vitest'
import { formatDuration, formatInteger, formatRate, formatUsd } from './numberFormat'

describe('formatInteger', () => {
  it('세 자리마다 쉼표를 넣는다', () => {
    expect(formatInteger(1234567)).toBe('1,234,567')
  })

  it('작은 수와 0은 그대로 보인다', () => {
    expect(formatInteger(0)).toBe('0')
    expect(formatInteger(999)).toBe('999')
  })
})

describe('관리자 콘솔 숫자 표시(FS-72)', () => {
  it('소요 시간을 초·분·시간으로 읽기 쉽게 쓰고 모르면 —이다', () => {
    expect(formatDuration(48)).toBe('48초')
    expect(formatDuration(131)).toBe('2분 11초')
    expect(formatDuration(120)).toBe('2분')
    expect(formatDuration(3780)).toBe('1시간 3분')
    expect(formatDuration(null)).toBe('—')
  })

  it('비율과 비용은 분모가 0이라 null이면 0이 아니라 —로 쓴다', () => {
    expect(formatRate(0.925)).toBe('92.5%')
    expect(formatRate(0)).toBe('0.0%')
    expect(formatRate(null)).toBe('—')
    expect(formatUsd(1.8312)).toBe('$1.83')
    expect(formatUsd(0.004)).toBe('<$0.01')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(null)).toBe('—')
  })

})
