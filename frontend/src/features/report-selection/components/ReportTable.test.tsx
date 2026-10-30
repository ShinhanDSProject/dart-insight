// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReportItem } from '@/shared/api/reports'
import { axeViolations } from '@/test/axe'
import { ReportTable } from './ReportTable'

function report(i: number): ReportItem {
  const year = 2025 - i
  const rceptNo = `${year + 1}0314${String(i).padStart(6, '0')}`
  return {
    rceptNo,
    reportName: `사업보고서 (${year}.12)`,
    reportType: 'ANNUAL',
    disclosureType: 'A001',
    fiscalYear: year,
    periodEnd: `${year}-12-31`,
    receivedAt: `${year + 1}-03-14`,
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

// 최근 보고서가 앞에 오는 12개
const items = Array.from({ length: 12 }, (_, i) => report(i))
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

afterEach(cleanup)

describe('정기보고서 표', () => {
  it('처음엔 최근 8개만 보이고 더 보기로 펼치고 접는다', () => {
    render(<ReportTable items={items} current={items[0]} previous={items[4]} onSelectCurrent={vi.fn()} />)
    expect(bodyRows()).toHaveLength(8)

    const more = screen.getByRole('button', { name: '더 보기 (4개)' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-controls')).toBe(screen.getByRole('table').id)

    fireEvent.click(more)
    expect(bodyRows()).toHaveLength(12)
    const fold = screen.getByRole('button', { name: '접기' })
    expect(fold.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(fold)
    expect(bodyRows()).toHaveLength(8)
  })

  it('접힌 범위에 있는 이전 보고서도 선택 칸에 이전 배지와 함께 보인다', () => {
    render(<ReportTable items={items} current={items[0]} previous={items[11]} onSelectCurrent={vi.fn()} />)
    expect(bodyRows()).toHaveLength(9)
    const last = bodyRows()[8]
    expect(within(last).getByRole('button', { name: items[11].reportName })).toBeTruthy()
    expect(within(last).getByText('이전')).toBeTruthy()
    expect(screen.getByRole('button', { name: '더 보기 (3개)' })).toBeTruthy()
  })

  it('접힌 범위에 있는 현재 보고서도 눌린 상태로 보인다', () => {
    render(<ReportTable items={items} current={items[10]} previous={null} onSelectCurrent={vi.fn()} />)
    expect(screen.getByRole('button', { name: items[10].reportName }).getAttribute('aria-pressed')).toBe('true')
  })

  it('선택 칸에 현재·이전 배지와 고르지 않은 보고서의 미선택을 보인다', () => {
    render(<ReportTable items={items.slice(0, 3)} current={items[0]} previous={items[1]} onSelectCurrent={vi.fn()} />)
    const [first, second, third] = bodyRows()
    expect(within(first).getByText('현재')).toBeTruthy()
    expect(within(second).getByText('이전')).toBeTruthy()
    expect(within(third).getByText('미선택')).toBeTruthy()
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: '선택' })).toBeTruthy()
  })

  it('8개 이하면 더 보기 버튼을 두지 않는다', () => {
    render(<ReportTable items={items.slice(0, 8)} current={items[0]} previous={null} onSelectCurrent={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it('접힌 표에 접근성 위반이 없다', async () => {
    const { container } = render(
      <ReportTable items={items} current={items[0]} previous={items[4]} onSelectCurrent={vi.fn()} />,
    )
    expect(await axeViolations(container)).toBe('')
  })
})
