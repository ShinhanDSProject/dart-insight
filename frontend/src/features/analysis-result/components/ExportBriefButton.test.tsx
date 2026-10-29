// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeList } from '@/shared/api/results'
import type { Summary } from '@/shared/api/summary'
import type { TextChangeList } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import { ExportBriefButton } from './ExportBriefButton'

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getFinancialChanges: vi.fn(),
  getTextChanges: vi.fn(),
}))

vi.mock('@/shared/api/summary', () => ({
  getSummary: api.getSummary,
}))

vi.mock('@/shared/api/results', () => ({
  getFinancialChanges: api.getFinancialChanges,
}))

vi.mock('@/shared/api/textChanges', () => ({
  getTextChanges: api.getTextChanges,
}))

const download = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
}))

vi.mock('@/shared/lib/download', () => download)

const mockAnalysis: Analysis = {
  analysisId: 201,
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

const mockSummary: Summary = {
  analysisId: 201,
  summaryStatus: 'COMPLETED',
  summaryMessage: null,
  textStatus: 'COMPLETED',
  items: [],
  lensCounts: [],
  reviewNeededCount: 0,
  reviewNeeded: [],
}

const mockFinancialList = (sjDiv: 'IS' | 'BS' | 'CF'): FinancialChangeList => ({
  analysisId: 201,
  fsDiv: 'CFS',
  sjDiv,
  changedOnly: true,
  sort: 'scale',
  statements: [{ sjDiv, label: sjDiv, comparable: true, amountBasis: 'CUMULATIVE', note: null, total: 10, changed: 2 }],
  items: [],
})

const mockTextList: TextChangeList = {
  analysisId: 201,
  textStatus: 'COMPLETED',
  textMessage: null,
  type: null,
  sort: 'priority',
  section: null,
  q: null,
  risk: true,
  page: 0,
  size: 5,
  totalItems: 0,
  counts: { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 },
  riskCounts: { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 },
  sections: [],
  items: [],
}

describe('ExportBriefButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getSummary.mockResolvedValue(mockSummary)
    api.getFinancialChanges.mockImplementation((_id, sjDiv) => Promise.resolve(mockFinancialList(sjDiv)))
    api.getTextChanges.mockResolvedValue(mockTextList)
  })

  afterEach(() => {
    cleanup()
  })

  it('버튼을 렌더링하고 기본 라벨을 표시한다', () => {
    render(<ExportBriefButton analysis={mockAnalysis} />)
    const button = screen.getByRole('button', { name: '브리프 내려받기' })
    expect(button).toBeTruthy()
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('버튼 클릭 시 요약·재무·위험문장을 조회하고 downloadTextFile을 호출한다', async () => {
    render(<ExportBriefButton analysis={mockAnalysis} />)
    const button = screen.getByRole('button', { name: '브리프 내려받기' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(api.getSummary).toHaveBeenCalledWith(201)
      expect(api.getFinancialChanges).toHaveBeenCalledWith(201, 'IS', true, undefined, 'scale')
      expect(api.getFinancialChanges).toHaveBeenCalledWith(201, 'BS', true, undefined, 'scale')
      expect(api.getFinancialChanges).toHaveBeenCalledWith(201, 'CF', true, undefined, 'scale')
      expect(api.getTextChanges).toHaveBeenCalledWith(201, expect.objectContaining({ risk: true, size: 5 }))
      expect(download.downloadTextFile).toHaveBeenCalledTimes(1)
    })

    const [fileName, content, mimeType] = download.downloadTextFile.mock.calls[0]
    expect(fileName).toContain('삼성전자')
    expect(fileName).toContain('비교브리프.md')
    expect(content).toContain('# 삼성전자 정기보고서 비교 브리프')
    expect(mimeType).toBe('text/markdown;charset=utf-8')
  })

  it('불러오는 중에는 버튼이 비활성화되고 aria-busy가 true가 된다', async () => {
    let finishLoading: () => void = () => {}
    api.getSummary.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = () => resolve(mockSummary)
      }),
    )

    render(<ExportBriefButton analysis={mockAnalysis} />)
    const button = screen.getByRole('button', { name: '브리프 내려받기' })
    fireEvent.click(button)

    const loadingBtn = screen.getByRole('button', { name: '내보내는 중…' })
    expect(loadingBtn.hasAttribute('disabled')).toBe(true)
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true')

    finishLoading()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '브리프 내려받기' }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('조회 실패 시 오류 메시지를 role=alert로 보여 준다', async () => {
    api.getSummary.mockRejectedValue(new Error('네트워크 오류'))

    render(<ExportBriefButton analysis={mockAnalysis} />)
    const button = screen.getByRole('button', { name: '브리프 내려받기' })
    fireEvent.click(button)

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('브리프를 내려받지 못했어요. 다시 시도해 주세요.')
    })
    expect(download.downloadTextFile).not.toHaveBeenCalled()
  })

  it('웹 접근성(axe) 위반이 없다', async () => {
    const { container } = render(<ExportBriefButton analysis={mockAnalysis} />)
    const violations = await axeViolations(container)
    expect(violations).toHaveLength(0)
  })
})
