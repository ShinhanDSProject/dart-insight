// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ACTIVITY_DONE, DEMO_QUESTION, DEMO_SCENARIO, DEMO_SEARCH } from './scenario'

describe('DEMO_SCENARIO', () => {
  it('단계마다 이름·자막과 할 동작이 있다', () => {
    for (const step of DEMO_SCENARIO) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.caption.length).toBeGreaterThan(0)
      expect(step.actions.length).toBeGreaterThan(0)
    }
  })

  it('분석 번호나 주소를 박지 않아 로컬·배포 어디서든 같은 흐름이다', () => {
    expect(JSON.stringify(DEMO_SCENARIO)).not.toMatch(/\/analyses\/\d|\/companies\/\d/)
  })

  it('AI 질문은 재무 수치 바로 다음 단계이고 채팅 입력 길이(2~500자)에 맞다', () => {
    const titles = DEMO_SCENARIO.map((step) => step.title)
    const asking = DEMO_SCENARIO.findIndex((step) => step.actions.some((action) => action.kind === 'type' && action.text === DEMO_QUESTION))
    expect(asking).toBe(titles.indexOf('재무 수치') + 1)
    expect(DEMO_QUESTION.length).toBeGreaterThanOrEqual(2)
    expect(DEMO_QUESTION.length).toBeLessThanOrEqual(500)
  })

  it('첫 검색은 초성으로 친다', () => {
    expect(DEMO_SCENARIO[0].actions[0]).toMatchObject({ kind: 'type', text: DEMO_SEARCH })
    expect(DEMO_SEARCH).toMatch(/^[ㄱ-ㅎ]{2,}$/)
  })

  it('재무 수치 → AI 에이전트 → 공시 분석(요약·타임라인·이 기간에 한 일) → 원문(바뀐 문장) 순서다', () => {
    const titles = DEMO_SCENARIO.map((step) => step.title)
    expect(titles.slice(titles.indexOf('재무 수치') + 1, titles.indexOf('바뀐 문장'))).toEqual([
      'AI 에이전트',
      '공시 분석 · 한 문단 요약',
      '공시 분석 · 이 기간 타임라인',
      '공시 분석 · 이 기간에 한 일',
    ])
  })

  it('AI에게는 재무 수치 탭에서 용어를 묻는다', () => {
    const asking = DEMO_SCENARIO.find((step) => step.actions.some((action) => action.kind === 'type' && action.text === DEMO_QUESTION))
    expect(DEMO_QUESTION).toContain('이익잉여금')
    expect(asking?.actions[0]).toMatchObject({ kind: 'click', target: { text: '재무 수치' } })
  })

  it('공시 분석을 불러오다 오류가 나면 끝난 화면으로 치지 않는다', () => {
    const activity = (inner: string) => {
      document.body.innerHTML = `<section class="activity">${inner}</section>`
      return document.querySelector(ACTIVITY_DONE.selector) !== null
    }
    expect(activity('<div class="activity-loading"></div>')).toBe(false)
    expect(activity('<div class="state state--error" role="alert"></div>')).toBe(false)
    expect(activity('<ol class="activity__list"><li><article class="activity-card"></article></li></ol>')).toBe(true)
    document.body.innerHTML = ''
  })
})
