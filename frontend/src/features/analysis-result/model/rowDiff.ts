import { match } from 'ts-pattern'
import type { ChangedRow, ComparedRowDiff, RowDiffCounts, TextChangeItem, TextRowDiff } from '@/shared/api/textChanges'
import { changeTypeLabel } from './textLabels'

/** 표 변경 카드의 행 비교 표시(3.30). 건수와 바뀐 칸은 서버가 코드로 낸 값을 그대로 쓴다. 뜻은 docs/api-spec.md의 rowDiff와 같다 */
const CARD_ROW_LIMIT = 3

export const NOT_COMPARED_LABEL = '행 비교 안 함'
export const NOT_COMPARED_NOTE = '표 모양이 맞지 않거나 짝지을 값이 없어 행을 비교하지 않았어요.'
export const PAIRED_TABLE_CURRENT = '이번 보고서에서는 구성이 바뀐 표로 이어져요. 행 비교 결과는 그 표의 카드에 있어요.'
export const MISSING_ROW_NOTE = "'이번엔 없음'은 이번 표에 없다는 뜻이고, 끝났다는 뜻은 아니에요."

export function rowCountItems(counts: RowDiffCounts): { label: string; count: number }[] {
  return [
    { label: '바뀜', count: counts.changed },
    { label: '새로', count: counts.added },
    { label: '이번엔 없음', count: counts.missing },
    { label: '그대로', count: counts.same },
  ]
}

/** 행을 비교한 표의 결과. 비교하지 않은 표, 문단, 옛 분석이면 null */
export function comparedRowsOf(diff: TextRowDiff | null): ComparedRowDiff | null {
  return diff?.status === 'COMPARED' ? diff : null
}

/** 표인데 행을 비교하지 않았는지. 문단이나 옛 분석(null)과 구분한다(AC8) */
export function isNotCompared(diff: TextRowDiff | null): boolean {
  return diff?.status === 'NOT_COMPARED'
}

export function visibleChangedRows(diff: ComparedRowDiff): ChangedRow[] {
  return diff.changedRows.slice(0, CARD_ROW_LIMIT)
}

/** 카드에 보이지 않는 바뀐 행 수. 목록은 changedRows를 앞에서 3개만 주므로 건수로 낸다 */
export function hiddenChangedRows(diff: ComparedRowDiff): number {
  return Math.max(0, diff.counts.changed - visibleChangedRows(diff).length)
}

/** 새 표와 짝지어 접은 이전 표인지. DELETED로 저장되지만 내용이 사라진 표가 아니다 */
export function isPairedPreviousTable(item: Pick<TextChangeItem, 'listGroup'>): boolean {
  return item.listGroup === 'PAIRED_TABLE'
}

/** 카드의 유형 이름. 구성이 바뀌어 짝지은 표는 ADDED·DELETED 두 행으로 저장되지만 새로 생기거나 삭제된 표가 아니다 */
export function cardTypeLabel(item: Pick<TextChangeItem, 'changeType' | 'listGroup' | 'rowDiff'>): string {
  if (isPairedPreviousTable(item)) return '표 구성 바뀜(이전 표)'
  return match(comparedRowsOf(item.rowDiff)?.pairedPrevious ?? null)
    .with(null, () => changeTypeLabel(item.changeType))
    .otherwise(() => '표 구성 바뀜')
}

export function cellText(text: string): string {
  return text.trim() === '' ? '(빈 칸)' : text
}
