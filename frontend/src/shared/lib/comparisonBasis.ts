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
