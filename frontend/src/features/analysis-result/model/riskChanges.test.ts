import { describe, expect, it } from 'vitest'
import type { TextChangeCounts } from '@/shared/api/textChanges'
import { hasRiskChanges, otherRiskLabel, riskCardView, RISK_BADGE, RISK_EMPTY, RISK_NOTE, RISK_SCOPE, RISK_TITLE, riskStats } from './riskChanges'

const zero: TextChangeCounts = { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }

describe('위험 요인 변화', () => {
  it('새로 생긴·사라진·바뀐 건수를 응답 그대로 쓴다', () => {
    const counts = { ...zero, all: 9, added: 2, deleted: 1, modified: 3, numericUpdate: 2, moved: 1 }
    expect(riskStats(counts).map((s) => [s.label, s.value])).toEqual([
      ['새로 생긴 문장', 2],
      ['사라진 문장', 1],
      ['바뀐 문장', 3],
    ])
    expect(hasRiskChanges(counts)).toBe(true)
    expect(otherRiskLabel(counts)).toBe('그 밖에 숫자만 바뀜·위치 이동·검토 필요 3건이 있어요.')
  })

  it('건수를 모르면 불러오는 중, 위험 관련 변경이 없으면 빈 안내로 본다(AC3)', () => {
    expect(riskCardView(null)).toEqual({ kind: 'loading' })
    expect(riskCardView(zero)).toEqual({ kind: 'empty' })
    expect(riskCardView({ ...zero, all: 1, moved: 1 }).kind).toBe('counts')
    expect(hasRiskChanges(zero)).toBe(false)
    expect(otherRiskLabel(zero)).toBeNull()
  })

  it('문구에 위험의 크기나 좋고 나쁨을 말하는 표현이 없다(AC5)', () => {
    const texts = [RISK_TITLE, RISK_BADGE, RISK_EMPTY, RISK_NOTE, RISK_SCOPE, ...riskStats(zero).map((s) => s.label)].join(' ')
    for (const word of ['높', '낮', '크게', '심각', '좋', '나쁨', '나쁜', '우수', '악화', '개선', '저평가', '위험도']) {
      expect(texts).not.toContain(word)
    }
  })
})
