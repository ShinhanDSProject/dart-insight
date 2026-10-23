import { match, P } from 'ts-pattern'
import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { formatDate } from '@/shared/lib/reportLabels'
import type { ParamChanges } from '@/shared/lib/searchParams'

/** 직접 선택할 수 있는 이전 보고서: 현재 보고서보다 대상 기간이 앞선 보고서 */
export function customCandidates(items: ReportItem[], current: ReportItem | null): ReportItem[] {
  if (current === null) return []
  return items.filter((r) => r.rceptNo !== current.rceptNo && r.periodEnd < current.periodEnd)
}

/** 고르는 목록에 보이는 문구. 같은 이름의 보고서를 제출일로 구분한다. */
export function reportOptionLabel(report: ReportItem): string {
  return `${report.reportName} · 제출 ${formatDate(report.receivedAt)}`
}

/** 비교 기준으로 찾은 비교 보고서. key는 찾을 때 쓴 '기준:현재 접수번호' */
export interface PairFound {
  key: string
  previous: ReportItem | null
  reason: string | null
}

export type PairLookup = AsyncState<PairFound>

export function pairKey(basis: ComparisonBasis, currentNo: string | null): string {
  return `${basis}:${currentNo}`
}

/** 다른 기준·현재 보고서로 찾은 결과는 쓰지 않는다(새로 찾는 동안 잠깐 남아 있을 수 있음) */
export function lookupFor(lookup: PairLookup, key: string): PairLookup {
  return lookup.status === 'success' && lookup.data.key !== key ? { status: 'loading' } : lookup
}

/** 비교 보고서. 직접 선택이면 주소의 접수번호(customNo), 아니면 비교 기준으로 찾은 보고서 */
export function findPrevious(
  items: ReportItem[],
  current: ReportItem | null,
  basis: ComparisonBasis,
  lookup: PairLookup,
  customNo: string | null,
): ReportItem | null {
  if (basis === 'CUSTOM') {
    return customCandidates(items, current).find((r) => r.rceptNo === customNo) ?? null
  }
  return match(lookup)
    .with({ status: 'success', data: { previous: P.nonNullable } }, ({ data }) => {
      const found = data.previous
      return items.find((r) => r.rceptNo === found.rceptNo) ?? found
    })
    .with({ status: P.union('idle', 'loading', 'error', 'success') }, () => null)
    .exhaustive()
}

/** 현재 보고서를 바꿀 때 주소에 쓸 값. 직접 고른 비교 보고서가 새 현재 보고서보다 앞서지 않으면 비운다 */
export function currentChanges(
  items: ReportItem[],
  rceptNo: string,
  basis: ComparisonBasis,
  previous: ReportItem | null,
): ParamChanges {
  const nextCurrent = items.find((r) => r.rceptNo === rceptNo) ?? null
  const keepPrevious = previous !== null && customCandidates(items, nextCurrent).includes(previous)
  return { current: rceptNo, previous: basis === 'CUSTOM' && keepPrevious ? previous.rceptNo : null }
}

/**
 * 비교 기준을 바꿀 때 주소에 쓸 값. 현재 보고서는 그대로 두고 비교 보고서만 비운다.
 * 이미 고른 기준을 다시 누르면 직접 고른 비교 보고서를 지우지 않도록 null(바꾸지 않음)
 */
export function basisChanges(basis: ComparisonBasis, nextBasis: ComparisonBasis): ParamChanges | null {
  return nextBasis === basis ? null : { basis: nextBasis, previous: null }
}
