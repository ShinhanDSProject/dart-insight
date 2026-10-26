// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { RecentAnalysis } from '@/shared/lib/recentAnalyses'
import { axeViolations } from '@/test/axe'
import { RecentAnalyses } from './RecentAnalyses'

const noop = () => {}

function recent(count: number): RecentAnalysis[] {
  return Array.from({ length: count }, (_, i) => ({
    analysisId: i + 1,
    corpName: `기업${i + 1}`,
    previousReportName: '반기보고서 (2024.06)',
    currentReportName: '반기보고서 (2025.06)',
    basisLabel: '전년 동기',
    viewedAt: '2025-10-20T10:00:00+09:00',
  }))
}

function renderRecent(items: RecentAnalysis[]) {
  return render(
    <MemoryRouter>
      <RecentAnalyses items={items} onRemove={noop} onClear={noop} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('최근 본 분석 접기(#374)', () => {
  it('처음엔 5개만 보이고 더 보기로 나머지를 펼친다', async () => {
    const { container } = renderRecent(recent(7))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    const more = screen.getByRole('button', { name: '더 보기 (2개)' })
    expect(more.getAttribute('aria-controls')).toBe('recent-analyses-list')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(more)
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('button', { name: '접기' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('행에 기업명·비교한 두 보고서·본 시각을 두 줄로 보이고 전체 글을 title로 남긴다', () => {
    renderRecent(recent(1))
    const link = screen.getByRole('link', { name: /기업1/ })
    expect(link.getAttribute('href')).toBe('/analyses/1')
    expect(link.getAttribute('title')).toBe('기업1 반기보고서 (2024.06) → 반기보고서 (2025.06)')
    expect(link.textContent).toContain('전년 동기')
  })

  it('5개 이하이면 더 보기 버튼을 두지 않는다', () => {
    renderRecent(recent(5))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })
})
