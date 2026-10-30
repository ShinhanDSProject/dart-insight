// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeDetail, FinancialChangeItem, FinancialChangeList } from '@/shared/api/results'
import type { LoadState } from '@/shared/hooks/asyncState'
import { EvidencePanel } from './EvidencePanel'
import { FinancialTab } from './FinancialTab'

// 재무 탭·근거 패널은 불러오는 훅만 바꿔 끼워 고정된 결과를 그린다(#480 크기 맥락)
const data = vi.hoisted(() => ({
  list: { status: 'loading' } as LoadState<FinancialChangeList>,
  detail: { status: 'loading' } as LoadState<FinancialChangeDetail>,
  order: [] as string[],
}))
vi.mock('../hooks/useFinancialChanges', () => ({
  useFinancialChanges: (_id: number, _sj: string, _changed: boolean, order: string) => {
    data.order.push(order)
    return { state: data.list, reload: () => {}, statements: data.list.status === 'success' ? data.list.data.statements : [] }
  },
  useFinancialChangeDetail: () => ({ state: data.detail, reload: () => {} }),
  useKeyNumbers: () => ({ state: { status: 'loading' }, reload: () => {} }),
}))
vi.mock('./AddToNote', () => ({ AddToNote: () => null }))

afterEach(cleanup)

const analysis = {
  analysisId: 7,
  corpName: '예시전자',
  fsDiv: 'CFS',
  previous: { rceptNo: '20250814000001', reportName: '반기보고서 (2025.06)', fiscalYear: 2025, periodEnd: '2025-06-30' },
  current: { rceptNo: '20260814000001', reportName: '반기보고서 (2026.06)', fiscalYear: 2026, periodEnd: '2026-06-30' },
} as Analysis

function item(changeId: number, accountName: string, changeAmount: number | null, scale: FinancialChangeItem['scale']): FinancialChangeItem {
  return {
    changeId,
    sjDiv: 'IS',
    accountName,
    accountDetail: null,
    amountBasis: 'CUMULATIVE',
    previousAmount: 1_000_000_000,
    currentAmount: changeAmount === null ? null : 1_000_000_000 + changeAmount,
    changeAmount,
    changeRate: changeAmount === null ? null : changeAmount / 1_000_000_000,
    direction: changeAmount === null ? null : changeAmount > 0 ? 'UP' : 'DOWN',
    calcStatus: changeAmount === null ? 'CURRENT_MISSING' : 'OK',
    calcMessage: null,
    currency: 'KRW',
    scale,
  }
}

function renderTab(order: 'document' | 'scale', onChange = vi.fn()) {
  data.list = {
    status: 'success',
    data: {
      analysisId: 7,
      fsDiv: 'CFS',
      sjDiv: 'IS',
      changedOnly: false,
      sort: order,
      statements: [{ sjDiv: 'IS', label: '손익계산서', comparable: true, amountBasis: 'CUMULATIVE', note: null, total: 3, changed: 3 }],
      items: [
        item(1, '매출액', 120_000_000, { base: 'REVENUE', baseAccountName: '매출액', baseAmount: 1_120_000_000, ratio: 0.107143, reason: null }),
        item(2, '이자비용', -5_000_000, { base: 'REVENUE', baseAccountName: null, baseAmount: null, ratio: null, reason: 'BASE_NOT_FOUND' }),
        item(3, '기타', null, { base: 'REVENUE', baseAccountName: '매출액', baseAmount: 1_120_000_000, ratio: null, reason: 'CHANGE_NOT_CALCULATED' }),
      ],
    },
  }
  render(
    <FinancialTab
      analysis={analysis}
      sjDiv="IS"
      changedOnly={false}
      unit="MILLION"
      accountQuery={null}
      order={order}
      selectedChangeId={null}
      onChange={onChange}
      onAsk={() => {}}
      asking={false}
    />,
  )
  return onChange
}

describe('재무 탭의 크기 맥락(#480)', () => {
  it('증감액 옆에 기준 계정 대비 비율을, 기준 값이 없으면 짧은 사유를 보조 줄로 보인다', () => {
    renderTab('document')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('매출액 대비 +10.7%')).toBeTruthy()
    expect(within(rows[2]).getByText('매출액 대비 · 매출액 확인 안 됨')).toBeTruthy()
    expect(within(rows[3]).queryByText(/대비/)).toBeNull()
  })

  it("정렬에서 '규모 큰 순'을 고르면 주소 값으로 넘기고, 고른 순서로 불러온다", () => {
    const onChange = renderTab('document')
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'scale' } })
    expect(onChange).toHaveBeenCalledWith({ order: 'scale' })

    cleanup()
    data.order = []
    renderTab('scale')
    expect((screen.getByLabelText('정렬') as HTMLSelectElement).value).toBe('scale')
    expect(data.order).toContain('scale')
  })
})

