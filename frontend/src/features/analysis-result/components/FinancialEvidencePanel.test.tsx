// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeDetail } from '@/shared/api/results'
import type { Summary } from '@/shared/api/summary'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import { EvidencePanel } from './EvidencePanel'

const data = vi.hoisted(() => ({
  detail: { status: 'loading' } as LoadState<FinancialChangeDetail>,
  summary: { status: 'loading' } as LoadState<Summary>,
}))

vi.mock('../hooks/useFinancialChanges', () => ({
  useFinancialChangeDetail: () => ({ state: data.detail, reload: () => {} }),
}))

vi.mock('../hooks/useSummary', () => ({
  useSummary: () => ({ state: data.summary, reload: () => {} }),
}))

vi.mock('./AddToNote', () => ({ AddToNote: () => null }))

const mockAnalysis: Analysis = {
  analysisId: 10,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  fsDiv: 'CFS',
  current: {
    rceptNo: '20260814000123',
    reportName: '반기보고서 (2026.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2026,
    periodEnd: '2026-06-30',
    receivedAt: '2026-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000123',
  },
  previous: {
    rceptNo: '20250814000001',
    reportName: '반기보고서 (2025.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2025,
    periodEnd: '2025-06-30',
    receivedAt: '2025-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001',
  },
  status: 'COMPLETED',
  step: 'DONE',
  steps: [],
  error: null,
  createdAt: '2026-08-15T09:00:00Z',
  completedAt: '2026-08-15T09:02:00Z',
  textStatus: 'COMPLETED',
  textMessage: null,
  summaryStatus: 'COMPLETED',
  summaryMessage: null,
  analysisVersion: 'm2-15',
  outdated: false,
}

const mockDetail: FinancialChangeDetail = {
  changeId: 101,
  sjDiv: 'IS',
  accountName: '영업이익',
  accountDetail: null,
  amountBasis: 'CUMULATIVE',
  previousAmount: 10_000_000_000_000,
  currentAmount: 12_000_000_000_000,
  changeAmount: 2_000_000_000_000,
  changeRate: 0.2,
  direction: 'UP',
  calcStatus: 'OK',
  calcMessage: null,
  currency: 'KRW',
  scale: {
    base: 'REVENUE',
    baseAccountName: '매출액',
    baseAmount: 150_000_000_000_000,
    ratio: 0.0133,
    reason: null,
    baseChangeId: 1,
    formula: '2조 ÷ 150조 × 100 = 1.33%',
    baseSource: null,
  },
  accountKey: 'dart_OperatingIncomeLoss',
  fsDiv: 'CFS',
  formula: '12조 − 10조 = 2조',
  rateFormula: '2조 ÷ 10조 × 100 = 20.0%',
  previous: {
    rceptNo: '20250814000001',
    reportName: '반기보고서 (2025.06)',
    fiscalYear: 2025,
    periodEnd: '2025-06-30',
    periodName: '제 56 기 반기',
    sjDiv: 'IS',
    accountId: 'dart_OperatingIncomeLoss',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001',
    sectionNo: 12,
    blockNo: 34,
  },
  current: {
    rceptNo: '20260814000123',
    reportName: '반기보고서 (2026.06)',
    fiscalYear: 2026,
    periodEnd: '2026-06-30',
    periodName: '제 57 기 반기',
    sjDiv: 'IS',
    accountId: 'dart_OperatingIncomeLoss',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000123',
    sectionNo: 14,
    blockNo: 50,
  },
  relatedTextChanges: [
    {
      changeId: 201,
      changeType: 'MODIFIED',
      sectionPath: 'III. 재무에 관한 사항 > 5. 주석',
      preview: '영업이익 증가는 판가 상승에 기인합니다.',
      side: 'current',
      sectionNo: 15,
      blockNo: 120,
    },
  ],
}

