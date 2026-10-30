import { describe, expect, it } from 'vitest'
import type { CheckpointFact } from '@/shared/api/checkpoints'
import { checkpointCounts, checkpointTone, exactAmount, formatFactValue, reasonText, statementNotice } from './checkpoints'

const fact = (over: Partial<CheckpointFact>): CheckpointFact => ({
  label: '매출 (올해)',
  value: 1,
  unit: 'AMOUNT',
  currency: 'KRW',
  reason: null,
  evidence: null,
  ...over,
})

describe('재무 체크 포인트 표시', () => {
  it('확인해 볼 점만 주의 색이고 특이사항 없음·자료 없음은 중립색이다', () => {
    expect(checkpointTone('CHECK')).toBe('attention')
    expect(checkpointTone('OK')).toBe('neutral')
    expect(checkpointTone('NO_DATA')).toBe('neutral')
  })

  it('값이 없으면 0이 아니라 이유를 보여 준다', () => {
    expect(formatFactValue(fact({ value: null, reason: 'MISSING' }))).toBe('자료 없음')
    expect(formatFactValue(fact({ unit: 'PERCENT', value: null, reason: 'PREVIOUS_ZERO' }))).toBe('계산 안 함(작년 값 0)')
    expect(reasonText('EQUITY_NOT_POSITIVE')).toBe('계산 안 함(자본총계 0 이하)')
    expect(reasonText('NOT_CHECKED')).toBe('확인하지 못함')
  })

  it('증가율과 차이에는 부호를 붙이고 비율 수준에는 붙이지 않는다', () => {
    expect(formatFactValue(fact({ label: '매출 증가율', unit: 'PERCENT', value: 10 }))).toBe('+10.0%')
    expect(formatFactValue(fact({ label: '매출 증가율', unit: 'PERCENT', value: -4.2 }))).toBe('−4.2%')
    expect(formatFactValue(fact({ label: '증가율 차이', unit: 'PERCENT_POINT', value: 40 }))).toBe('+40.0%p')
    expect(formatFactValue(fact({ label: '부채비율 (올해)', unit: 'PERCENT', value: 240 }))).toBe('240.0%')
    expect(formatFactValue(fact({ label: '자금 조달 공시', unit: 'COUNT', value: 0 }))).toBe('0건')
    expect(formatFactValue(fact({ label: '계속기업 관련 강조사항', unit: 'PRESENCE', value: 1 }))).toBe('있음')
    expect(formatFactValue(fact({ label: '계속기업 관련 강조사항', unit: 'PRESENCE', value: 0 }))).toBe('없음')
    expect(formatFactValue(fact({ unit: 'PRESENCE', value: null, reason: 'NOT_CHECKED' }))).toBe('확인하지 못함')
  })

  it('금액은 짧게, 원 단위 그대로도 보여 준다', () => {
    expect(formatFactValue(fact({ value: 305_400_000_000_000 }))).toBe('305.4조원')
    expect(exactAmount(fact({ value: -1_234_567 }))).toBe('−1,234,567원')
    expect(exactAmount(fact({ unit: 'PERCENT', value: 3 }))).toBeNull()
  })

  it('상태별 항목 수를 센다', () => {
    const item = (status: 'CHECK' | 'OK' | 'NO_DATA') => ({ status }) as never
    expect(checkpointCounts([item('CHECK'), item('OK'), item('NO_DATA'), item('CHECK')])).toEqual({ check: 2, ok: 1, noData: 1 })
  })

  it('재무제표를 받지 못하면 안내를 보인다', () => {
    const base = { statementStatus: 'AVAILABLE' } as never
    expect(statementNotice(base)).toBeNull()
    expect(statementNotice({ statementStatus: 'FETCH_FAILED' } as never)).toContain('받지 못해')
  })
})
