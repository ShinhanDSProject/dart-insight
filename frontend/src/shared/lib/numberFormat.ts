const integerFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 글자 수·건수 같은 정수 표시: 1,234 (NM-2) */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}
