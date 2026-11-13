import { describe, expect, it } from 'vitest'
import { DEMO_QUESTION, DEMO_SCENARIO } from './scenario'

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

  it('AI 질문은 마지막 단계이고 채팅 입력 길이(2~500자)에 맞다', () => {
    const last = DEMO_SCENARIO[DEMO_SCENARIO.length - 1]
    expect(last.actions.some((action) => action.kind === 'type' && action.text === DEMO_QUESTION)).toBe(true)
    expect(DEMO_QUESTION.length).toBeGreaterThanOrEqual(2)
    expect(DEMO_QUESTION.length).toBeLessThanOrEqual(500)
  })
})
