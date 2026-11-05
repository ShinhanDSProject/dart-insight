import { match } from 'ts-pattern'
import type { TextField, TextListing } from '@/shared/api/textChanges'
import { Button, Card, Skeleton } from '@/shared/ui'
import { resultCountLabel } from '../model/textFilter'
import { fieldEventLabel, type EventFieldCounts } from '../model/textEvents'
import { ALL_FIELDS_LABEL, FIELD_TABLE_NOTE, FIELD_TABLE_TITLE, fieldCellValue, fieldTableView } from '../model/textFields'

interface TextFieldTableProps {
  /** 분야 건수. 아직 모르면 null */
  listing: TextListing | null
  /** 고른 분야. null이면 전체 */
  field: TextField | null
  /** 칸마다 관련 주요 사건 수(3.37). 사건이 없으면 null이고 그 줄이 빠진다 */
  eventCounts: EventFieldCounts | null
  /** 칸을 고르거나(분야) 풀었을 때(null) */
  onChoose: (field: TextField | null) => void
}

/**
 * 문장 변화 탭 맨 위의 분야별 표(3.28). 건수는 코드가 센 기본 목록 건수이고, 칸을 누르면 아래 목록을 그 분야로 거른다.
 * 0건인 칸은 고를 것이 없어 누를 수 없다. 다만 주소로 이미 고른 칸은 풀 수 있게 둔다.
 */
export function TextFieldTable({ listing, field, eventCounts, onChoose }: TextFieldTableProps) {
  return match(fieldTableView(listing))
    .with({ kind: 'hidden' }, () => null)
    .with({ kind: 'loading' }, () => <Skeleton label={`${FIELD_TABLE_TITLE}을 불러오는 중입니다…`} shape="card" count={3} />)
    .with({ kind: 'table' }, ({ cells, total }) => (
      <Card as="section" className="field-table" aria-labelledby="field-table-title">
        <div className="field-table__head">
          <h3 id="field-table-title" className="field-table__title">
            {FIELD_TABLE_TITLE}
          </h3>
          <span className="field-table__total">합계 {resultCountLabel(total)}</span>
          {field !== null && (
            <Button variant="secondary" onClick={() => onChoose(null)}>
              {ALL_FIELDS_LABEL}
            </Button>
          )}
        </div>
        <div className="field-table__cells" role="group" aria-label={FIELD_TABLE_TITLE}>
          {cells.map((cell) => {
            const pressed = cell.field === field
            const eventLabel = fieldEventLabel(cell, eventCounts)
            return (
              <button
                key={cell.field}
                type="button"
                className="field-cell"
                aria-pressed={pressed}
                disabled={cell.count === 0 && !pressed}
                onClick={() => onChoose(pressed ? null : cell.field)}
              >
                <span className="field-cell__label">{cell.label}</span>
                <span className="field-cell__value">{fieldCellValue(cell)}</span>
                {eventLabel !== null && <span className="field-cell__events">{eventLabel}</span>}
              </button>
            )
          })}
        </div>
        <p className="panel__note field-table__note">{FIELD_TABLE_NOTE}</p>
      </Card>
    ))
    .exhaustive()
}
