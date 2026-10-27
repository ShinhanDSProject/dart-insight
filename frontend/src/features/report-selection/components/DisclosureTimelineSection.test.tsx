// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type {
  DisclosureGroup,
  DisclosureItem,
  DisclosureKeyItems,
  DisclosureList,
  KeyItemsKind,
} from '@/shared/api/disclosures'
import { axeViolations } from '@/test/axe'
import { DisclosureTimelineSection } from './DisclosureTimelineSection'

const listDisclosures = vi.fn<(corpCode: string, signal?: AbortSignal, days?: number) => Promise<DisclosureList>>()

const getDisclosureKeyItems =
  vi.fn<(corpCode: string, rceptNo: string, signal?: AbortSignal) => Promise<DisclosureKeyItems>>()

vi.mock('@/shared/api/disclosures', () => ({
  listDisclosures: (corpCode: string, signal?: AbortSignal, days?: number) => listDisclosures(corpCode, signal, days),
  getDisclosureKeyItems: (corpCode: string, rceptNo: string, signal?: AbortSignal) =>
    getDisclosureKeyItems(corpCode, rceptNo, signal),
}))

const labels: Record<DisclosureGroup, string> = {
  PERIODIC: '정기보고서',
  OWNERSHIP: '지분 변동',
  FUNDING: '자금 조달',
  GOVERNANCE: '지배구조',
  BUSINESS: '실적·영업',
  OTHER: '기타',
}

function item(
  rceptNo: string,
  reportName: string,
  receivedDate: string,
  group: DisclosureGroup,
  keyItemsKind: KeyItemsKind | null = null,
): DisclosureItem {
  return {
    keyItemsKind,
    rceptNo,
    reportName,
    filerName: '삼성전자',
    receivedDate,
    group,
    groupLabel: labels[group],
    periodic: group === 'PERIODIC',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
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
    days: 90,
    from: '2026-07-28',
    to: '2026-10-26',
    fetchedAt: '2026-10-26T14:05:12',
    refreshError: null,
    groups,
    items,
    ...overrides,
  }
}

const sample = [
  item('20261026000017', '임원ㆍ주요주주특정증권등소유상황보고서', '2026-10-26', 'OWNERSHIP'),
  item('20261026000020', '[기재정정]연결재무제표기준영업(잠정)실적(공정공시)', '2026-10-26', 'BUSINESS'),
  item('20260814002000', '반기보고서 (2026.06)', '2026-08-14', 'PERIODIC'),
]

function renderSection() {
  return render(
    <MemoryRouter>
      <DisclosureTimelineSection corpCode="00126380" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  listDisclosures.mockReset()
  getDisclosureKeyItems.mockReset()
})

// 에코프로비엠 자기주식처분결정 20251020000144 실제 OpenDART 응답에서 옮긴 값(일부 항목)
const disposal = item('20251020000144', '주요사항보고서(자기주식처분결정)', '2026-10-20', 'OWNERSHIP', 'TREASURY_STOCK_DISPOSAL')

function keyItems(overrides: Partial<DisclosureKeyItems> = {}): DisclosureKeyItems {
  return {
    rceptNo: '20251020000144',
    kind: 'TREASURY_STOCK_DISPOSAL',
    kindLabel: '자기주식 처분 결정',
    status: 'AVAILABLE',
    items: [
      { field: 'dppln_stk_ostk', label: '처분예정주식(보통주식)', value: '65,168', unit: '주' },
      { field: 'dppln_prc_ostk', label: '처분예정금액(보통주식)', value: '10,492,048,000', unit: '원' },
      { field: 'dp_pp', label: '처분목적', value: '종업원에 대한 상여금 지급 (RSU)', unit: null },
    ],
    sourceUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20251020000144',
    fetchedAt: '2026-10-26T15:10:03',
    ...overrides,
  }
}

