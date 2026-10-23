/** 작은 비교 시각화(CompareBars·ShareBar)의 위치·비율 계산. 화면 값은 응답 값을 그대로 쓰고 여기서는 길이만 정한다. */

export interface Span {
  /** 왼쪽 끝(%) */
  left: number
  /** 폭(%) */
  width: number
}

export interface CompareLayout {
  /** 0의 위치(%) */
  zero: number
  /** 값이 없으면 null(0으로 그리지 않음) */
  previous: Span | null
  current: Span | null
}

/**
 * 이전·현재 두 값을 0을 담은 한 축에 놓는다. 음수면 0의 왼쪽으로 그린다.
 * 두 값이 모두 없으면 null(그리지 않음).
 */
export function compareLayout(previous: number | null, current: number | null): CompareLayout | null {
  const values = [previous, current].filter((v): v is number => v !== null)
  if (values.length === 0) return null
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const position = (value: number) => (max === min ? 0 : ((value - min) / (max - min)) * 100)
  const zero = position(0)
  const span = (value: number | null): Span | null => {
    if (value === null) return null
    const end = position(value)
    return { left: Math.min(zero, end), width: Math.abs(end - zero) }
  }
  return { zero, previous: span(previous), current: span(current) }
}

/** 각 값이 합에서 차지하는 비율(%). 합이 0이면 모두 0 */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  return values.map((v) => (total === 0 ? 0 : (v / total) * 100))
}

/** 비율 표시: 25.4% / 0.3% / 0% */
export function formatShare(percent: number): string {
  if (percent === 0) return '0%'
  return `${Math.round(percent * 10) / 10}%`
}
