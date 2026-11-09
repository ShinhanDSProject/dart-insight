import { match } from 'ts-pattern'
import type { TextField, TextListing } from '@/shared/api/textChanges'
import { formatCount } from './textFilter'

/** 문장 변화 탭의 분야별 표(3.28). 이름과 순서는 docs/api-spec.md text-changes의 분야 표와 같다. */
const FIELD_LABELS: Record<TextField, string> = {
  LITIGATION: '소송·제재',
  CONTRACT: '주요 계약',
  BUSINESS: '사업 내용',
  DIVIDEND: '배당',
  FUNDING: '자금 조달',
  BOARD: '이사회·임원',
  SHAREHOLDER: '주주',
  AUDIT: '감사',
  OTHER: '그 밖의 변경',
}
const TEXT_FIELDS = Object.keys(FIELD_LABELS) as TextField[]

export const FIELD_TABLE_TITLE = '분야별 변경'
/** 칩 줄 맨 앞의 '전체'(3.58). 누르면 분야 거르기를 푼다 */
export const ALL_FIELDS_CHIP = '전체'
export const FIELD_TABLE_HINT = '칸을 누르면 아래 목록이 그 분야로 걸러져요'
export const ALL_FIELDS_LABEL = '전체 분야 보기'
export const FIELD_TABLE_NOTE =
  '제목 줄, 띄어쓰기·기호만 다른 수정, 자리만 옮긴 글, 재무제표 주석(소송·담보 등은 포함)을 뺀 건수예요. 목차 제목으로 나눈 것이라 실제 내용과 다를 수 있어요.'

/** changed 건수가 있음, no-change 섹션은 있는데 0건, no-section 두 보고서 어느 쪽에도 섹션이 없음 */
export type FieldCellState = 'changed' | 'no-change' | 'no-section'

export interface FieldCell {
  field: TextField
  label: string
  count: number
  state: FieldCellState
}

/** loading 첫 응답 전, hidden 옛 분석이거나 변경이 없는 분석(분류 값 없음), table 9칸 표 */
export type FieldTableView = { kind: 'loading' } | { kind: 'hidden' } | { kind: 'table'; cells: FieldCell[]; total: number }

export function fieldTableView(listing: TextListing | null): FieldTableView {
  if (listing === null) return { kind: 'loading' }
  const { fieldCounts, missingFields } = listing
  if (listing.listVersion === null || fieldCounts === null || missingFields === null) return { kind: 'hidden' }
  const cells = TEXT_FIELDS.map((field): FieldCell => {
    const count = fieldCounts[field]
    return { field, label: FIELD_LABELS[field], count, state: cellState(count, missingFields.includes(field)) }
  })
  return { kind: 'table', cells, total: cells.reduce((sum, cell) => sum + cell.count, 0) }
}

function cellState(count: number, missing: boolean): FieldCellState {
  if (count > 0) return 'changed'
  return missing ? 'no-section' : 'no-change'
}

/** 칩에 보이는 값. 건수는 숫자만 쓴다(3.58) */
export function fieldCellValue(cell: FieldCell): string {
  return match(cell.state)
    .with('changed', () => formatCount(cell.count))
    .with('no-change', () => '확인된 변화 없음')
    .with('no-section', () => '보고서에 해당 내용 없음')
    .exhaustive()
}

export function textFieldLabel(field: TextField): string {
  return FIELD_LABELS[field]
}

/** 주소의 tfield. 모르는 값은 전체(null)로 본다 */
export function parseTextField(value: string | null): TextField | null {
  return TEXT_FIELDS.includes(value as TextField) ? (value as TextField) : null
}

/** 실제로 쓸 분야. 옛 분석(listVersion null)은 서버가 분야를 무시하므로 전체로 본다. 응답 전에는 그대로 둔다 */
export function resolveTextField(field: TextField | null, listing: TextListing | null): TextField | null {
  return listing?.listVersion === null ? null : field
}
