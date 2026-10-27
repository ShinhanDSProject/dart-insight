/** 기업 고르기 칸의 검색어 규칙(첫 화면 검색과 같은 2자 이상) */
export const MIN_LOOKUP_LENGTH = 2

export function isLookupQuery(query: string): boolean {
  return query.trim().length >= MIN_LOOKUP_LENGTH
}

/** 검색 결과에서 보여 줄 수(작은 칸이라 앞에서부터만) */
export const LOOKUP_LIMIT = 8
