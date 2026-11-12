import { describe, expect, it } from 'vitest'
import { landingLine, pickActiveSection } from './activeSection'

const tops = (...values: [string, number][]) => values.map(([id, top]) => ({ id, top }))

describe('바로 가기 지금 위치(#434)', () => {
  it('기준선을 지난 영역 가운데 가장 아래 영역을 고른다(앞 영역 아래쪽이 걸려 있어도)', () => {
    // AI에게 묻기는 위로 지나갔고 재무 흐름 위 끝이 막 기준선을 지났다
    const sections = tops(['briefing', -1800], ['ask', -700], ['financial', 40], ['key-facts', 700])
    expect(pickActiveSection(sections, 80, false, 1000)).toBe('financial')
  })

  it('나란히 놓여 위치가 같은 두 영역은 앞 영역을 고른다', () => {
    expect(pickActiveSection(tops(['briefing', 20], ['profile', 20], ['ask', 600]), 80, false, 1000)).toBe('briefing')
  })

  it('나란히 놓인 두 영역은 바로 가기에서 누른 영역을 고른다', () => {
    expect(pickActiveSection(tops(['briefing', 20], ['profile', 20], ['ask', 600]), 80, false, 1000, 'profile')).toBe('profile')
    // 누른 영역이 같은 줄에 없으면 원래 규칙대로
    expect(pickActiveSection(tops(['briefing', -900], ['ask', 30]), 80, false, 1000, 'profile')).toBe('ask')
  })

  it('아직 아무 영역도 기준선을 지나지 않았으면 첫 영역', () => {
    expect(pickActiveSection(tops(['briefing', 300], ['ask', 900]), 80, false, 1000)).toBe('briefing')
  })

  it('화면 끝까지 내렸으면 화면 안에 보이는 마지막 영역을 고른다', () => {
    const sections = tops(['key-facts', -200], ['signals', 300], ['disclosures', 700])
    expect(pickActiveSection(sections, 80, true, 1000)).toBe('disclosures')
  })

  it('영역이 없으면 null', () => {
    expect(pickActiveSection([], 80, false, 1000)).toBeNull()
  })
})

describe('바로 가기 기준선', () => {
  it('문서 위쪽 여백과 영역 위쪽 여백을 더하고 조금 여유를 둔다', () => {
    // 분석 결과 화면: 결과 탭 여백 68px + 영역 여백 100px이면 영역이 168px에 멈춘다
    expect(landingLine('68px', '100px')).toBe(176)
  })

  it('여백이 없으면(auto) 0으로 본다', () => {
    expect(landingLine('auto', '100px')).toBe(108)
  })

  it('옮겨 온 영역이 기준선을 지나서 앞 영역이 아니라 그 영역이 지금 위치다', () => {
    const line = landingLine('68px', '100px')
    const sections = [
      { id: 'ask', top: -300 },
      { id: 'outlook', top: 168 },
      { id: 'plan', top: 900 },
    ]
    expect(pickActiveSection(sections, line, false, 800)).toBe('outlook')
  })
})
