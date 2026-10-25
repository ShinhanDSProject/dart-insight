/**
 * '숫자만 바뀜' 카드의 바뀐 숫자 쌍(3.3, #303). 이전·현재 미리보기에서 숫자를 순서대로 뽑아 같은 위치끼리 짝짓는다.
 * 원문 글자를 그대로 옮기고 새 숫자를 계산하지 않는다(ADR-0018).
 * 짝이 확실하지 않으면(한쪽이 없음, 미리보기가 잘림, 숫자 개수가 다름) null을 돌려 줄을 숨긴다.
 */
export interface NumberPair {
  before: string
  after: string
}

export interface NumberChanges {
  pairs: NumberPair[]
  /** 보이지 않은 나머지 쌍 수 */
  rest: number
}

const ELLIPSIS = '…'

// 숫자 바로 뒤에 붙은 단위(한 낱말). 긴 것부터 둬서 '개월'이 '개'보다 먼저 맞게 한다. 뒤의 조사는 붙이지 않는다
const UNITS = [
  '백만원', '십억원', '천만원', '개월', '개사', '주년', '천원', '만원', '억원', '조원',
  '%p', '%', '‰', 'bp',
  '개', '명', '원', '년', '월', '일', '건', '주', '배', '회', '곳', '호', '억', '조', '만', '천', '세', '시', '분', '대', '톤', '차',
]

const DIGITS = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`
const UNIT = `(?:${UNITS.join('|')})?`
// 회계식 음수 (1,234), 기호 붙은 수 △1,234·-3.5, 그냥 수. 기호는 앞이 글자·숫자가 아닐 때만 부호로 본다
const NUMBER = new RegExp(String.raw`(?:\(${DIGITS}\)|(?<![\p{L}\p{N}])[△▲▼+\-−]${DIGITS}|${DIGITS})${UNIT}`, 'gu')

/** 글에 나온 숫자(단위 포함)를 나온 순서대로, 원문 글자 그대로 */
export function numberTokens(text: string): string[] {
  return text.match(NUMBER) ?? []
}

function truncated(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith(ELLIPSIS) || trimmed.endsWith(ELLIPSIS)
}

export function numberChanges(previous: string | null, current: string | null, max = 5): NumberChanges | null {
  if (previous === null || current === null) return null
  if (truncated(previous) || truncated(current)) return null
  const before = numberTokens(previous)
  const after = numberTokens(current)
  if (before.length !== after.length) return null
  const changed = before.flatMap((b, i) => (b === after[i] ? [] : [{ before: b, after: after[i] }]))
  if (changed.length === 0) return null
  return { pairs: changed.slice(0, max), rest: Math.max(0, changed.length - max) }
}
