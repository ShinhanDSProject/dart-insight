// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import type { KeyNumber } from '../model/keyNumbers'
import { KeyNumbers } from './KeyNumbers'

const data = vi.hoisted(() => ({ state: { status: 'loading' } as LoadState<KeyNumber[]> }))
vi.mock('../hooks/useFinancialChanges', () => ({
  useKeyNumbers: () => ({ state: data.state, reload: () => {} }),
}))

afterEach(cleanup)

function item(changeId: number, accountName: string, previous: number | null, current: number | null): FinancialChangeItem {
  const change = previous === null || current === null ? null : current - previous
  return {
    changeId,
    sjDiv: 'IS',
    accountName,
    accountDetail: null,
    amountBasis: 'CUMULATIVE',
    previousAmount: previous,
    currentAmount: current,
    changeAmount: change,
    changeRate: change === null || previous === null ? null : change / previous,
    direction: change === null ? null : change > 0 ? 'UP' : 'DOWN',
    calcStatus: previous === null ? 'PREVIOUS_MISSING' : 'OK',
    calcMessage: null,
    currency: 'KRW',
    scale: { base: 'REVENUE', baseAccountName: null, baseAmount: null, ratio: null, reason: null },
  }
}

const revenue = item(1, '매출액', 153_700_000_000_000, 305_400_000_000_000)

function renderNumbers(onOpen = vi.fn()) {
  data.state = {
    status: 'success',
    data: [
      { key: 'REVENUE', label: '매출액', item: revenue },
      { key: 'OPERATING_INCOME', label: '영업이익', item: item(2, '영업이익', null, 1_000) },
      { key: 'NET_INCOME', label: '순이익', item: null },
      { key: 'TOTAL_ASSETS', label: '자산총계', item: null },
      { key: 'OPERATING_CASH_FLOW', label: '영업활동현금흐름', item: null },
    ],
  }
  const view = render(<KeyNumbers analysisId={7} onOpen={onOpen} />)
  return { onOpen, ...view }
}

describe('핵심 숫자(#550)', () => {
  it('다섯 칸에 큰 현재 값, 이전 값, ▲와 부호가 붙은 증감률을 보인다', () => {
    renderNumbers()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(5)
    const first = within(cards[0])
    expect(first.getByText('매출액')).toBeTruthy()
    expect(first.getByText('이전 153.7조')).toBeTruthy()
    expect(cards[0].querySelector('.stat-number__change')?.textContent).toContain('(+98.7%)')
    expect(cards[0].querySelector('.stat-number__change')?.textContent).toContain('▲')
  })

  it('이전 값이 없으면 사유를, 계정을 찾지 못한 칸은 0이 아니라 자료 없음을 보인다', () => {
    renderNumbers()
    const cards = screen.getAllByRole('listitem')
    expect(cards[1].textContent).toContain('이전 미기재')
    expect(within(cards[2]).getByText('자료 없음')).toBeTruthy()
    expect(within(cards[2]).queryByRole('button')).toBeNull()
  })

  it('근거 보기를 누르면 그 계정으로 근거를 연다', () => {
    const { onOpen } = renderNumbers()
    fireEvent.click(screen.getByRole('button', { name: '매출액 근거 보기' }))
    expect(onOpen).toHaveBeenCalledWith(revenue)
  })

  it('접근성 위반이 없다', async () => {
    const { container } = renderNumbers()
    expect(await axeViolations(container)).toBe('')
  })
})
