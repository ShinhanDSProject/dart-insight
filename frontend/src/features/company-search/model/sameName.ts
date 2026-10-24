import type { Company } from '@/shared/api/companies'

/** 검색 결과에서 이름이 같은 회사 수(이름 → 개수). 2곳 이상인 이름만 담는다 */
export function sameNameCounts(items: Company[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.corpName, (counts.get(item.corpName) ?? 0) + 1)
  for (const [name, count] of counts) if (count < 2) counts.delete(name)
  return counts
}