describe('핵심 수치', () => {
  it('지원하는 주요사항보고서에만 핵심 수치 버튼을 둔다', async () => {
    listDisclosures.mockResolvedValue(list([...sample, disposal]))
    renderSection()

    const buttons = await screen.findAllByRole('button', { name: /^핵심 수치/ })
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(getDisclosureKeyItems).not.toHaveBeenCalled()
  })

  it('펼치면 불러와 항목 이름·원문 값·단위와 출처를 보여 주고 다시 누르면 닫는다', async () => {
    listDisclosures.mockResolvedValue(list([disposal]))
    getDisclosureKeyItems.mockResolvedValue(keyItems())
    renderSection()

    const button = await screen.findByRole('button', { name: /^핵심 수치/ })
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(await screen.findByText('10,492,048,000 원')).toBeTruthy()
    expect(screen.getByText('처분예정주식(보통주식)')).toBeTruthy()
    expect(screen.getByText('65,168 주')).toBeTruthy()
    expect(screen.getByText('종업원에 대한 상여금 지급 (RSU)')).toBeTruthy()
    expect(screen.getByText(/출처: OpenDART 주요사항보고서 주요정보\(자기주식 처분 결정\)/)).toBeTruthy()
    const source = screen.getByRole('link', { name: /원문 보기/ })
    expect(source.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20251020000144')
    expect(getDisclosureKeyItems).toHaveBeenCalledWith('00126380', '20251020000144', expect.any(AbortSignal))

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('10,492,048,000 원')).toBeNull()
  })

  it('자료가 없으면 자료 없음과 원문 링크를 보여 준다', async () => {
    listDisclosures.mockResolvedValue(list([disposal]))
    getDisclosureKeyItems.mockResolvedValue(keyItems({ status: 'NO_DATA', items: [] }))
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /^핵심 수치/ }))
    expect(await screen.findByText('OpenDART에 이 공시의 핵심 수치 자료가 없어요. 원문으로 확인해 주세요.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /원문 보기/ })).toBeTruthy()
  })

  it('불러오는 중과 실패를 보여 주고 다시 시도할 수 있다', async () => {
    listDisclosures.mockResolvedValue(list([disposal]))
    getDisclosureKeyItems.mockReturnValueOnce(new Promise(() => {}))
    renderSection()

    const button = await screen.findByRole('button', { name: /^핵심 수치/ })
    fireEvent.click(button)
    expect(await screen.findByText('핵심 수치를 불러오는 중이에요…')).toBeTruthy()
    fireEvent.click(button)

    getDisclosureKeyItems.mockRejectedValueOnce(
      new ApiError(503, { code: 'DART_RATE_LIMITED', message: '한도', traceId: 'trace-2', errors: [] }),
    )
    getDisclosureKeyItems.mockResolvedValueOnce(keyItems())
    fireEvent.click(button)
    expect(
      await screen.findByText('OpenDART 호출 한도를 넘어 핵심 수치를 받지 못했어요. 내일 다시 시도해 주세요.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('10,492,048,000 원')).toBeTruthy()
  })

  it('닫으면 진행 중인 요청을 취소한다', async () => {
    listDisclosures.mockResolvedValue(list([disposal]))
    getDisclosureKeyItems.mockReturnValue(new Promise(() => {}))
    renderSection()

    const button = await screen.findByRole('button', { name: /^핵심 수치/ })
    fireEvent.click(button)
    await waitFor(() => expect(getDisclosureKeyItems).toHaveBeenCalled())
    const signal = getDisclosureKeyItems.mock.calls[0][2]!
    fireEvent.click(button)
    expect(signal.aborted).toBe(true)
  })

  it('펼친 핵심 수치에 접근성 위반이 없다', async () => {
    listDisclosures.mockResolvedValue(list([...sample, disposal]))
    getDisclosureKeyItems.mockResolvedValue(keyItems())
    const { container } = renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /^핵심 수치/ }))
    await screen.findByText('10,492,048,000 원')
    expect(await axeViolations(container)).toBe('')
  })
})
afterEach(cleanup)

