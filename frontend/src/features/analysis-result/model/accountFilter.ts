import type { FinancialChangeItem } from '@/shared/api/results'

/** 재무 표 계정 찾기(FS-14). 받아 둔 계정을 화면에서 거르므로 서버에 보내지 않는다. */

export const ACCOUNT_SEARCH_MAX_LENGTH = 50
/** 입력을 멈추고 이만큼 지나면 거른다(ms) */
export const ACCOUNT_SEARCH_DEBOUNCE_MS = 200

/** 비교용 글. 공백을 모두 지우고 소문자로 바꾼다('단기 차입금'과 '단기차입금'을 같게 본다) */
function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

/** 주소에 남길 검색어. 앞뒤 공백을 지우고 길이를 자른다. 공백뿐이면 null(거르지 않음) */
export function accountQueryOf(input: string): string | null {
  const q = input.trim().slice(0, ACCOUNT_SEARCH_MAX_LENGTH)
  return normalize(q).length === 0 ? null : q
}

/** 계정 이름에 검색어가 들어 있는 계정만 남긴다. 공백·대소문자는 무시하고, 순서는 그대로 둔다 */
export function filterAccounts<T extends Pick<FinancialChangeItem, 'accountName'>>(items: T[], query: string | null): T[] {
  const needle = query === null ? '' : normalize(query)
  if (needle.length === 0) return items
  return items.filter((item) => normalize(item.accountName).includes(needle))
}

export function foundAccountsLabel(count: number): string {
  return `찾은 계정 ${count}개`
}
