import { describe, expect, it } from 'vitest'
import { RISK_BADGE, RISK_EMPTY, RISK_FILTERED_SCOPE, RISK_NOTE, RISK_SCOPE } from './riskChanges'

describe('위험 관련 문구', () => {
  it('문구에 위험의 크기나 좋고 나쁨을 말하는 표현이 없다(AC5)', () => {
    const texts = [RISK_BADGE, RISK_EMPTY, RISK_NOTE, RISK_SCOPE, RISK_FILTERED_SCOPE].join(' ')
    for (const word of ['높', '낮', '크게', '심각', '좋', '나쁨', '나쁜', '우수', '악화', '개선', '저평가', '위험도']) {
      expect(texts).not.toContain(word)
    }
  })
})
