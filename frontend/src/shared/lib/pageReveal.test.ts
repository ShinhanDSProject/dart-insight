import { describe, expect, it } from 'vitest'
import { nextRevealPhase, shouldSkipReveal } from './pageReveal'

describe('nextRevealPhase', () => {
  it('기다리는 칸이 남아 있고 시간이 남았으면 계속 가린다', () => {
    expect(nextRevealPhase('waiting', { pending: 2, timedOut: false })).toBe('waiting')
  })

  it('기다리는 칸이 모두 응답하면 차례로 떠오르기 시작한다', () => {
    expect(nextRevealPhase('waiting', { pending: 0, timedOut: false })).toBe('entering')
  })

  it('기다리는 칸이 남아도 최대 대기 시간이 지나면 떠오르기 시작한다', () => {
    expect(nextRevealPhase('waiting', { pending: 1, timedOut: true })).toBe('entering')
  })

  it('한 번 보인 화면은 다시 불러오는 칸이 생겨도 가리지 않는다', () => {
    expect(nextRevealPhase('entering', { pending: 3, timedOut: false })).toBe('entering')
    expect(nextRevealPhase('shown', { pending: 3, timedOut: false })).toBe('shown')
  })
})

describe('shouldSkipReveal', () => {
  it('동작 줄이기를 켰으면 기다리지 않는다', () => {
    expect(shouldSkipReveal({ reducedMotion: true })).toBe(true)
  })

  it('그 밖에는 주요 데이터를 기다린다', () => {
    expect(shouldSkipReveal({ reducedMotion: false })).toBe(false)
  })
})
