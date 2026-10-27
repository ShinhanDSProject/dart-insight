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

  describe('붙은 공시 모음 점', () => {
    // 지분 변동 7건이 나흘 안에 몰렸다(접수일이 최근인 순서)
    const crowded = [13, 13, 12, 12, 11, 10, 10].map((day, i) =>
      item(`2026031${i}000001`, `임원ㆍ주요주주특정증권등소유상황보고서 ${i}`, `2026-03-${day}`, 'OWNERSHIP'),
    )
    const withCrowd = [...sample, ...crowded]

    async function openChart() {
      listDisclosures.mockResolvedValue(list(withCrowd))
      const view = renderSection()
      const chart = await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })
      const cluster = within(chart).getByRole('button', { name: '지분 변동 공시 7건 모음, 2026.03.10 ~ 03.13 접수' })
      return { ...view, chart, cluster }
    }

    function tooltipOf(container: HTMLElement) {
      return container.querySelector<HTMLElement>('.dot-timeline__tooltip')
    }

    it('비키기 자리(3)보다 많이 붙은 점은 건수를 쓴 모음 점 하나로 그리고, 정기보고서는 따로 둔다', async () => {
      const { chart, cluster, container } = await openChart()
      expect(cluster.textContent).toBe('7')
      expect(cluster.getAttribute('aria-expanded')).toBe('false')
      // 하나씩 그린 점 3개 + 모음 점 1개
      expect(chart.querySelectorAll('.dot-timeline__point')).toHaveLength(4)
      expect(within(chart).getByRole('link', { name: /^반기보고서/ }).className).toContain('dot-timeline__point--emphasis')
      expect(await axeViolations(container)).toBe('')
    })

    it('hover하면 기간·묶음·건수와 최근 공시 5개(각각 원문 링크), 외 N건을 보인다', async () => {
      const { cluster, container } = await openChart()
      fireEvent.pointerEnter(cluster)
      const tooltip = tooltipOf(container)!
      expect(tooltip.textContent).toContain('지분 변동 7건')
      expect(tooltip.textContent).toContain('2026.03.10 ~ 03.13 접수 · 최근 순서')
      const links = within(tooltip).getAllByRole('link')
      expect(links).toHaveLength(5)
      expect(links[0].getAttribute('href')).toMatch(/^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=2026031[01]000001$/)
      expect(links[0].getAttribute('target')).toBe('_blank')
      expect(links[0].textContent).toContain('2026.03.13 접수, DART 원문 새 창')
      expect(within(tooltip).getByRole('button', { name: '외 2건은 표로 보기' })).toBeTruthy()
      expect(cluster.getAttribute('aria-controls')).toBe(tooltip.id)
      expect(await axeViolations(container)).toBe('')
    })

    it('누르면 툴팁을 고정해 포인터가 떠나도 남기고, 툴팁 링크로 초점을 옮긴 뒤 Esc로 닫으면 모음 점으로 돌아온다', async () => {
      const { chart, cluster, container } = await openChart()
      fireEvent.focus(cluster)
      fireEvent.click(cluster)
      expect(cluster.getAttribute('aria-expanded')).toBe('true')
      fireEvent.pointerLeave(chart)
      expect(tooltipOf(container)?.className).toContain('dot-timeline__tooltip--pinned')
      // 다른 점 위를 지나가도 바뀌지 않는다
      fireEvent.pointerEnter(within(chart).getByRole('link', { name: /^반기보고서/ }))
      expect(tooltipOf(container)?.textContent).toContain('지분 변동 7건')

      // 툴팁 링크는 tabindex를 막지 않아 모음 점 다음 Tab으로 간다
      const firstLink = within(tooltipOf(container)!).getAllByRole('link')[0]
      expect(firstLink.tabIndex).toBe(0)
      firstLink.focus()
      expect(tooltipOf(container)).not.toBeNull()
      fireEvent.keyDown(firstLink, { key: 'Escape' })
      expect(tooltipOf(container)).toBeNull()
      expect(document.activeElement).toBe(cluster)
    })

    it('고정한 툴팁은 차트 바깥을 누르면 닫고, 모음 점을 다시 누르면 닫는다', async () => {
      const { cluster, container } = await openChart()
      fireEvent.click(cluster)
      fireEvent.pointerDown(document.body)
      expect(tooltipOf(container)).toBeNull()

      fireEvent.click(cluster)
      expect(tooltipOf(container)).not.toBeNull()
      fireEvent.click(cluster)
      expect(tooltipOf(container)).toBeNull()
    })

    it('화살표 키는 모음 점을 대상 하나로 옮긴다', async () => {
      const { chart, cluster } = await openChart()
      const business = within(chart).getByRole('link', { name: /^연결재무제표기준/ })
      fireEvent.focus(business)
      fireEvent.keyDown(business, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(cluster)
      expect(cluster.tabIndex).toBe(0)
      fireEvent.keyDown(cluster, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(within(chart).getByRole('link', { name: /^반기보고서/ }))
    })

    it('외 N건은 표로 보기를 누르면 표 보기로 바꾸고 표로 초점을 옮긴다', async () => {
      const { cluster, container } = await openChart()
      fireEvent.click(cluster)
      fireEvent.click(within(tooltipOf(container)!).getByRole('button', { name: '외 2건은 표로 보기' }))
      const table = screen.getByRole('table')
      expect(document.activeElement).toBe(table)
      expect(within(table).getAllByRole('row')).toHaveLength(withCrowd.length + 1)
      expect(screen.getByRole('button', { name: '표로 보기' }).getAttribute('aria-pressed')).toBe('true')
    })

    it('삼성전자 규모(1년 지분 변동 2,774건)에서도 그리는 점 요소는 100개 미만이다', async () => {
      const start = Date.UTC(2025, 9, 27)
      const isoDay = (offset: number) => new Date(start + Math.min(364, offset) * 86_400_000).toISOString().slice(0, 10)
      // 지분 변동은 1년에 고르게(하루 7~8건), 그 밖의 공시는 사흘마다, 정기보고서 4건
      const ownership = Array.from({ length: 2774 }, (_, i) =>
        item(`2026${String(i).padStart(10, '0')}`, `임원ㆍ주요주주특정증권등소유상황보고서 ${i}`, isoDay(Math.floor((i * 365) / 2774)), 'OWNERSHIP'),
      )
      const others = Array.from({ length: 120 }, (_, i) => item(`2025${String(i).padStart(10, '0')}`, `기타 공시 ${i}`, isoDay(i * 3), 'OTHER'))
      const periodic = [19, 134, 200, 291].map((offset, i) =>
        item(`2024${String(i).padStart(10, '0')}`, `정기보고서 ${i}`, isoDay(offset), 'PERIODIC'),
      )
      const all = [...ownership, ...others, ...periodic]
      listDisclosures.mockResolvedValue(list(all))
      renderSection()
      const chart = await screen.findByRole('group', { name: /최근 1년 공시 타임라인/ })
      const rendered = chart.querySelectorAll('.dot-timeline__point').length
      const clusters = chart.querySelectorAll('.dot-timeline__cluster').length
      // 전에는 공시 하나 = 점 요소 하나(2,898개). 폭 720px(테스트 기본 폭)에서는 줄마다 32px 칸 23개 안의 모음 점이 된다
      console.info(`[DotTimeline] 공시 ${all.length}건 → 점 요소 ${rendered}개(모음 점 ${clusters}개)`)
      expect(rendered).toBeLessThan(100)
      expect(chart.querySelectorAll('.dot-timeline__point--emphasis')).toHaveLength(4)
    })
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
