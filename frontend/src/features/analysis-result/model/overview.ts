import type { SjDiv, StatementSummary } from '@/shared/api/results'
import type { ChangeType, TextChangeList, TextSectionCount } from '@/shared/api/textChanges'
import type { ShareSegment, ShareTone } from '@/shared/ui/ShareBar'
import { changeTypeLabel } from './textLabels'

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

type SharedKey = 'added' | 'modified' | 'deleted' | 'numericUpdate' | 'moved'

/** 비율 막대에 그리는 유형과 순서. 숫자만 바뀜·위치 이동은 '내용은 그대로'인 변경이라 중립색 하나를 함께 쓴다 */
const SHARE_SLOTS: { key: SharedKey; type: ChangeType; tone: ShareTone; hideZero: boolean }[] = [
  { key: 'added', type: 'ADDED', tone: 'added', hideZero: false },
  { key: 'modified', type: 'MODIFIED', tone: 'modified', hideZero: false },
  { key: 'deleted', type: 'DELETED', tone: 'deleted', hideZero: false },
  { key: 'numericUpdate', type: 'NUMERIC_UPDATE', tone: 'neutral', hideZero: true },
  { key: 'moved', type: 'MOVED', tone: 'neutral', hideZero: true },
]

/**
 * '문장 변경' 카드의 구성 비율 막대 조각(#297). 분모는 짝지은 변경 전부(all − reviewNeeded)이고, 조각 비율의 합은 100%다.
 * 검토 필요(짝짓지 못함)는 옆 카드에 따로 세므로 막대에 넣지 않는다.
 * 숫자만 바뀜·위치 이동은 0이면 막대와 범례에서 뺀다: 옛 결과(m2-8까지, 두 건수 0)는 전과 같은 추가·수정·삭제 세 칸이다.
 */
export function textShareSegments(t: Pick<Extract<TextOverview, { status: 'available' }>, SharedKey>): ShareSegment[] {
  return SHARE_SLOTS.filter((slot) => !(slot.hideZero && t[slot.key] === 0)).map((slot) => ({
    label: changeTypeLabel(slot.type),
    value: t[slot.key],
    text: formatCount(t[slot.key]),
    tone: slot.tone,
  }))
}

const countFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 건수 표시. 확인하지 못한 값(null)은 '확인 안 됨' */
export function formatCount(value: number | null): string {
  return value === null ? '확인 안 됨' : countFormat.format(value)
}
