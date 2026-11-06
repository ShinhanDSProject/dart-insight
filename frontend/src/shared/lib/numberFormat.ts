const integerFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

/** 글자 수·건수 같은 정수 표시: 1,234 (NM-2) */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}

/** API가 준 값을 그대로 보일 때: 정수는 1,234, 소수는 둘째 자리까지 12.35 (NM-2) */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value)
}

/** 초를 '48초', '2분 11초', '1시간 3분'으로. null이면 '—' */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}초`
  if (s < 3600) {
    const rest = s % 60
    return rest === 0 ? `${Math.floor(s / 60)}분` : `${Math.floor(s / 60)}분 ${rest}초`
  }
  const minutes = Math.floor((s % 3600) / 60)
  return minutes === 0 ? `${Math.floor(s / 3600)}시간` : `${Math.floor(s / 3600)}시간 ${minutes}분`
}

/** 0~1 비율을 '92.5%'로. null(분모 0)은 '—' */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${(Math.round(rate * 1000) / 10).toFixed(1)}%`
}

/** USD 추정 비용을 '$1.83'으로. 1센트 미만은 '<$0.01', null은 '—' */
export function formatUsd(usd: number | null): string {
  if (usd === null) return '—'
  if (usd > 0 && usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}
