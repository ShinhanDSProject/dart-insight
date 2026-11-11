// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ReportItem } from '@/shared/api/reports'
import { useAnalysisProgress } from './useAnalysisProgress'

const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

let mockAnalysis: Analysis

vi.mock('@/shared/api/analyses', () => ({
  getAnalysis: () => Promise.resolve(mockAnalysis),
}))

function report(rceptNo: string, year: number): ReportItem {
  return {
    rceptNo,
    reportName: `반기보고서 (${year}.06)`,
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: year,
    periodEnd: `${year}-06-30`,
    receivedAt: `${year}-08-14`,
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

const completedAnalysis: Analysis = {
  analysisId: 99,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  fsDiv: 'CFS',
  previous: report('20250814000001', 2025),
  current: report('20260814000001', 2026),
  status: 'COMPLETED',
  step: 'DONE',
  steps: [
    { step: 'RECEIVED', label: '요청 접수', state: 'DONE' },
    { step: 'COMPARING', label: '보고서 비교', state: 'DONE' },
    { step: 'VERIFYING', label: '근거 확인', state: 'DONE' },
    { step: 'DONE', label: '완료', state: 'DONE' },
  ],
  error: null,
  createdAt: '2026-10-30T10:00:00',
  completedAt: '2026-10-30T10:00:05',
  textStatus: null,
  textMessage: null,
  summaryStatus: null,
  summaryMessage: null,
  analysisVersion: 'm2-9',
  outdated: false,
}

describe('useAnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigate.mockReset()
    mockAnalysis = completedAnalysis
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('minProgressDisplayMs가 0이면 완료 즉시 결과 화면으로 이동한다', async () => {
    renderHook(() =>
      useAnalysisProgress('99', { minProgressDisplayMs: 0, minCompletedDisplayMs: 0 }),
    )

    // flush promise
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockNavigate).toHaveBeenCalledWith('/analyses/99', { replace: true })
  })

  it('minProgressDisplayMs가 설정되어 있으면 남은 시간 동안 머무른 뒤 결과 화면으로 이동한다', async () => {
    renderHook(() =>
      useAnalysisProgress('99', { minProgressDisplayMs: 1400, minCompletedDisplayMs: 1000 }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    // 1400ms 전에는 아직 navigate되지 않음
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(mockNavigate).not.toHaveBeenCalled()

    // 400ms 더 경과하여 1400ms에 도달하면 navigate 호출됨
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/analyses/99', { replace: true })
  })
})
