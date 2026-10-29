// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyAnalysisList } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import type { CompanyPlanFollowups } from '@/shared/api/planFollowups'
import { axeViolations } from '@/test/axe'
import { CompanyPlanFollowupSection } from './CompanyPlanFollowupSection'

const getCompanyPlanFollowups = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyPlanFollowups>>()
const listCompanyAnalyses = vi.fn<(corpCode: string, signal?: AbortSignal, limit?: number) => Promise<CompanyAnalysisList>>()

vi.mock('@/shared/api/planFollowups', () => ({
  getCompanyPlanFollowups: (corpCode: string, signal?: AbortSignal) => getCompanyPlanFollowups(corpCode, signal),
}))
vi.mock('@/shared/api/analyses', () => ({
  listCompanyAnalyses: (corpCode: string, signal?: AbortSignal, limit?: number) =>
    listCompanyAnalyses(corpCode, signal, limit),
}))

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const PREV = '20250311000456'
const CUR = '20260310000123'
const report = (rceptNo: string, reportName: string) => ({
  rceptNo,
  reportName,
  reportType: 'ANNUAL' as const,
  dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
})
const PLAN_QUOTE = '당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.'
const CUR_QUOTE = '평택 신규 라인은 증설 공사를 진행 중입니다.'
const evidence = (rceptNo: string, blockNo: number) => ({
  evidenceId: `${rceptNo}#B${blockNo}`,
  rceptNo,
  sectionNo: 30,
  blockNo,
  sectionPath: 'II. 사업의 내용 > 3. 원재료 및 생산설비',
})
/** 평가 낱말(ADR-0041). 화면 어디에도 나오면 안 된다 */
const JUDGMENT = /지켰|어겼|이행했|이행하지 못|우수|실패|성공적/

function generated(): CompanyPlanFollowups {
  return {
    corpCode: '00126380',
    status: 'GENERATED',
    reason: null,
    message: null,
    previousReport: report(PREV, '사업보고서 (2024.12)'),
    currentReport: report(CUR, '사업보고서 (2025.12)'),
    items: [
      {
        planNo: 1,
        category: 'INVESTMENT',
        categoryLabel: '투자·설비',
        plan: { summary: '평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.', quote: PLAN_QUOTE, evidence: evidence(PREV, 300) },
        followup: {
          status: 'MENTIONED',
          statusLabel: '관련 언급 있음',
          summary: '올해 보고서에 평택 신규 라인 증설 공사를 진행 중이라고 적었어요.',
          quote: CUR_QUOTE,
          evidence: evidence(CUR, 310),
        },
      },
      {
        planNo: 2,
        category: 'NEW_BUSINESS',
        categoryLabel: '신규 사업·제품',
        plan: { summary: '미국 공장 착공 계획을 밝혔어요.', quote: '미국 공장을 착공할 예정입니다.', evidence: evidence(PREV, 320) },
        followup: {
          status: 'CHANGED',
          statusLabel: '계획 변경 언급',
          summary: '올해 보고서에 착공을 2027년으로 연기했다고 적었어요.',
          quote: '미국 공장 착공은 2027년으로 연기하였습니다.',
          evidence: evidence(CUR, 330),
        },
      },
      {
        planNo: 3,
        category: 'FINANCIAL',
        categoryLabel: '재무·주주 정책',
        plan: { summary: '배당을 늘릴 계획이라고 밝혔어요.', quote: '배당을 늘릴 계획입니다.', evidence: evidence(PREV, 410) },
        followup: { status: 'NOT_FOUND', statusLabel: '찾지 못함', summary: null, quote: null, evidence: null },
      },
    ],
    aiGenerated: true,
    ai: { model: 'fake-model', promptVersion: 'plan-followup-1', generatedAt: '2026-10-27T10:12:03' },
  }
}

function stopped(status: CompanyPlanFollowups['status'], reason: CompanyPlanFollowups['reason'], message: string): CompanyPlanFollowups {
  return { ...generated(), status, reason, message, items: [], aiGenerated: false, ai: null }
}

beforeEach(() => {
  getCompanyPlanFollowups.mockReset()
  listCompanyAnalyses.mockReset()
  listCompanyAnalyses.mockResolvedValue({ items: [] })
})
afterEach(cleanup)