describe('최근 공시 타임라인', () => {
  it('접수일별로 묶어 보여 주고 공시마다 DART 원문을 새 창으로 연다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    renderSection()

    const link = await screen.findByRole('link', { name: /^반기보고서 \(2026\.06\).*DART 원문/ })
    expect(link.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814002000')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['2026.10.26', '2026.08.14'])
    expect(screen.getByRole('region', { name: '최근 공시' })).toBeTruthy()
    expect(listDisclosures).toHaveBeenCalledWith('00126380', expect.any(AbortSignal), undefined)
  })

  it('정기보고서에만 이 보고서로 비교하기 링크를 둔다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    renderSection()

    const compare = await screen.findAllByRole('link', { name: /이 보고서로 비교하기/ })
    expect(compare).toHaveLength(1)
    expect(compare[0].getAttribute('href')).toBe('/companies/00126380?current=20260814002000')
  })

  it('묶음 칩을 누르면 그 묶음만 보이고 건수를 함께 보여 준다', async () => {
    listDisclosures.mockResolvedValue(list(sample))
    renderSection()

    const filters = await screen.findByRole('group', { name: '공시 묶음' })
    const all = within(filters).getByRole('button', { name: '전체3' })
    expect(all.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(filters).getByRole('button', { name: '지분 변동1' }))

    expect(within(filters).getByRole('button', { name: '지분 변동1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('link', { name: /DART 원문/ })).toHaveLength(1)
    expect(screen.queryByText(/반기보고서/)).toBeNull()

    fireEvent.click(within(filters).getByRole('button', { name: '자금 조달0' }))
    expect(screen.getByText('이 묶음에 해당하는 공시가 없어요.')).toBeTruthy()
  })

  it('공시가 없으면 빈 상태를 보여 준다', async () => {
    listDisclosures.mockResolvedValue(list([]))
    renderSection()
    expect(await screen.findByText('이 기간에 낸 공시가 없어요.')).toBeTruthy()
  })

  it('다시 받지 못해 저장된 목록을 쓰면 알린다', async () => {
    listDisclosures.mockResolvedValue(list(sample, { refreshError: 'DART_RATE_LIMITED' }))
    renderSection()
    expect(
      await screen.findByText('OpenDART 호출 한도를 넘었어요. 2026.10.26 14:05에 받아 둔 목록을 보여 줘요.'),
    ).toBeTruthy()
  })

  it('불러오지 못하면 에러 코드에 맞는 안내와 다시 시도를 보여 준다', async () => {
    listDisclosures.mockRejectedValueOnce(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: '실패', traceId: 'trace-1', errors: [] }))
    listDisclosures.mockResolvedValueOnce(list(sample))
    renderSection()

    expect(await screen.findByText('OpenDART에서 최근 공시를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('link', { name: /^반기보고서.*DART 원문/ })).toBeTruthy()
  })

  it('많으면 일부만 보여 주고 더 보기로 늘린다', async () => {
    const many = Array.from({ length: 15 }, (_, n) =>
      item(`202610010000${String(n).padStart(2, '0')}`, '최대주주등소유주식변동신고서', '2026-10-01', 'OWNERSHIP'),
    )
    listDisclosures.mockResolvedValue(list(many))
    renderSection()

    await screen.findAllByRole('link', { name: /DART 원문/ })
    expect(screen.getAllByRole('link', { name: /DART 원문/ })).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5건 / 남은 5건)' }))
    expect(screen.getAllByRole('link', { name: /DART 원문/ })).toHaveLength(15)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it('화면을 떠나면 진행 중인 요청을 취소한다', async () => {
    listDisclosures.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderSection()
    await waitFor(() => expect(listDisclosures).toHaveBeenCalled())
    const signal = listDisclosures.mock.calls[0][1]!
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('타임라인에 접근성 위반이 없다', async () => {
    listDisclosures.mockResolvedValue(list(sample, { refreshError: 'DART_REQUEST_FAILED' }))
    const { container } = renderSection()
    await screen.findAllByRole('link', { name: /DART 원문/ })
    expect(await axeViolations(container)).toBe('')
  })
})
