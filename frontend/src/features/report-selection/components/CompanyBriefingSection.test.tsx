// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { CompanyBriefing } from '@/shared/api/briefing'
import { axeViolations } from '@/test/axe'
import { CompanyBriefingSection } from './CompanyBriefingSection'

const getCompanyBriefing = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyBriefing>>()

vi.mock('@/shared/api/briefing', () => ({
  getCompanyBriefing: (corpCode: string, signal?: AbortSignal) => getCompanyBriefing(corpCode, signal),
}))

const RCEPT = '20260310000123'
const REPORT = {
  rceptNo: RCEPT,
  reportName: '사업보고서 (2025.12)',
  reportType: 'ANNUAL' as const,
  dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${RCEPT}`,
}
const AI = { model: 'fake-model', promptVersion: 'briefing-1', generatedAt: '2026-10-26T10:12:03' }

function generated(): CompanyBriefing {
  return {
    corpCode: '00126380',
    status: 'GENERATED',
    reason: null,
    message: null,
    report: REPORT,
    sentences: [
      {
        no: 1,
        text: '회사는 반도체와 스마트폰을 만들어 판매해요.',
        evidence: [
          {
            evidenceId: `${RCEPT}#B120`,
            rceptNo: RCEPT,
            sectionNo: 12,
            blockNo: 120,
            sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
            quote: '당사는 반도체와 스마트폰을 만들어 판매합니다.',
          },
        ],
      },
      {
        no: 2,
        text: 'DX 부문 매출 비중은 58.1%예요.',
        evidence: [
          {
            evidenceId: `${RCEPT}#B140`,
            rceptNo: RCEPT,
            sectionNo: 15,
            blockNo: 140,
            sectionPath: 'II. 사업의 내용 > 4. 매출 및 수주상황',
            quote: '구분 | 비중\nDX 부문 | 58.1%',
          },
        ],
      },
    ],
    aiGenerated: true,
    ai: AI,
  }
}

beforeEach(() => {
  getCompanyBriefing.mockReset()
})
afterEach(cleanup)

describe('AI 기업 브리핑', () => {
  it('만드는 동안 로딩 안내를 보이고, 끝나면 AI 생성 표시와 원문 보고서·문장을 보인다', async () => {
    let resolve: (value: CompanyBriefing) => void = () => {}
    getCompanyBriefing.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<CompanyBriefingSection corpCode="00126380" />)

    expect(screen.getByRole('status').textContent).toContain('브리핑을 만드는 중')
    expect(getCompanyBriefing).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))

    resolve(generated())
    expect(await screen.findByText('회사는 반도체와 스마트폰을 만들어 판매해요.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AI 기업 브리핑' })).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText('사업보고서 (2025.12)')).toBeTruthy()
    expect(screen.getByRole('link', { name: '사업보고서 (2025.12) DART 원문 새 창으로 열기' }).getAttribute('href')).toBe(
      REPORT.dartUrl,
    )
    expect(screen.getByText(/fake-model · 프롬프트 briefing-1/)).toBeTruthy()
  })

  it('근거 버튼을 누르면 인용한 원문 위치와 문단을 펼치고, 다시 누르면 닫는다', async () => {
    getCompanyBriefing.mockResolvedValue(generated())
    const { container } = render(<CompanyBriefingSection corpCode="00126380" />)
    await screen.findByText('회사는 반도체와 스마트폰을 만들어 판매해요.')

    const first = screen.getByRole('button', { name: /1번 문장 원문 보기/ })
    expect(first.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(first)

    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('당사는 반도체와 스마트폰을 만들어 판매합니다.')).toBeTruthy()
    expect(screen.getByText(/· 블록 120$/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /2번 문장 원문 보기/ }))
    expect(screen.queryByText('당사는 반도체와 스마트폰을 만들어 판매합니다.')).toBeNull()
    expect(screen.getByText('DX 부문 | 58.1%')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /2번 문장 원문 닫기/ }))
    expect(screen.queryByText('DX 부문 | 58.1%')).toBeNull()
  })

  it('검토 필요면 문장 없이 검토 필요 안내를 보인다', async () => {
    getCompanyBriefing.mockResolvedValue({
      ...generated(),
      status: 'REVIEW_NEEDED',
      message: '다시 생성해도 근거·숫자 확인을 통과하지 못했어요.',
      sentences: [],
    })
    render(<CompanyBriefingSection corpCode="00126380" />)

    expect(await screen.findByText('검토 필요')).toBeTruthy()
    expect(screen.getByText(/다시 생성해도 근거·숫자 확인을 통과하지 못했어요/)).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('자료가 없으면 사유를 보이고 AI 생성 표시를 하지 않는다', async () => {
    getCompanyBriefing.mockResolvedValue({
      corpCode: '00126380',
      status: 'NOT_AVAILABLE',
      reason: 'NO_REPORT',
      message: '이 기업의 정기보고서가 없어 브리핑을 만들 수 없어요.',
      report: null,
      sentences: [],
      aiGenerated: false,
      ai: null,
    })
    render(<CompanyBriefingSection corpCode="00126380" />)

    expect(await screen.findByText('이 기업의 정기보고서가 없어 브리핑을 만들 수 없어요.')).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
  })

  it('AI 서버를 쓸 수 없으면 코드별 안내와 다시 시도를 보이고, 다시 시도하면 다시 부른다', async () => {
    getCompanyBriefing
      .mockRejectedValueOnce(new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버가 응답하지 않습니다.', traceId: 't-1', errors: [] }))
      .mockResolvedValueOnce(generated())
    render(<CompanyBriefingSection corpCode="00126380" />)

    expect(await screen.findByText(/AI 서버를 지금 쓸 수 없어 브리핑을 만들지 못했어요/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('회사는 반도체와 스마트폰을 만들어 판매해요.')).toBeTruthy()
    expect(getCompanyBriefing).toHaveBeenCalledTimes(2)
  })
})
