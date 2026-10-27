// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyAnalysisItem, CompanyAnalysisList } from '@/shared/api/analyses'
import { axeViolations } from '@/test/axe'
import { PastAnalyses } from './PastAnalyses'

const listCompanyAnalyses = vi.fn<(corpCode: string, signal?: AbortSignal, limit?: number) => Promise<CompanyAnalysisList>>()

vi.mock('@/shared/api/analyses', () => ({
  listCompanyAnalyses: (corpCode: string, signal?: AbortSignal, limit?: number) =>
    listCompanyAnalyses(corpCode, signal, limit),
}))

function item(analysisId: number, completedAt: string): CompanyAnalysisItem {
  return {
    analysisId,
    basis: 'YOY',
    previous: { rceptNo: '20250814000987', reportName: '반기보고서 (2025.06)', periodEnd: '2025-06-30' },
    current: { rceptNo: '20260814001234', reportName: '반기보고서 (2026.06)', periodEnd: '2026-06-30' },
    completedAt,
  }
}

function renderPanel(corpCode = '00126380') {
  return render(
    <MemoryRouter>
      <PastAnalyses corpCode={corpCode} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  listCompanyAnalyses.mockReset()
})
afterEach(cleanup)

describe('이미 분석한 비교', () => {
  it('완료된 분석을 결과 화면 링크로 보이고 5개까지 요청한다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: [item(15, '2026-10-24T15:20:31'), item(14, '2026-10-23T09:00:00')] })
    renderPanel()

    const link = await screen.findByRole('link', {
      name: '반기보고서 (2025.06) → 반기보고서 (2026.06) · 전년 동기 · 10/24 완료',
    })
    expect(link.getAttribute('href')).toBe('/analyses/15')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('region', { name: '이미 분석한 비교' })).toBeTruthy()
    expect(listCompanyAnalyses).toHaveBeenCalledWith('00126380', expect.any(AbortSignal), 5)
  })

  it('처음엔 최근 3개만 보이고 더 보기로 나머지를 펼치고 접는다', async () => {
    listCompanyAnalyses.mockResolvedValue({
      items: [15, 14, 13, 12, 11].map((id) => item(id, `2026-10-${id + 9}T09:00:00`)),
    })
    renderPanel()

    const more = await screen.findByRole('button', { name: '더 보기 (2개)' })
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-controls')).toBe(screen.getByRole('list').id)

    fireEvent.click(more)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByRole('button', { name: '접기' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '접기' }))
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('3개 이하면 더 보기 버튼을 두지 않는다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: [item(15, '2026-10-24T15:20:31'), item(14, '2026-10-23T09:00:00')] })
    renderPanel()
    await screen.findAllByRole('link')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('목록이 비면 영역을 보이지 않는다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: [] })
    const { container } = renderPanel()
    await waitFor(() => expect(listCompanyAnalyses).toHaveBeenCalled())
    await Promise.resolve()
    expect(container.innerHTML).toBe('')
  })

  it('불러오지 못하면 영역을 보이지 않는다', async () => {
    listCompanyAnalyses.mockRejectedValue(new Error('network'))
    const { container } = renderPanel()
    await waitFor(() => expect(listCompanyAnalyses).toHaveBeenCalled())
    await Promise.resolve()
    expect(container.innerHTML).toBe('')
  })

  it('화면을 떠나면 진행 중인 요청을 취소한다', async () => {
    listCompanyAnalyses.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderPanel()
    await waitFor(() => expect(listCompanyAnalyses).toHaveBeenCalled())
    const signal = listCompanyAnalyses.mock.calls[0][1]!
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('목록에 접근성 위반이 없다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: [item(15, '2026-10-24T15:20:31')] })
    const { container } = renderPanel()
    await screen.findByRole('link')
    expect(await axeViolations(container)).toBe('')
  })
})
