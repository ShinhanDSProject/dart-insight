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
    }
  /** 문장을 비교하지 않았거나(null) 비교하지 못함(FAILED). 변경이 없다는 뜻이 아니다 */
  | { status: 'unavailable' }

export function textOverview(list: Pick<TextChangeList, 'textStatus' | 'counts' | 'sections'>): TextOverview {
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
  }
}

const countFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 건수 표시. 확인하지 못한 값(null)은 '확인 안 됨' */
export function formatCount(value: number | null): string {
  return value === null ? '확인 안 됨' : countFormat.format(value)
}
