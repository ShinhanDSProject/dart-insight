// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { CompanyOutlook } from '@/shared/api/outlook'
import { axeViolations } from '@/test/axe'
import { CompanyOutlookSection } from './CompanyOutlookSection'

const getCompanyOutlook = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyOutlook>>()

vi.mock('@/shared/api/outlook', () => ({
  getCompanyOutlook: (corpCode: string, signal?: AbortSignal) => getCompanyOutlook(corpCode, signal),
}))

const RCEPT = '20260310000123'
const REPORT = {
  rceptNo: RCEPT,
  reportName: '사업보고서 (2025.12)',
  reportType: 'ANNUAL' as const,
  dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${RCEPT}`,
}
const AI = { model: 'fake-model', promptVersion: 'outlook-1', generatedAt: '2026-10-27T10:12:03' }
const FACILITY = '당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.'

function generated(): CompanyOutlook {
  return {
    corpCode: '00126380',
    status: 'GENERATED',
    reason: null,
    message: null,
    report: REPORT,
    items: [
      {
        no: 1,
        category: 'INVESTMENT',
        categoryLabel: '투자·설비',
        summary: '평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.',
        quote: FACILITY,
        evidence: {
          evidenceId: `${RCEPT}#B310`,
          rceptNo: RCEPT,
          sectionNo: 30,
          blockNo: 310,
          sectionPath: 'II. 사업의 내용 > 3. 원재료 및 생산설비',
        },
      },
      {
        no: 2,
        category: 'MARKET',
        categoryLabel: '시장·업황 전망',
        summary: '메모리 시장이 성장할 것으로 전망한다고 밝혔어요.',
        quote: '메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.',
        evidence: {
          evidenceId: `${RCEPT}#B410`,
          rceptNo: RCEPT,
          sectionNo: 41,
          blockNo: 410,
          sectionPath: 'IV. 이사의 경영진단 및 분석의견',
        },
      },
    ],
    aiGenerated: true,
    ai: AI,
  }
}

beforeEach(() => {
  getCompanyOutlook.mockReset()
})
afterEach(cleanup)

describe('회사가 밝힌 전망·계획', () => {
  it('만드는 동안 자리 모양을 보이고, 끝나면 종류별로 요지·인용과 AI 생성·안내 문구를 보인다', async () => {
    let resolve: (value: CompanyOutlook) => void = () => {}
    getCompanyOutlook.mockReturnValue(new Promise((r) => (resolve = r)))
    const { container } = render(<CompanyOutlookSection corpCode="00126380" />)

    expect(screen.getByRole('status').textContent).toContain('전망·계획을 모으는 중')
    expect(getCompanyOutlook).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))

    resolve(generated())
    expect(await screen.findByText('평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '회사가 밝힌 전망·계획' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['투자·설비 1건', '시장·업황 전망 1건'])
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText(`“${FACILITY}”`)).toBeTruthy()
    expect(screen.getByText(/회사가 공시한 계획·전망이며 실현을 보장하지 않아요/)).toBeTruthy()
    expect(screen.getByText(/fake-model · 프롬프트 outlook-1/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('인용은 접고 펼 수 있고, 근거 버튼은 섹션 경로·블록과 DART 원문 링크를 하나씩 편다', async () => {
    getCompanyOutlook.mockResolvedValue(generated())
    const { container } = render(<CompanyOutlookSection corpCode="00126380" />)
    await screen.findByText(`“${FACILITY}”`)

    const fold = screen.getByRole('button', { name: /인용 접기\s*\(1번 항목\)/ })
    fireEvent.click(fold)
    expect(screen.queryByText(`“${FACILITY}”`)).toBeNull()
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: /인용 보기\s*\(1번 항목\)/ }))
    expect(screen.getByText(`“${FACILITY}”`)).toBeTruthy()

    const evidence = screen.getByRole('button', { name: /1번 항목 원문 위치 보기/ })
    fireEvent.click(evidence)
    expect(evidence.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById('company-outlook-evidence-1')!
    expect(panel.textContent).toContain('· 블록 310')
    expect(within(panel).getByRole('link', { name: '1번 항목 근거 보고서 DART 원문 새 창으로 열기' }).getAttribute('href')).toBe(
      REPORT.dartUrl,
    )
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /2번 항목 원문 위치 보기/ }))
    expect(document.getElementById('company-outlook-evidence-1')).toBeNull()
    expect(document.getElementById('company-outlook-evidence-2')?.textContent).toContain('· 블록 410')
  })

  it('찾지 못했으면 없음 안내를 보인다', async () => {
    getCompanyOutlook.mockResolvedValue({
      ...generated(),
      status: 'EMPTY',
      message: '보고서 원문에서 회사가 밝힌 계획·전망 문장을 찾지 못했어요.',
      items: [],
      aiGenerated: false,
      ai: null,
    })
    render(<CompanyOutlookSection corpCode="00126380" />)

    expect(await screen.findByText('찾지 못했어요')).toBeTruthy()
    expect(screen.getByText('보고서 원문에서 회사가 밝힌 계획·전망 문장을 찾지 못했어요.')).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
  })

  it('검토 필요면 항목 없이 검토 필요 안내를 보인다', async () => {
    getCompanyOutlook.mockResolvedValue({
      ...generated(),
      status: 'REVIEW_NEEDED',
      message: '다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요.',
      items: [],
    })
    render(<CompanyOutlookSection corpCode="00126380" />)

    expect(await screen.findByText('검토 필요')).toBeTruthy()
    expect(screen.getByText(/다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요/)).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('사업보고서가 없으면 사유를 보이고 AI 생성 표시를 하지 않는다', async () => {
    getCompanyOutlook.mockResolvedValue({
      corpCode: '00126380',
      status: 'NOT_AVAILABLE',
      reason: 'NO_REPORT',
      message: '이 기업의 사업보고서가 없어 회사가 밝힌 전망·계획을 모을 수 없어요.',
      report: null,
      items: [],
      aiGenerated: false,
      ai: null,
    })
    render(<CompanyOutlookSection corpCode="00126380" />)

    expect(await screen.findByText('이 기업의 사업보고서가 없어 회사가 밝힌 전망·계획을 모을 수 없어요.')).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
  })

  it('AI 서버를 쓸 수 없으면 코드별 안내와 다시 시도를 보이고, 다시 시도하면 다시 부른다', async () => {
    getCompanyOutlook
      .mockRejectedValueOnce(new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버가 응답하지 않습니다.', traceId: 't-1', errors: [] }))
      .mockResolvedValueOnce(generated())
    render(<CompanyOutlookSection corpCode="00126380" />)

    expect(await screen.findByText(/AI 서버를 지금 쓸 수 없어 전망·계획을 모으지 못했어요/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.')).toBeTruthy()
    expect(getCompanyOutlook).toHaveBeenCalledTimes(2)
  })
})
