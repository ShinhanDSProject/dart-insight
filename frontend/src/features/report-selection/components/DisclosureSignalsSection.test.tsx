// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type {
  DisclosureSignalItem,
  DisclosureSignalKind,
  DisclosureSignalKindCount,
  DisclosureSignals,
} from '@/shared/api/disclosureSignals'
import { axeViolations } from '@/test/axe'
import { DisclosureSignalsSection } from './DisclosureSignalsSection'

const getDisclosureSignals = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<DisclosureSignals>>()

vi.mock('@/shared/api/disclosureSignals', () => ({
  getDisclosureSignals: (corpCode: string, signal?: AbortSignal) => getDisclosureSignals(corpCode, signal),
}))

const labels: Record<DisclosureSignalKind, string> = {
  LARGEST_SHAREHOLDER_CHANGE: '최대주주 변경',
  CAPITAL_INCREASE: '유상증자 결정',
  CONVERTIBLE_BOND: '전환사채 발행 결정',
  BOND_WITH_WARRANT: '신주인수권부사채 발행 결정',
  LITIGATION: '소송 등 제기',
  REHABILITATION_LISTING: '회생·상장 관련 공시',
  AUDITOR_CHANGE: '감사인 변경',
  NON_CLEAN_AUDIT_OPINION: '감사의견(적정이 아님)',
}

function kinds(
  counts: Partial<Record<DisclosureSignalKind, number | null>> = {},
): DisclosureSignalKindCount[] {
  return (Object.keys(labels) as DisclosureSignalKind[]).map((kind) => {
    const count = kind in counts ? (counts[kind] ?? null) : 0
    return { kind, label: labels[kind], status: count === null ? 'UNAVAILABLE' : 'CHECKED', count }
  })
}

function item(kind: DisclosureSignalKind, rceptNo: string, reportName: string, sentence: string): DisclosureSignalItem {
  return {
    kind,
    rceptNo,
    reportName,
    receivedDate: '2026-10-20',
    sentence,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function signals(overrides: Partial<DisclosureSignals> = {}): DisclosureSignals {
  return { corpCode: '00000001', from: '2025-10-27', to: '2026-10-27', kinds: kinds(), items: [], ...overrides }
}

beforeEach(() => {
  getDisclosureSignals.mockReset()
})

afterEach(cleanup)

describe('DisclosureSignalsSection', () => {
  it('해당 공시를 종류·사실 문장·원문 링크와 함께 보여 주고 종류별 건수를 적는다', async () => {
    getDisclosureSignals.mockResolvedValue(
      signals({
        kinds: kinds({ LARGEST_SHAREHOLDER_CHANGE: 1 }),
        items: [item('LARGEST_SHAREHOLDER_CHANGE', '20261020900001', '최대주주변경', '최대주주가 바뀌었다고 공시했어요.')],
      }),
    )
    const { container } = render(<DisclosureSignalsSection corpCode="00000001" />)

    expect(await screen.findByText('최대주주가 바뀌었다고 공시했어요.')).toBeTruthy()
    const link = screen.getByRole('link', { name: /최대주주변경/ })
    expect(link.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261020900001')
    const counts = screen.getByRole('list', { name: '종류별 건수' })
    expect(within(counts).getAllByRole('listitem')).toHaveLength(8)
    expect(within(counts).getByText('최대주주 변경').parentElement?.textContent).toContain('1건')
    expect(container.textContent).not.toMatch(/위험|점수|등급/)
    expect(getDisclosureSignals).toHaveBeenCalledWith('00000001', expect.any(AbortSignal))
    expect(await axeViolations(container)).toBe('')
  })

  it('해당 공시가 없으면 확인한 기간·종류와 함께 없다고 알려 준다', async () => {
    getDisclosureSignals.mockResolvedValue(signals())
    const { container } = render(<DisclosureSignalsSection corpCode="00000001" />)

    expect(await screen.findByText('해당 공시가 없어요')).toBeTruthy()
    expect(container.textContent).toContain('2025.10.27')
    expect(screen.getByText('감사의견(적정이 아님)')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('받지 못한 종류만 확인하지 못했다고 하고 다시 시도하면 다시 불러온다', async () => {
    getDisclosureSignals.mockResolvedValueOnce(signals({ kinds: kinds({ AUDITOR_CHANGE: null, NON_CLEAN_AUDIT_OPINION: null }) }))
    getDisclosureSignals.mockResolvedValueOnce(signals())
    const { container } = render(<DisclosureSignalsSection corpCode="00000001" />)

    expect(await screen.findByText('확인한 종류에는 해당 공시가 없어요')).toBeTruthy()
    expect(screen.queryByText('해당 공시가 없어요')).toBeNull()
    const counts = screen.getByRole('list', { name: '종류별 건수' })
    expect(within(counts).getAllByText(/확인하지 못했어요/)).toHaveLength(2)
    expect(within(counts).getByText('최대주주 변경').parentElement?.textContent).toContain('0건')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '다시 시도(감사인 변경)' }))
    expect(await screen.findByText('해당 공시가 없어요')).toBeTruthy()
    expect(getDisclosureSignals).toHaveBeenCalledTimes(2)
  })

  it('불러오지 못하면 오류와 다시 시도를 보여 준다', async () => {
    getDisclosureSignals.mockRejectedValue(new ApiError(404, { code: 'COMPANY_NOT_FOUND', message: '없는 기업', traceId: 'trace-1', errors: [] }))
    render(<DisclosureSignalsSection corpCode="00000001" />)

    expect(await screen.findByText('없는 기업이에요. 검색에서 다시 골라 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })
})
