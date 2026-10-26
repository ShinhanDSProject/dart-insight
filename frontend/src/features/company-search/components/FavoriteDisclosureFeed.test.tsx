// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { axeViolations } from '@/test/axe'
import { FEED_SEEN_AT_KEY } from '../model/favoriteFeed'
import { FavoriteDisclosureFeed } from './FavoriteDisclosureFeed'

const listDisclosures = vi.hoisted(() =>
  vi.fn<(corpCode: string, signal?: AbortSignal, days?: number) => Promise<DisclosureList>>(),
)
vi.mock('@/shared/api/disclosures', () => ({ listDisclosures }))

function item(rceptNo: string, receivedDate: string, reportName: string): DisclosureItem {
  return {
    rceptNo,
    reportName,
    filerName: null,
    receivedDate,
    group: 'OWNERSHIP',
    groupLabel: '지분',
    periodic: false,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
  }
}

function list(corpCode: string, items: DisclosureItem[]): DisclosureList {
  return { corpCode, days: 30, from: '2026-09-26', to: '2026-10-26', fetchedAt: null, refreshError: null, groups: [], items }
}

const samsung = { corpCode: '00126380', corpName: '삼성전자' }
const hynix = { corpCode: '00164779', corpName: 'SK하이닉스' }

const byCompany: Record<string, DisclosureItem[]> = {
  [samsung.corpCode]: [item('20261020000001', '2026-10-20', '임원ㆍ주요주주특정증권등소유상황보고서')],
  [hynix.corpCode]: [item('20261024000002', '2026-10-24', '주식등의대량보유상황보고서')],
}

beforeEach(() => {
  window.localStorage.clear()
  listDisclosures.mockReset()
  listDisclosures.mockImplementation((corpCode) => Promise.resolve(list(corpCode, byCompany[corpCode] ?? [])))
})

afterEach(cleanup)

describe('관심 기업 새 공시(FS-52)', () => {
  it('관심 기업이 없으면 부르지 않고 짧은 안내를 보인다', () => {
    render(<FavoriteDisclosureFeed companies={[]} />)
    expect(screen.getByText('관심 기업을 추가하면 새 공시를 모아 보여 줘요.')).toBeTruthy()
    expect(listDisclosures).not.toHaveBeenCalled()
  })

  it('기업마다 최근 30일을 부르고 날짜순으로 합쳐 기업 이름·묶음·DART 새 창 링크와 함께 보인다', async () => {
    render(<FavoriteDisclosureFeed companies={[samsung, hynix]} />)
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    const section = screen.getByRole('region', { name: '관심 기업 새 공시' })
    const rows = await within(section).findAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('SK하이닉스'),
      expect.stringContaining('삼성전자'),
    ])
    expect(rows[0].textContent).toContain('지분')
    expect(rows[0].textContent).toContain('2026.10.24')
    const link = within(rows[0]).getByRole('link', { name: /주식등의대량보유상황보고서/ })
    expect(link.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261024000002')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(listDisclosures).toHaveBeenCalledWith(samsung.corpCode, expect.any(AbortSignal), 30)
    expect(listDisclosures).toHaveBeenCalledWith(hynix.corpCode, expect.any(AbortSignal), 30)
  })

  it('관심 기업은 앞의 10곳까지만 부르고 동시에 3곳씩만 부른다', async () => {
    const companies = Array.from({ length: 12 }, (_, i) => ({ corpCode: `0010000${String(i).padStart(2, '0')}`, corpName: `기업${i}` }))
    let running = 0
    let maxRunning = 0
    listDisclosures.mockImplementation(async (corpCode) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((r) => setTimeout(r, 1))
      running -= 1
      return list(corpCode, [])
    })
    render(<FavoriteDisclosureFeed companies={companies} />)
    await screen.findByText('최근 30일 공시가 없어요.')
    expect(listDisclosures).toHaveBeenCalledTimes(10)
    expect(maxRunning).toBe(3)
  })

  it('지난번에 본 날 이후 접수된 공시에만 새 공시를 붙이고, 다 받은 뒤 본 날을 오늘로 바꾼다', async () => {
    window.localStorage.setItem(FEED_SEEN_AT_KEY, '2026-10-22')
    render(<FavoriteDisclosureFeed companies={[samsung, hynix]} />)
    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]).queryByText('새 공시')).toBeTruthy()
    expect(within(rows[1]).queryByText('새 공시')).toBeNull()
    await waitFor(() => expect(window.localStorage.getItem(FEED_SEEN_AT_KEY)).not.toBe('2026-10-22'))
    expect(window.localStorage.getItem(FEED_SEEN_AT_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 본 날을 바꿔도 지금 보이는 표시는 그대로다
    expect(within(rows[0]).queryByText('새 공시')).toBeTruthy()
  })

  it('저장소를 쓸 수 없어도 피드는 보인다', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      render(<FavoriteDisclosureFeed companies={[samsung]} />)
      const rows = await screen.findAllByRole('listitem')
      expect(rows).toHaveLength(1)
      expect(screen.queryByText('새 공시')).toBeNull()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('한 기업이 실패해도 나머지는 보이고, 실패한 기업만 알려 다시 시도하면 그 기업만 다시 부른다', async () => {
    listDisclosures.mockImplementation((corpCode) =>
      corpCode === hynix.corpCode ? Promise.reject(new Error('network')) : Promise.resolve(list(corpCode, byCompany[corpCode])),
    )
    render(<FavoriteDisclosureFeed companies={[samsung, hynix]} />)
    const notice = await screen.findByText('일부 기업의 공시를 불러오지 못했어요.')
    expect(notice.parentElement?.textContent).toContain('불러오지 못한 기업: SK하이닉스')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    listDisclosures.mockClear()
    listDisclosures.mockImplementation((corpCode) => Promise.resolve(list(corpCode, byCompany[corpCode])))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    expect(listDisclosures).toHaveBeenCalledTimes(1)
    expect(listDisclosures).toHaveBeenCalledWith(hynix.corpCode, expect.any(AbortSignal), 30)
    expect(screen.queryByText('일부 기업의 공시를 불러오지 못했어요.')).toBeNull()
  })

  it('모든 기업이 실패하면 오류와 다시 시도를 보인다', async () => {
    listDisclosures.mockRejectedValue(new Error('network'))
    render(<FavoriteDisclosureFeed companies={[samsung]} />)
    expect((await screen.findByRole('alert')).textContent).toContain('불러오지 못한 기업: 삼성전자')
  })

  it('언마운트하면 진행 중인 요청을 취소한다', () => {
    listDisclosures.mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<FavoriteDisclosureFeed companies={[samsung]} />)
    const signal = listDisclosures.mock.calls[0][1]
    unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('공시 목록·불러오는 중·빈 안내에 접근성 위반이 없다', async () => {
    window.localStorage.setItem(FEED_SEEN_AT_KEY, '2026-10-22')
    const { container } = render(<FavoriteDisclosureFeed companies={[samsung, hynix]} />)
    expect(await axeViolations(container)).toBe('')
    await screen.findAllByRole('listitem')
    expect(await axeViolations(container)).toBe('')
    cleanup()
    const empty = render(<FavoriteDisclosureFeed companies={[]} />)
    expect(await axeViolations(empty.container)).toBe('')
  })
})
