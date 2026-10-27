import { describe, expect, it } from 'vitest'
import { amountPeriodLabel, formatAmount, formatChange, formatRate, isProfitState, parseUnit, shortCalcLabel } from './format'

describe('result format', () => {
  it('단위로 나눠 반올림하고 천 단위로 끊는다', () => {
    expect(formatAmount(152_000_000_000_000, 'MILLION')).toBe('152,000,000')
    expect(formatAmount(1_500_000, 'MILLION')).toBe('2')
    expect(formatAmount(1_234_567, 'WON')).toBe('1,234,567')
    expect(formatAmount(-260_000_000, 'HUNDRED_MILLION')).toBe('−3')
    expect(formatAmount(-1, 'MILLION')).toBe('0')
  })

  it('없는 값을 0으로 바꾸지 않는다', () => {
    expect(formatAmount(null, 'MILLION')).toBeNull()
    expect(formatChange(null, 'MILLION')).toBeNull()
    expect(formatRate(null)).toBeNull()
  })

  it('양수와 음수를 같은 방식으로 반올림한다', () => {
    expect(formatAmount(1_500_000, 'MILLION')).toBe('2')
    expect(formatAmount(-1_500_000, 'MILLION')).toBe('−2')
    expect(formatRate(0.04851)).toBe('+4.9%')
    expect(formatRate(-0.04851)).toBe('−4.9%')
  })

  it('단위보다 작은 변화는 0으로 보이지 않는다', () => {
    expect(formatChange(400_000, 'MILLION')).toBe('▲ 1 미만')
    expect(formatChange(-400_000, 'MILLION')).toBe('▼ 1 미만')
  })

  it('원화가 아니면 통화 코드를 단위에 붙인다', async () => {
    const { unitLabel } = await import('./format')
    expect(unitLabel('MILLION', 'KRW')).toBe('백만원')
    expect(unitLabel('MILLION', 'USD')).toBe('백만 USD')
    expect(unitLabel('WON', 'USD')).toBe('USD')
    expect(unitLabel('THOUSAND', null)).toBe('천원')
  })

  it('증감은 기호와 부호로 보여 준다', () => {
    expect(formatChange(7_000_000, 'MILLION')).toBe('▲ 7')
    expect(formatChange(-7_000_000, 'MILLION')).toBe('▼ 7')
    expect(formatChange(0, 'MILLION')).toBe('0')
    expect(formatRate(0.048276)).toBe('+4.8%')
    expect(formatRate(-0.2)).toBe('−20.0%')
    expect(formatRate(0)).toBe('0.0%')
  })

  it('이익 계정의 부호 변화는 증감률 대신 흑자·적자 상태로, 그 밖의 계정은 중립 사유로 보인다', () => {
    expect(shortCalcLabel('TURNED_PROFIT')).toBe('흑자전환')
    expect(shortCalcLabel('TURNED_LOSS')).toBe('적자전환')
    expect(shortCalcLabel('LOSS_NARROWED')).toBe('적자폭 축소')
    expect(shortCalcLabel('LOSS_WIDENED')).toBe('적자폭 확대')
    expect(shortCalcLabel('SIGN_CHANGED')).toBe('계산 불가 · 부호가 바뀜')
    expect(shortCalcLabel('SIGN_CHANGED')).not.toMatch(/흑자|적자/)
    expect(shortCalcLabel('OK')).toBeNull()
    expect(['TURNED_PROFIT', 'TURNED_LOSS', 'LOSS_NARROWED', 'LOSS_WIDENED'].every(isProfitState)).toBe(true)
    expect(isProfitState('SIGN_CHANGED')).toBe(false)
    expect(isProfitState('PREVIOUS_NEGATIVE')).toBe(false)
  })

  it('금액 기준별 기간', () => {
    const report = { fiscalYear: 2026, periodEnd: '2026-06-30' }
    expect(amountPeriodLabel(report, 'POINT')).toBe('2026.06.30')
    expect(amountPeriodLabel(report, 'CUMULATIVE')).toBe('2026.01.01 ~ 2026.06.30')
    expect(amountPeriodLabel(report, 'QUARTER')).toBe('2026.04.01 ~ 2026.06.30')
    expect(amountPeriodLabel({ fiscalYear: 2025, periodEnd: '2025-09-30' }, 'QUARTER')).toBe('2025.07.01 ~ 2025.09.30')
  })

  it('단위 기본값은 백만원', () => {
    expect(parseUnit(null)).toBe('MILLION')
    expect(parseUnit('WON')).toBe('WON')
    expect(parseUnit('X')).toBe('MILLION')
  })
})

describe('계산 불가 표시', () => {
  it('사유를 짧게 보여 주고 없는 값은 0이 아니라 말로 쓴다', async () => {
    const { missingValueLabel, shortCalcLabel } = await import('./format')
    expect(shortCalcLabel('OK')).toBeNull()
    expect(shortCalcLabel('PREVIOUS_ZERO')).toBe('계산 불가 · 이전 값 0')
    expect(missingValueLabel('ONLY_CURRENT', 'previous')).toBe('없음')
    expect(missingValueLabel('PREVIOUS_MISSING', 'previous')).toBe('미기재')
    expect(missingValueLabel('PERIOD_MISMATCH', 'current')).toBe('—')
  })
})
