import type { TextChangeItem } from '@/shared/api/textChanges'
import { mergedPreview } from './mergedPreview'
import { comparedRowsOf } from './rowDiff'
import { comparesWords } from './textLabels'

/** 목록에서 같은 목차가 이어진 묶음(3.54). 문서 순서일 때만 묶는다 */
export interface SectionRun {
  /** 묶음 구분값(목차와 첫 변경 번호). 같은 목차가 떨어져 다시 나와도 겹치지 않는다 */
  key: string
  sectionPath: string
  items: TextChangeItem[]
}

/** 이어진 같은 목차끼리 묶는다. 순서는 그대로 둔다 */
export function sectionRuns(items: TextChangeItem[]): SectionRun[] {
  const runs: SectionRun[] = []
  for (const item of items) {
    const last = runs[runs.length - 1]
    if (last && last.sectionPath === item.sectionPath) last.items.push(item)
    else runs.push({ key: `${item.sectionPath}#${item.changeId}`, sectionPath: item.sectionPath, items: [item] })
  }
  return runs
}

/** 목록 한 줄에 보일 글. 현재 글을 먼저, 없으면 이전 글. 미리보기 앞의 …와 줄바꿈은 뺀다 */
export function rowPreviewText(item: Pick<TextChangeItem, 'currentPreview' | 'previousPreview'>): string {
  const text = item.currentPreview ?? item.previousPreview ?? ''
  return text.replace(/^…/, '').replace(/\s+/g, ' ').trim()
}

/** 상세 칸에 무엇을 보일지 */
export type TextDetail =
  | { kind: 'item'; item: TextChangeItem; index: number }
  /** 주소로 고른 변경이 지금 목록(거르기·쪽)에 없다 */
  | { kind: 'outside'; changeId: number }
  | { kind: 'none' }

/**
 * 상세 칸의 변경을 정한다. 원문 비교 창으로 연 변경(tc)이 목록에 있으면 그것을, 아니면 목록에서 고른 변경(tsel)을,
 * 아무것도 고르지 않았으면 첫 변경을 보인다.
 */
export function textDetailOf(items: TextChangeItem[], detailId: number | null, evidenceId: number | null): TextDetail {
  const at = (id: number | null) => (id === null ? -1 : items.findIndex((item) => item.changeId === id))
  const evidenceIndex = at(evidenceId)
  if (evidenceIndex >= 0) return { kind: 'item', item: items[evidenceIndex], index: evidenceIndex }
  const detailIndex = at(detailId)
  if (detailIndex >= 0) return { kind: 'item', item: items[detailIndex], index: detailIndex }
  if (detailId !== null) return { kind: 'outside', changeId: detailId }
  if (items.length === 0) return { kind: 'none' }
  return { kind: 'item', item: items[0], index: 0 }
}

/** 수정된 문단을 한 글로 합칠 수 있는지(3.53). 표·추가·삭제·검토 필요·같은 낱말이 없는 글은 합치지 않는다 */
export function canMergeChange(item: TextChangeItem): boolean {
  return (
    item.changeType !== 'REVIEW_NEEDED' &&
    comparedRowsOf(item.rowDiff) === null &&
    item.blockType !== 'TABLE' &&
    comparesWords(item.changeType) &&
    mergedPreview(item.previousPreview, item.currentPreview) !== null
  )
}
