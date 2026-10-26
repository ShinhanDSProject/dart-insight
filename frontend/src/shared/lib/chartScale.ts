/**
 * 라이브러리 없이 그리는 차트(ADR-0018)의 축·위치 계산과 눈금 문구. 응답 값으로 축만 정하고 새 숫자를 만들지 않는다.
 */

export interface Scale {
  min: number
  max: number
  ticks: number[]
}

/** 1·2·5 × 10^n 중 rough 이상인 가장 작은 눈금 간격 */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/**
 * 값들과 0을 함께 담는 축. 축 끝은 눈금 간격에 맞춰 넓힌다(막대는 늘 0에서 시작).
 * 값이 모두 0이면 [0, 1]로 둔다.
 */
export function niceScale(values: number[], tickCount = 4): Scale {
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  if (low === high) return { min: 0, max: 1, ticks: [0, 1] }
  const step = niceStep((high - low) / tickCount)
  const min = Math.floor(low / step) * step
  const max = Math.ceil(high / step) * step
  const ticks: number[] = []
  // 소수 눈금(증감률)의 부동소수 오차를 없애려고 간격의 자릿수로 반올림한다
  const digits = Math.max(0, -Math.floor(Math.log10(step)))
  for (let i = 0; min + i * step <= max + step / 2; i++) {
    ticks.push(Number((min + i * step).toFixed(digits)))
  }
  return { min, max, ticks }
}

/** 축 위치(0~100%) */
export function position(scale: Scale, value: number): number {
  return ((value - scale.min) / (scale.max - scale.min)) * 100
}

/** 0에서 값까지 막대의 왼쪽 끝과 폭(%) */
export function barSpan(scale: Scale, value: number): { left: number; width: number } {
  const zero = position(scale, 0)
  const end = position(scale, value)
  return { left: Math.min(zero, end), width: Math.abs(end - zero) }
}

const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })

/** 축 눈금용 짧은 금액(예: 759.5조, 3,717억). 원화가 아니면 통화 코드를 붙인다 */
export function formatCompactAmount(value: number, currency: string | null): string {
  const text = compactFormat.format(Math.abs(value))
  const sign = value < 0 ? '−' : ''
  return currency && currency !== 'KRW' ? `${sign}${text} ${currency}` : `${sign}${text}`
}