describe('Financial EvidencePanel (#512)', () => {
  beforeEach(() => {
    data.detail = { status: 'success', data: mockDetail }
    data.summary = { status: 'loading' }
  })

  afterEach(cleanup)

  function renderEvidence(props: { onOpenSource?: (t: { side: 'previous' | 'current'; section: number; block: number | null }) => void; onOpenText?: (id: number) => void } = {}) {
    return render(
      <MemoryRouter>
        <EvidencePanel
          analysis={mockAnalysis}
          changeId={101}
          unit="WON"
          onClose={() => {}}
          onAsk={() => {}}
          asking={false}
          onOpenSource={props.onOpenSource}
          onOpenText={props.onOpenText}
        />
      </MemoryRouter>,
    )
  }

  it('원문 표 위치(sectionNo)가 있으면 원문 표 보기 버튼을 표시하고 클릭 시 onOpenSource를 호출한다', () => {
    const onOpenSource = vi.fn()
    renderEvidence({ onOpenSource })

    const buttons = screen.getAllByRole('button', { name: '원문 표 보기' })
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[1])
    expect(onOpenSource).toHaveBeenCalledWith({
      side: 'current',
      section: 14,
      block: 50,
    })

    // M2 임시 문구는 제거되어 있어야 함
    expect(screen.queryByText(/원문 표 안의 위치로 바로 이동하는 기능은 3.5\(M2\)에서 붙어요/)).toBeNull()
    expect(screen.getByText('수치는 OpenDART 재무제표 API 값으로 코드가 계산했어요.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '커뮤니티에 인용' }).getAttribute('href')).toBe(
      '/companies/00126380?view=community&quoteAnalysis=10&quoteKind=FINANCIAL_CHANGE&quoteChange=101&quoteSj=IS',
    )
  })

  it('관련 본문·주석 변경이 있으면 목록과 문장 변경 보기 버튼을 표시한다', () => {
    const onOpenText = vi.fn()
    renderEvidence({ onOpenText })

    const section = screen.getByRole('region', { name: '관련 본문·주석 변경' })
    expect(section).toBeTruthy()
    expect(section.textContent).toContain('III. 재무에 관한 사항 > 5. 주석')
    expect(section.textContent).toContain('수정')
    expect(section.textContent).toContain('영업이익 증가는 판가 상승에 기인합니다.')

    const openTextBtn = screen.getByRole('button', { name: '문장 변경 보기' })
    fireEvent.click(openTextBtn)
    expect(onOpenText).toHaveBeenCalledWith(201)
  })

  it('요약에 검증된 AI 설명이 포함되어 있으면 요약 설명을 재사용해 표시한다', () => {
    data.summary = {
      status: 'success',
      data: {
        analysisId: 10,
        summaryStatus: 'COMPLETED',
        summaryMessage: null,
        textStatus: 'COMPLETED',
        items: [
          {
            itemNo: 1,
            kind: 'FINANCIAL',
            target: { type: 'FINANCIAL', changeId: 101, sjDiv: 'IS' },
            lens: 'PROFITABILITY',
            lensLabel: '수익성',
            factSentence: '영업이익이 2조원 증가했어요.',
            aiText: '메모리 가격 상승으로 수익성이 개선되었어요.',
            aiGenerated: true,
            explanationStatus: 'FOUND',
            explanationGrade: 'STATED',
            quote: '메모리 판가 상승 영향',
            quoteEvidence: { evidenceId: '20260814000123#B50', side: 'current', rceptNo: '20260814000123', sectionNo: 14, blockNo: 50 },
            gradeReason: null,
            evidence: [{ evidenceId: '20260814000123#B50', side: 'current', rceptNo: '20260814000123', sectionNo: 14, blockNo: 50 }],
            ai: { model: 'gemini', promptVersion: 'v1', generatedAt: '2026-08-15' },
          },
        ],
        lensCounts: [],
        reviewNeededCount: 0,
        reviewNeeded: [],
      },
    }

    renderEvidence()

    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText(/메모리 가격 상승으로 수익성이 개선되었어요/)).toBeTruthy()
  })

  it('요약 설명과 관련 문장 변경이 모두 없으면 확인된 설명 없음 문구를 표시한다', () => {
    data.detail = {
      status: 'success',
      data: {
        ...mockDetail,
        relatedTextChanges: [],
      },
    }
    data.summary = {
      status: 'success',
      data: {
        analysisId: 10,
        summaryStatus: 'COMPLETED',
        summaryMessage: null,
        textStatus: 'COMPLETED',
        items: [],
        lensCounts: [],
        reviewNeededCount: 0,
        reviewNeeded: [],
      },
    }

    renderEvidence()

    expect(screen.getByText('확인된 설명 없음')).toBeTruthy()
  })

  it('웹 접근성(axe) 위반이 없다', async () => {
    const { container } = renderEvidence()

    const violations = await axeViolations(container)
    expect(violations).toHaveLength(0)
  })
})
