// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { DisclosureGroup, DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { axeViolations } from '@/test/axe'
import { DisclosureChartSection } from './DisclosureChartSection'

const listDisclosures = vi.fn<(corpCode: string, signal?: AbortSignal, days?: number) => Promise<DisclosureList>>()

vi.mock('@/shared/api/disclosures', () => ({
  listDisclosures: (corpCode: string, signal?: AbortSignal, days?: number) => listDisclosures(corpCode, signal, days),
}))

const labels: Record<DisclosureGroup, string> = {
  PERIODIC: '정기보고서',
  OWNERSHIP: '지분 변동',
  FUNDING: '자금 조달',
  GOVERNANCE: '지배구조',
  BUSINESS: '실적·영업',
  OTHER: '기타',
}

function item(rceptNo: string, reportName: string, receivedDate: string, group: DisclosureGroup): DisclosureItem {
  return {
    rceptNo,
    reportName,
    filerName: '삼성전자',
    receivedDate,
    group,
    groupLabel: labels[group],
    periodic: group === 'PERIODIC',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
    keyItemsKind: null,
  }
}

function list(items: DisclosureItem[], overrides: Partial<DisclosureList> = {}): DisclosureList {
  const groups = (Object.keys(labels) as DisclosureGroup[]).map((group) => ({
    group,
    label: labels[group],
    count: items.filter((i) => i.group === group).length,
  }))
  return {
    corpCode: '00126380',
    days: 365,
    from: '2025-10-27',
    to: '2026-10-26',
    fetchedAt: '2026-10-26T14:05:12',
    refreshError: null,
    groups,
    items,
    ...overrides,
  }
}

// 서버 순서(접수일이 최근인 순서)
const sample = [
  item('20261026000017', '임원ㆍ주요주주특정증권등소유상황보고서', '2026-10-26', 'OWNERSHIP'),
  item('20260814002000', '반기보고서 (2026.06)', '2026-08-14', 'PERIODIC'),
  item('20260131000300', '연결재무제표기준영업(잠정)실적(공정공시)', '2026-01-31', 'BUSINESS'),
]

function renderSection() {
  return render(
    <MemoryRouter>
      <DisclosureChartSection corpCode="00126380" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  listDisclosures.mockReset()
})
afterEach(cleanup)

