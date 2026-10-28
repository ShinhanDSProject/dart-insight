import { describe, expect, it } from 'vitest'
import { FOLLOWUP_NOTICE, followupTone } from './planFollowup'

describe('약속과 실제 대조 표시 규칙', () => {
  it('상태 배지는 중립색이고 계획 변경 언급만 눈에 띄는 색이다', () => {
    expect(followupTone('MENTIONED')).toBe('neutral')
    expect(followupTone('NOT_FOUND')).toBe('neutral')
    expect(followupTone('CHANGED')).toBe('attention')
  })

  it('안내 문구는 찾지 못함이 이행하지 않았다는 뜻이 아니라고 알린다', () => {
    expect(FOLLOWUP_NOTICE).toBe('찾지 못함은 이행하지 않았다는 뜻이 아니에요. 회사 공시 문장을 나란히 놓은 것이며 평가하지 않아요.')
  })
})
