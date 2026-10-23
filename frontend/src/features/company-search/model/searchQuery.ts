export const MIN_QUERY_LENGTH = 2

/** 검색어를 검사한다. 문제가 없으면 null, 있으면 안내 문장. */
export function validateSearchQuery(raw: string): string | null {
  const query = raw.trim()
  if (query.length === 0) {
    return '회사명이나 종목코드를 입력해 주세요.'
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return `${MIN_QUERY_LENGTH}자 이상 입력해 주세요.`
  }
  return null
}
