import { describe, expect, it } from 'vitest'
import { INTRO_HANDOFF_MAX_AGE_MS, parseIntroHandoff } from './introHandoff'

describe('발표 시연 전환에서 넘어온 첫 화면 판단', () => {
  it('막 넘어온 값이면 바탕 흐름 위치를 돌려준다', () => {
    expect(parseIntroHandoff(JSON.stringify({ at: 1000, driftMs: 5234.5 }), 1500)).toEqual({ driftMs: 5234.5 })
  })

  it('흐름 위치가 없거나 이상하면 0으로 본다', () => {
    expect(parseIntroHandoff(JSON.stringify({ at: 1000 }), 1500)).toEqual({ driftMs: 0 })
    expect(parseIntroHandoff(JSON.stringify({ at: 1000, driftMs: -3 }), 1500)).toEqual({ driftMs: 0 })
    expect(parseIntroHandoff(JSON.stringify({ at: 1000, driftMs: 'x' }), 1500)).toEqual({ driftMs: 0 })
  })

  it('값이 없거나 깨졌으면 null을 돌려준다', () => {
    expect(parseIntroHandoff(null, 1500)).toBeNull()
    expect(parseIntroHandoff('', 1500)).toBeNull()
    expect(parseIntroHandoff('{', 1500)).toBeNull()
    expect(parseIntroHandoff('null', 1500)).toBeNull()
    expect(parseIntroHandoff(JSON.stringify({ driftMs: 10 }), 1500)).toBeNull()
  })

  it('오래됐거나 미래 시각이면 이어 받지 않는다', () => {
    expect(parseIntroHandoff(JSON.stringify({ at: 1000 }), 1000 + INTRO_HANDOFF_MAX_AGE_MS + 1)).toBeNull()
    expect(parseIntroHandoff(JSON.stringify({ at: 2000 }), 1500)).toBeNull()
  })
})
