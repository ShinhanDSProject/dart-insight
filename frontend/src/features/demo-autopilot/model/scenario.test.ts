// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { pastAnalysisLabel } from '@/shared/lib/pastAnalyses'
import {
  ACTIVITY_DONE,
  DEMO_CURRENT_REPORT,
  DEMO_PREVIOUS_REPORT,
  DEMO_QUESTION,
  DEMO_SCENARIO,
  DEMO_SEARCH,
  DEMO_TEXT_CHANGE,
  OPEN_PAST_ANALYSIS,
  PAST_DEMO_PAIR,
} from './scenario'

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

  it('재무 수치 → AI 에이전트 → 공시 분석(요약·타임라인·이 기간에 한 일) → 원문 비교 순서다', () => {
    const titles = DEMO_SCENARIO.map((step) => step.title)
    expect(titles.slice(titles.indexOf('재무 수치') + 1, titles.indexOf('원문 비교'))).toEqual([
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

  it('2025년 사업보고서를 현재 보고서로 골라 2024년 사업보고서와 비교한다', () => {
    const picking = DEMO_SCENARIO.find((step) => step.title === '보고서 고르기')
    expect(picking?.actions).toContainEqual({ kind: 'select', target: { selector: '#pair-current' }, option: DEMO_CURRENT_REPORT })
    expect(DEMO_CURRENT_REPORT).toBe('사업보고서 (2025.12)')
    expect(DEMO_PREVIOUS_REPORT).toBe('사업보고서 (2024.12)')
  })

  it('마지막은 우선순위 순 바뀐 곳에서 사업의 내용 수정 문단을 원문 비교 창으로 연다', () => {
    const last = DEMO_SCENARIO[DEMO_SCENARIO.length - 1]
    expect(last.title).toBe('원문 비교')
    expect(last.actions).toContainEqual({ kind: 'select', target: { selector: 'select.text-filterbar__sort' }, option: '우선순위 순' })
    expect(last.actions).toContainEqual({ kind: 'click', target: { selector: 'button.change-row', text: DEMO_TEXT_CHANGE } })
    expect(last.actions.at(-1)).toMatchObject({ kind: 'spotlight', target: { selector: '.text-compare-dialog' } })
  })

  it('새 분석이 안 되면 목록 맨 위가 아니라 시연 쌍의 지난 결과를 연다', () => {
    const item = (analysisId: number, previous: string, current: string): CompanyAnalysisItem => ({
      analysisId,
      basis: 'YOY',
      previous: { rceptNo: `p${analysisId}`, reportName: previous, periodEnd: '2025-06-30' },
      current: { rceptNo: `c${analysisId}`, reportName: current, periodEnd: '2026-06-30' },
      completedAt: '2026-10-30T11:42:50',
    })
    const labels = [item(14, '반기보고서 (2025.06)', '반기보고서 (2026.06)'), item(8, DEMO_PREVIOUS_REPORT, DEMO_CURRENT_REPORT)].map(pastAnalysisLabel)
    expect(labels.filter((label) => label.includes(PAST_DEMO_PAIR.text ?? ''))).toEqual([labels[1]])

    const handing = DEMO_SCENARIO.find((step) => step.title === '핵심 3줄')?.actions.find((action) => action.kind === 'wait')
    expect(handing).toMatchObject({ otherwise: OPEN_PAST_ANALYSIS })
    // 접힌 줄을 펼친 뒤 시연 쌍을 찾고, 없을 때만 가장 최근 결과를 연다
    expect(OPEN_PAST_ANALYSIS.map((action) => action.kind)).toEqual(['back', 'wait', 'click', 'wait', 'click', 'wait'])
    expect(OPEN_PAST_ANALYSIS[3]).toMatchObject({ target: PAST_DEMO_PAIR, otherwise: [{ kind: 'click', target: { selector: '.past-analyses a.list-link' } }] })
    expect(OPEN_PAST_ANALYSIS[4]).toEqual({ kind: 'click', target: PAST_DEMO_PAIR, optional: true })
  })
})