describe('작년 계획, 올해는', () => {
  it('만드는 동안 자리 모양을 보이고, 끝나면 계획마다 작년·올해를 두 칸으로 양쪽 근거와 함께 보인다(AC1)', async () => {
    let resolve: (value: CompanyPlanFollowups) => void = () => {}
    getCompanyPlanFollowups.mockReturnValue(new Promise((r) => (resolve = r)))
    const { container } = renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    expect(screen.getByRole('status').textContent).toContain('나란히 놓는 중')
    expect(getCompanyPlanFollowups).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))

    resolve(generated())
    expect(await screen.findByText('평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '작년 계획, 올해는' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '1. 투자·설비 관련 언급 있음',
      '2. 신규 사업·제품 계획 변경 언급',
      '3. 재무·주주 정책 찾지 못함',
    ])
    const previous = screen.getByRole('region', { name: '1번 작년 계획' })
    expect(within(previous).getByText(`“${PLAN_QUOTE}”`)).toBeTruthy()
    expect(previous.textContent).toContain('· 블록 300')
    expect(within(previous).getByRole('link', { name: '1번 작년 계획 근거 보고서 DART 원문 새 창으로 열기' }).getAttribute('href')).toBe(
      generated().previousReport!.dartUrl,
    )
    const current = screen.getByRole('region', { name: '1번 올해 보고서' })
    expect(within(current).getByText(`“${CUR_QUOTE}”`)).toBeTruthy()
    expect(current.textContent).toContain('· 블록 310')
    expect(within(current).getByRole('link', { name: '1번 올해 문단 근거 보고서 DART 원문 새 창으로 열기' }).getAttribute('href')).toBe(
      generated().currentReport!.dartUrl,
    )
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText(/fake-model · 프롬프트 plan-followup-1/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('찾지 못한 계획은 올해 칸에 찾지 못했다고 쓰고, 이행하지 않았다는 뜻이 아니라는 안내를 둔다(AC2)', async () => {
    getCompanyPlanFollowups.mockResolvedValue(generated())
    renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    const current = await screen.findByRole('region', { name: '3번 올해 보고서' })
    expect(current.textContent).toContain('올해 보고서에서 찾지 못했어요')
    expect(within(current).queryByRole('link')).toBeNull()
    expect(screen.getByText(/찾지 못함은 이행하지 않았다는 뜻이 아니에요\. 회사 공시 문장을 나란히 놓은 것이며 평가하지 않아요\./)).toBeTruthy()
  })

  it('상태 배지는 중립색만 쓰고, 화면 문구에 평가 표현이 없다(AC7)', async () => {
    getCompanyPlanFollowups.mockResolvedValue(generated())
    const { container } = renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)
    await screen.findByText('관련 언급 있음')

    const badges = Array.from(container.querySelectorAll('.plan-followups__title .badge'))
    expect(badges.map((b) => b.className)).toEqual(['badge', 'badge badge--attention', 'badge'])
    expect(container.querySelector('.badge--success, .badge--danger, .badge--positive, .badge--negative')).toBeNull()
    const visible = (container.textContent ?? '').replace('찾지 못함은 이행하지 않았다는 뜻이 아니에요', '')
    expect(visible).not.toMatch(JUDGMENT)
  })

  it('이전 사업보고서가 없으면 안내를 보이고 AI 생성 표시를 하지 않는다(AC4)', async () => {
    getCompanyPlanFollowups.mockResolvedValue({
      ...stopped('NOT_AVAILABLE', 'NO_PREVIOUS_REPORT', '사업연도가 한 해 앞선 사업보고서가 없어 작년 계획과 나란히 볼 수 없어요.'),
      previousReport: null,
    })
    const { container } = renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    expect(await screen.findByText('이전 사업보고서가 없어요')).toBeTruthy()
    expect(screen.getByText('사업연도가 한 해 앞선 사업보고서가 없어 작년 계획과 나란히 볼 수 없어요.')).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
    expect(screen.queryByRole('link', { name: /비교/ })).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('작년 계획이 없으면 계획 없음 안내를 보인다(AC5)', async () => {
    getCompanyPlanFollowups.mockResolvedValue(
      stopped('EMPTY', 'NO_PREVIOUS_PLAN', '작년 사업보고서에서 회사가 밝힌 투자·사업·재무 계획을 찾지 못했어요.'),
    )
    renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    expect(await screen.findByText('작년 계획이 없어요')).toBeTruthy()
    expect(screen.getByText('작년 사업보고서에서 회사가 밝힌 투자·사업·재무 계획을 찾지 못했어요.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('검토 필요면 계획 없이 검토 필요 안내를 보인다(AC3)', async () => {
    getCompanyPlanFollowups.mockResolvedValue({
      ...generated(),
      status: 'REVIEW_NEEDED',
      message: '다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요.',
      items: [],
    })
    renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    expect(await screen.findByText('검토 필요')).toBeTruthy()
    expect(screen.getByText(/다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요/)).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('AI 서버를 쓸 수 없으면 코드별 안내와 다시 시도를 보이고, 다시 시도하면 다시 부른다', async () => {
    getCompanyPlanFollowups
      .mockRejectedValueOnce(new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버가 응답하지 않습니다.', traceId: 't-1', errors: [] }))
      .mockResolvedValueOnce(generated())
    renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    expect(await screen.findByText(/AI 서버를 지금 쓸 수 없어 작년 계획과 올해 보고서를 나란히 놓지 못했어요/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.')).toBeTruthy()
    expect(getCompanyPlanFollowups).toHaveBeenCalledTimes(2)
  })

  it('완료된 분석이 있으면 두 사업보고서 문장 변화 전체 보기 버튼을 제공한다', async () => {
    getCompanyPlanFollowups.mockResolvedValue(generated())
    listCompanyAnalyses.mockResolvedValue({
      items: [
        {
          analysisId: 105,
          basis: 'YOY',
          previous: { rceptNo: PREV, reportName: '작년', periodEnd: '2024-12-31' },
          current: { rceptNo: CUR, reportName: '올해', periodEnd: '2025-12-31' },
          completedAt: '2026-03-20T10:00:00',
        },
      ],
    })
    const { container } = renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    const link = await screen.findByRole('link', { name: '두 사업보고서 문장 변화 전체 보기' })
    expect(link.getAttribute('href')).toBe('/analyses/105?tab=text')
    expect(await axeViolations(container)).toBe('')
  })

  it('완료된 분석이 아직 없으면 이 두 사업보고서 비교하기 링크를 제공한다', async () => {
    getCompanyPlanFollowups.mockResolvedValue(generated())
    listCompanyAnalyses.mockResolvedValue({ items: [] })
    renderWithRouter(<CompanyPlanFollowupSection corpCode="00126380" />)

    const link = await screen.findByRole('link', { name: '이 두 사업보고서 비교하기' })
    expect(link.getAttribute('href')).toBe(`/companies/00126380/compare?current=${CUR}&previous=${PREV}&basis=YOY`)
  })
})
