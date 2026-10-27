/** 기업 고르기 칸의 검색어 규칙(첫 화면 검색과 같은 2자 이상) */
export const MIN_LOOKUP_LENGTH = 2

export function isLookupQuery(query: string): boolean {
  return query.trim().length >= MIN_LOOKUP_LENGTH
}

/** 검색 결과에서 보여 줄 수(작은 칸이라 앞에서부터만) */
export const LOOKUP_LIMIT = 8

/** 검색 결과에서 키를 눌렀을 때 옮겨 갈 곳: 결과 순번, 입력칸, 또는 그대로(null) */
export type ResultFocus = number | 'input' | null

/**
 * 검색 결과의 '더하기' 버튼 사이를 키보드로 옮기는 규칙(#426). 첫 화면 검색과 같이 ↓는 다음, ↑는 이전,
 * 첫 결과에서 ↑는 입력칸, Home·End는 처음·끝이다. 마지막에서 ↓는 그대로 둔다. current가 null이면 입력칸에 있는 것.
 */
export function nextResultFocus(current: number | null, key: string, count: number): ResultFocus {
  if (count === 0) return null
  if (current === null) return key === 'ArrowDown' ? 0 : null
  switch (key) {
    case 'ArrowDown':
      return current < count - 1 ? current + 1 : null
    case 'ArrowUp':
      return current > 0 ? current - 1 : 'input'
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