describe('재무 수치 탭 배치(#550)', () => {
  it('재무제표는 칩 세 개와 그 밖의 표 펼침으로 고르고, 고른 칩은 눌린 상태다', () => {
    const onChange = renderTab('document')
    const group = screen.getByRole('group', { name: '재무제표' })
    expect(within(group).getByRole('button', { name: '손익계산서' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(group).getByRole('button', { name: '재무상태표' }))
    expect(onChange).toHaveBeenCalledWith({ sj: 'BS' })

    const other = within(group).getByRole('button', { name: '그 밖의 표' })
    fireEvent.click(other)
    expect(other.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '자본변동표' }))
    expect(onChange).toHaveBeenCalledWith({ sj: 'SCE' })
    expect(other.getAttribute('aria-expanded')).toBe('false')
  })

  it("표 설정을 펼치면 보기·정렬·단위·CSV가 보이고, 오른쪽 글에 지금 단위와 정렬을 적는다", () => {
    renderTab('scale')
    expect(document.querySelector('.fin-bar__summary')?.textContent).toBe('단위 백만원 · 규모 큰 순')
    const toggle = screen.getByRole('button', { name: '표 설정' })
    expect(screen.queryByRole('button', { name: 'CSV 내려받기' })).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'CSV 내려받기' })).toBeTruthy()
  })

  it('표 머리는 계정·이전·지금·증감액·증감률이고 증감률 옆에 작은 막대를 둔다', () => {
    renderTab('document')
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(headers[2]).toMatch(/^지금 · /)
    expect(screen.getAllByRole('row')[1].querySelector('.fin-table__rate-bar')).toBeTruthy()
    expect(screen.getAllByRole('row')[3].querySelector('.fin-table__rate-bar')).toBeNull()
  })
})

describe('근거 상세의 크기 맥락(#480)', () => {
  function given(scale: FinancialChangeDetail['scale']) {
    data.detail = {
      status: 'success',
      data: {
        ...item(1, '판매비와관리비', 20_000_000_000_000, scale),
        sjDiv: 'IS',
        accountKey: 'dart_X',
        fsDiv: 'CFS',
        formula: '30,000,000,000,000(제 57 기 반기) − 10,000,000,000,000(제 56 기 반기) = 20,000,000,000,000',
        rateFormula: null,
        previous: null,
        current: null,
        scale,
        relatedTextChanges: [],
      },
    }
    render(<EvidencePanel analysis={analysis} changeId={1} unit="WON" onClose={() => {}} onAsk={() => {}} asking={false} />)
  }

  it('계산식(증감액 ÷ 기준 계정 현재 값)과 기준 계정 값의 근거를 보인다', () => {
    given({
      base: 'REVENUE',
      baseAccountName: '매출액',
      baseAmount: 152_000_000_000_000,
      ratio: 0.131579,
      reason: null,
      baseChangeId: 9,
      formula: '20,000,000,000,000 ÷ 152,000,000,000,000(제 57 기 반기) × 100 = 13.16%',
      baseSource: {
        rceptNo: '20260814000001',
        reportName: '반기보고서 (2026.06)',
        fiscalYear: 2026,
        periodEnd: '2026-06-30',
        periodName: '제 57 기 반기',
        sjDiv: 'IS',
        accountId: 'ifrs-full_Revenue',
        dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001',
        sectionNo: null,
        blockNo: null,
      },
    })
    const group = screen.getByRole('group', { name: '매출액 대비 크기' })
    expect(group.textContent).toContain(
      '매출액 대비 = 증감액 ÷ 매출액(현재 보고서) × 100 = 20,000,000,000,000 ÷ 152,000,000,000,000(제 57 기 반기) × 100 = 13.16%',
    )
    expect(group.textContent).toContain('기준 계정 매출액 152,000,000,000,000')
    expect(within(group).getByText('ifrs-full_Revenue')).toBeTruthy()
    expect(within(group).getByRole('link').getAttribute('href')).toContain('20260814000001')
  })

  it('기준 값이 0 이하면 계산식 없이 사유를 보인다', () => {
    given({
      base: 'TOTAL_EQUITY',
      baseAccountName: '자본총계',
      baseAmount: -5,
      ratio: null,
      reason: 'BASE_NOT_POSITIVE',
      baseChangeId: 9,
      formula: null,
      baseSource: null,
    })
    const group = screen.getByRole('group', { name: '자본총계 대비 크기' })
    expect(group.textContent).toContain('기준 계정(자본총계)의 현재 값이 0 이하라 비율을 계산하지 않았어요.')
  })
})
