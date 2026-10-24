import type { TextSectionCount } from '@/shared/api/textChanges'
import { displaySectionTitle } from '@/shared/lib/sectionTitle'

/** 섹션별 문장 변경 막대에 그리는 섹션 수(#295) */
export const SECTION_BAR_LIMIT = 8

export interface SectionBar {
  /** 원래 섹션 제목. 문장 탭 거르기(tsec)에 그대로 쓴다 */
  title: string
  /** 화면 표시 이름(displaySectionTitle) */
  label: string
  count: number
  /** 막대 길이(0~100%). 가장 많은 섹션이 100 */
  width: number
}

export interface SectionBars {
  /** 건수가 많은 순. 같으면 문서 순서 */
  bars: SectionBar[]
  /** 상위 개수에 들지 못해 묶은 섹션 수와 그 건수 합 */
  restSections: number
  restCount: number
}

/**
 * 요약 탭 '섹션별 문장 변경' 막대(#295). 응답의 섹션 건수를 정렬·고르기만 하고 새 숫자를 만들지 않는다(ADR-0018).
 * 건수 0인 섹션은 빼고, 상위 limit개 밖은 '그 밖 N개 섹션'으로 묶는다.
 */
export function sectionBars(sections: TextSectionCount[], limit = SECTION_BAR_LIMIT): SectionBars {
  const ranked = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.count > 0)
    .sort((a, b) => b.section.count - a.section.count || a.index - b.index)
    .map(({ section }) => section)
  const shown = ranked.slice(0, limit)
  const rest = ranked.slice(limit)
  const max = shown[0]?.count ?? 0
  return {
    bars: shown.map((s) => ({ title: s.title, label: displaySectionTitle(s.title), count: s.count, width: (s.count / max) * 100 })),
    restSections: rest.length,
    restCount: rest.reduce((sum, s) => sum + s.count, 0),
  }
}
