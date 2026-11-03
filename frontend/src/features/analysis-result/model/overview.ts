import type { SjDiv, StatementSummary } from '@/shared/api/results'
import type { TextChangeList, TextSectionCount } from '@/shared/api/textChanges'

/**
 * 요약 탭 맨 위의 변화 개요(FS-4 R6). 값은 재무 수치·문장 변화 탭이 쓰는 같은 응답에서 센다.
 * 확인하지 못한 값은 null·unavailable로 두고 0으로 보이지 않는다.
 */

export interface FinancialOverview {
  /** 비교한 재무제표의 바뀐 계정 수 합. 비교한 재무제표가 없으면 null */
  changed: number | null
  /** 개요를 눌렀을 때 열 재무제표: 바뀐 계정이 있는 첫 비교 재무제표. 없으면 null(지금 고른 것 그대로) */
  firstChangedSjDiv: SjDiv | null
}

export function financialOverview(statements: StatementSummary[]): FinancialOverview {
  const comparable = statements.filter((s) => s.comparable)
  if (comparable.length === 0) return { changed: null, firstChangedSjDiv: null }
  return {
    changed: comparable.reduce((sum, s) => sum + s.changed, 0),
    firstChangedSjDiv: comparable.find((s) => s.changed > 0)?.sjDiv ?? null,
  }
}

export type TextOverview =
  | {
      status: 'available'
      all: number
      added: number
      deleted: number
      modified: number
      numericUpdate: number
      moved: number
      reviewNeeded: number
      /** 원문 일부를 읽지 못했을 수 있음(PARTIAL) */
      partial: boolean
      /** 변경이 있는 최상위 섹션과 건수(문서 순서). 같은 응답의 sections를 그대로 쓴다(#295) */
      sections: TextSectionCount[]
      /** 우선순위가 높음(HIGH)인 변경 수, 화면의 '먼저 볼 것'(FS-68 AC2). 받은 쪽으로 정확히 셀 수 없으면 null */
      high: number | null
    }
  /** 문장을 비교하지 않았거나(null) 비교하지 못함(FAILED). 변경이 없다는 뜻이 아니다 */
  | { status: 'unavailable' }

/** 개요가 우선순위 순으로 받는 변경 수. 목록 API의 size 최댓값(docs/api-spec.md) */
export const OVERVIEW_PRIORITY_PAGE_SIZE = 100

/**
 * 우선순위 순(sort=priority, 점수 큰 순·점수 없는 것은 맨 뒤)으로 받은 첫 쪽에서 높음(HIGH) 변경 수를 센다.
 * 높음은 점수 60 이상이라 이 순서에서 앞에 모여 있다. 첫 쪽이 전체를 담았거나 첫 쪽 마지막이 높음이 아니면 정확한 수이고,
 * 첫 쪽이 모두 높음인데 뒤에 더 있으면 셀 수 없어 null로 둔다(추측해 보이지 않는다).
 */
export function highPriorityCount(list: Pick<TextChangeList, 'totalItems' | 'items'>): number | null {
  const high = list.items.filter((item) => item.priority?.level === 'HIGH').length
  const complete = list.items.length >= list.totalItems
  const last = list.items.at(-1)
  if (complete || (last !== undefined && last.priority?.level !== 'HIGH')) return high
  return null
}

/** 거르기 없이 우선순위 순으로 받은 첫 쪽(useChangeOverview)으로 개요를 만든다 */
export function textOverview(
  list: Pick<TextChangeList, 'textStatus' | 'counts' | 'sections' | 'totalItems' | 'items'>,
): TextOverview {
  if (list.textStatus === null || list.textStatus === 'FAILED') return { status: 'unavailable' }
  const { all, added, deleted, modified, numericUpdate, moved, reviewNeeded } = list.counts
  return {
    status: 'available',
    all,
    added,
    deleted,
    modified,
    numericUpdate,
    moved,
    reviewNeeded,
    partial: list.textStatus === 'PARTIAL',
    sections: list.sections,
    high: highPriorityCount(list),
  }
}

const countFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 건수 표시. 확인하지 못한 값(null)은 '확인 안 됨' */
export function formatCount(value: number | null): string {
  return value === null ? '확인 안 됨' : countFormat.format(value)
}
