import { describe, expect, it } from 'vitest'
import { buttonLabel, initialInterest, interestReducer, parseSentPlans, PLAN_CARDS } from './pricing'

describe('pricing(FS-73)', () => {
  it('요금제 카드는 무료·프로·팀·임베드 순이고 주 대상은 프로 하나다', () => {
    expect(PLAN_CARDS.map((c) => c.plan)).toEqual(['FREE', 'PRO', 'TEAM', 'EMBED'])
    expect(PLAN_CARDS.filter((c) => c.primary).map((c) => c.plan)).toEqual(['PRO'])
  })

  it('이미 남긴 요금제는 기록됨으로 시작하고 다시 보내지 않는다', () => {
    const state = initialInterest(['PRO'])
    expect(state).toEqual({ FREE: 'idle', PRO: 'sent', TEAM: 'idle', EMBED: 'idle' })
    expect(interestReducer(state, { type: 'send', plan: 'PRO' })).toBe(state)
  })

  it('보내면 남기는 중 → 기록함, 실패하면 다시 시도로 바뀐다', () => {
    let state = initialInterest([])
    state = interestReducer(state, { type: 'send', plan: 'TEAM' })
    expect(state.TEAM).toBe('sending')
    expect(interestReducer(state, { type: 'sent', plan: 'TEAM' }).TEAM).toBe('sent')
    expect(interestReducer(state, { type: 'fail', plan: 'TEAM' }).TEAM).toBe('error')
    expect(buttonLabel('error')).toBe('다시 시도')
  })

  it('브라우저에 남긴 값이 깨졌거나 모르는 요금제면 버린다', () => {
    expect(parseSentPlans('["PRO","GOLD"]')).toEqual(['PRO'])
    expect(parseSentPlans('{')).toEqual([])
    expect(parseSentPlans('"PRO"')).toEqual([])
    expect(parseSentPlans(null)).toEqual([])
  })
})
