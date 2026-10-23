import { describe, expect, it } from 'vitest'
import type { ReportItem } from '@/shared/api/reports'
import {
  basisChanges,
  currentChanges,
  customCandidates,
  findPrevious,
  lookupFor,
  pairKey,
  reportOptionLabel,
  type PairLookup,
} from './pairSelection'

function report(rceptNo: string, periodEnd: string, reportName = '반기보고서'): ReportItem {
  return {
    rceptNo,
    reportName,
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: Number(periodEnd.slice(0, 4)),
    periodEnd,
    receivedAt: '2026-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'UNKNOWN',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

describe('pairSelection', () => {
  it('직접 선택은 현재 보고서보다 앞선 기간의 보고서만 고를 수 있다', () => {
    const items = [
      report('20260814000001', '2026-06-30'),
      report('20260515000001', '2026-03-31'),
      report('20250814000001', '2025-06-30'),
    ]
    expect(customCandidates(items, items[1]).map((r) => r.rceptNo)).toEqual(['20250814000001'])
    expect(customCandidates(items, items[0]).map((r) => r.rceptNo)).toEqual(['20260515000001', '20250814000001'])
    expect(customCandidates(items, null)).toEqual([])
  })

  it('고르는 목록에는 제출일을 함께 보여 준다', () => {
    expect(reportOptionLabel(report('20260814000001', '2026-06-30', '반기보고서 (2026.06)'))).toBe(
      '반기보고서 (2026.06) · 제출 2026.08.14',
    )
  })
})

describe('비교 보고서 찾기', () => {
  const items = [
    report('20260814000001', '2026-06-30'),
    report('20260515000001', '2026-03-31'),
    report('20250814000001', '2025-06-30'),
  ]

  it('다른 기준·현재 보고서로 찾은 결과는 불러오는 중으로 본다', () => {
    const lookup: PairLookup = { status: 'success', data: { key: pairKey('YOY', 'a'), previous: null, reason: null } }
    expect(lookupFor(lookup, pairKey('PREV', 'a'))).toEqual({ status: 'loading' })
    expect(lookupFor(lookup, pairKey('YOY', 'a'))).toBe(lookup)
  })

  it('비교 기준으로 찾은 보고서는 목록에 있는 같은 보고서로 바꿔 쓴다', () => {
    const found = { ...items[2], reportName: '다른 이름' }
    const lookup: PairLookup = { status: 'success', data: { key: 'k', previous: found, reason: null } }
    expect(findPrevious(items, items[0], 'YOY', lookup, null)).toBe(items[2])
  })

  it('찾는 중·실패·없음이면 비교 보고서가 없다', () => {
    expect(findPrevious(items, items[0], 'YOY', { status: 'loading' }, null)).toBeNull()
    expect(findPrevious(items, items[0], 'YOY', { status: 'error', error: new Error('x') }, null)).toBeNull()
    const none: PairLookup = { status: 'success', data: { key: 'k', previous: null, reason: '없음' } }
    expect(findPrevious(items, items[0], 'YOY', none, null)).toBeNull()
  })

  it('직접 선택이면 주소의 접수번호가 앞선 기간일 때만 쓴다', () => {
    expect(findPrevious(items, items[1], 'CUSTOM', { status: 'idle' }, '20250814000001')).toBe(items[2])
    expect(findPrevious(items, items[1], 'CUSTOM', { status: 'idle' }, '20260814000001')).toBeNull()
  })

  it('현재 보고서를 바꾸면 직접 고른 비교 보고서는 여전히 앞설 때만 남긴다', () => {
    expect(currentChanges(items, '20260814000001', 'CUSTOM', items[2])).toEqual({
      current: '20260814000001',
      previous: '20250814000001',
    })
    expect(currentChanges(items, '20250814000001', 'CUSTOM', items[2])).toEqual({ current: '20250814000001', previous: null })
    expect(currentChanges(items, '20260814000001', 'YOY', items[2])).toEqual({ current: '20260814000001', previous: null })
  })

  it('같은 비교 기준을 다시 누르면 주소를 바꾸지 않는다', () => {
    expect(basisChanges('CUSTOM', 'CUSTOM')).toBeNull()
    expect(basisChanges('YOY', 'PREV')).toEqual({ basis: 'PREV', previous: null })
  })
})
