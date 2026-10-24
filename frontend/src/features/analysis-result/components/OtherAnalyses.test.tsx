// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyAnalysisItem, CompanyAnalysisList } from '@/shared/api/analyses'
import { axeViolations } from '@/test/axe'
import { OtherAnalyses } from './OtherAnalyses'

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

const three = [item(15, '2026-10-24T15:20:31'), item(14, '2026-10-23T09:00:00'), item(13, '2026-10-22T09:00:00')]

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/analyses/14?tab=financial&change=31']}>
      <Routes>
        <Route
          path="/analyses/:id"
          element={
            <>
              <OtherAnalyses corpCode="00126380" analysisId={14} tab="financial" />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const toggle = () => screen.findByRole('button', { name: '이 기업의 다른 분석' })

beforeEach(() => {
  listCompanyAnalyses.mockReset()
})
afterEach(cleanup)

describe('이 기업의 다른 분석', () => {
  it('지금 분석을 뺀 다른 분석을 펼쳐 보이고 6개까지 요청한다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: three })
    renderMenu()
    const button = await toggle()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByRole('link')).toHaveLength(0)

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/analyses/15?tab=financial', '/analyses/13?tab=financial'])
    expect(listCompanyAnalyses).toHaveBeenCalledWith('00126380', expect.any(AbortSignal), 6)
  })

  it('항목을 고르면 그 분석의 같은 탭으로 가고 탭 안의 선택값은 지우며 목록을 닫는다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: three })
    renderMenu()
    const button = await toggle()
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('link', { name: /10\/24 완료/ }))
    expect(screen.getByTestId('where').textContent).toBe('/analyses/15?tab=financial')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('Esc로 닫으면 초점이 버튼으로 돌아간다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: three })
    renderMenu()
    const button = await toggle()
    fireEvent.click(button)
    const link = screen.getAllByRole('link')[0]
    link.focus()
    fireEvent.keyDown(link, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('바깥을 누르면 닫힌다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: three })
    renderMenu()
    const button = await toggle()
    fireEvent.click(button)
    fireEvent.mouseDown(screen.getByTestId('where'))
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('다른 분석이 없으면 바로가기를 보이지 않는다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: [item(14, '2026-10-23T09:00:00')] })
    renderMenu()
    await waitFor(() => expect(listCompanyAnalyses).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('불러오지 못하면 바로가기를 보이지 않는다', async () => {
    listCompanyAnalyses.mockRejectedValue(new Error('network'))
    renderMenu()
    await waitFor(() => expect(listCompanyAnalyses).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('펼친 목록에 접근성 위반이 없다', async () => {
    listCompanyAnalyses.mockResolvedValue({ items: three })
    const { container } = renderMenu()
    fireEvent.click(await toggle())
    expect(await axeViolations(container)).toBe('')
  })
})
