import { match } from 'ts-pattern'
import type { ComparisonBasis } from '@/shared/api/reports'

/** 기본 비교 기준. 결정 로그 '기본 비교 기준'이 정해지기 전까지 전년 동기(잠정안). */
export const DEFAULT_BASIS: ComparisonBasis = 'YOY'

export const basisOptions: { value: ComparisonBasis; label: string }[] = [
  { value: 'YOY', label: '전년 동기' },
  { value: 'PREV', label: '직전 기간' },
  { value: 'CUSTOM', label: '직접 선택' },
]

export function parseBasis(value: string | null): ComparisonBasis {
  return value === 'YOY' || value === 'PREV' || value === 'CUSTOM' ? value : DEFAULT_BASIS
}

export function basisLabel(basis: ComparisonBasis): string {
  return basisOptions.find((o) => o.value === basis)?.label ?? basis
}

/** 비교 기준 아래의 안내. 직전 기간은 docs/api-spec.md '비교 보고서 찾기'의 짝(잠정안)을 따른다 */
export function basisHint(basis: ComparisonBasis): string {
  return match(basis)
    .with('YOY', () => '전년 동기는 작년 같은 기간 보고서와 비교해요. 계절에 따른 차이를 덜 받아요.')
    .with('PREV', () => '직전 기간은 바로 앞 정기보고서와 비교해요(예: 반기 ← 1분기, 1분기 ← 전년 사업보고서).')
    .with('CUSTOM', () => '직접 선택은 비교할 이전 보고서를 목록에서 골라요.')
    .exhaustive()
}
