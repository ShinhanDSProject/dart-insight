import type { TextSectionCount } from '@/shared/api/textChanges'

/**
 * 원문 확인 목차의 '변경 N' 배지(#313)에 쓰는 최상위 섹션별 문장 변경 건수. 키는 응답의 원래 섹션 제목 그대로이고
 * 표시 이름(displaySectionTitle)으로 바꾸지 않는다. 건수 0인 섹션은 넣지 않는다.
 * 응답의 건수를 옮기기만 하고, 같은 제목이 두 번 오면 더한다.
 */
export function sectionChangeCounts(sections: TextSectionCount[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { title, count } of sections) {
    if (count > 0) counts.set(title, (counts.get(title) ?? 0) + count)
  }
  return counts
}