describe('공시 타임라인 차트(FS-58, #445)', () => {
  it('최근 365일을 받아 6개 묶음 줄에 건수와 점을 놓는다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    const { container } = renderSection()

    const chart = await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })
    expect(listDisclosures).toHaveBeenCalledWith('00126380', expect.any(AbortSignal), 365)
    const labelsText = Array.from(chart.querySelectorAll('.dot-timeline__label')).map((el) => el.textContent)
    expect(labelsText).toEqual(['정기보고서1건', '지분 변동1건', '자금 조달0건', '지배구조0건', '실적·영업1건', '기타0건'])

    const points = within(chart).getAllByRole('link')
    expect(points).toHaveLength(3)
    const periodic = within(chart).getByRole('link', { name: '반기보고서 (2026.06), 2026.08.14 접수, 정기보고서, DART 원문 새 창' })
    expect(periodic.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814002000')
    expect(periodic.getAttribute('target')).toBe('_blank')
    expect(periodic.className).toContain('dot-timeline__point--emphasis')

    // 키보드로는 가장 최근 점 하나로만 들어온다(로빙 tabindex)
    expect(points.filter((p) => p.tabIndex === 0).map((p) => p.getAttribute('data-point-id'))).toEqual(['20261026000017'])
    expect(screen.getByText(/출처: DART · OpenDART 공시검색 · 기준 기간 2025.10.27 ~ 2026.10.26 접수/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('점에 초점이 가면 툴팁(제목·접수일·묶음)을 보이고 좌우 화살표로 시간 순서대로 옮긴다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    const { container } = renderSection()
    const chart = await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })

    const newest = within(chart).getByRole('link', { name: /^임원ㆍ주요주주/ })
    fireEvent.focus(newest)
    let tooltip = container.querySelector('.dot-timeline__tooltip')!
    expect(tooltip.textContent).toContain('임원ㆍ주요주주특정증권등소유상황보고서')
    expect(tooltip.textContent).toContain('2026.10.26 접수 · 지분 변동')

    fireEvent.keyDown(newest, { key: 'ArrowLeft' })
    const periodic = within(chart).getByRole('link', { name: /^반기보고서/ })
    expect(document.activeElement).toBe(periodic)
    expect(periodic.tabIndex).toBe(0)
    expect(newest.tabIndex).toBe(-1)
    tooltip = container.querySelector('.dot-timeline__tooltip')!
    expect(tooltip.textContent).toContain('2026.08.14 접수 · 정기보고서')
    const compare = within(tooltip as HTMLElement).getByRole('link', { name: /^이 보고서로 비교하기\s*\(반기보고서/ })
    expect(compare.getAttribute('href')).toBe('/companies/00126380?current=20260814002000')
    expect(await axeViolations(container)).toBe('')

    fireEvent.keyDown(periodic, { key: 'Escape' })
    expect(container.querySelector('.dot-timeline__tooltip')).toBeNull()
  })

  it('점에 포인터를 올리면 툴팁을 보이고 차트 밖으로 나가면 닫는다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    const { container } = renderSection()
    const chart = await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })

    fireEvent.pointerEnter(within(chart).getByRole('link', { name: /^연결재무제표기준/ }))
    expect(container.querySelector('.dot-timeline__tooltip')?.textContent).toContain('2026.01.31 접수 · 실적·영업')
    fireEvent.pointerLeave(chart)
    expect(container.querySelector('.dot-timeline__tooltip')).toBeNull()
  })

  it('표로 보기로 바꾸면 같은 공시를 표로 보이고 정기보고서에 비교 링크를 둔다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    const { container } = renderSection()
    await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })

    fireEvent.click(screen.getByRole('button', { name: '표로 보기' }))
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(['2026.10.26', '2026.08.14', '2026.01.31'])
    expect(within(table).getByRole('link', { name: /^이 보고서로 비교하기\s*\(반기보고서/ })).toBeTruthy()
    expect(within(table).getAllByRole('link', { name: /DART 원문 새 창으로 열기/ })).toHaveLength(3)
    expect(await axeViolations(container)).toBe('')
  })

  it('표는 20건씩 보이고 더 보기로 나머지를 연다', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item(`202609${String(i + 10).padStart(2, '0')}000001`, `공시 ${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, 'OTHER'),
    )
    listDisclosures.mockResolvedValue(list(many))
    renderSection()
    await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })
    fireEvent.click(screen.getByRole('button', { name: '표로 보기' }))

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21)
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5건 / 남은 5건)' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(26)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it('1년 공시가 없으면 최근 1년 공시 없음을 보인다', async () => {
    listDisclosures.mockResolvedValue(list([]))
    const { container } = renderSection()
    expect(await screen.findByText('최근 1년 공시 없음')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /최근 1년 공시 타임라인/ })).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('받기에 실패하면 이 영역에만 오류와 다시 시도를 보이고, 다시 시도하면 다시 부른다', async () => {
    listDisclosures
      .mockRejectedValueOnce(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: '실패', traceId: 'trace-1', errors: [] }))
      .mockResolvedValueOnce(list(sample))
    const { container } = renderSection()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('OpenDART에서 1년 공시를 받지 못했어요.')
    expect(await axeViolations(container)).toBe('')
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('group', { name: /최근 1년 공시 타임라인/ })).toBeTruthy())
    expect(listDisclosures).toHaveBeenCalledTimes(2)
  })

  it('좁은 화면에서는 표로 시작한다', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query === '(max-width: 600px)', media: query }) as MediaQueryList)
    try {
      listDisclosures.mockResolvedValue(list(sample))
      renderSection()
      expect(await screen.findByRole('table')).toBeTruthy()
      expect(screen.getByRole('button', { name: '표로 보기' }).getAttribute('aria-pressed')).toBe('true')
    } finally {
      window.matchMedia = original
    }
  })
})
