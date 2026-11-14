import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { TextField, TextListing } from '@/shared/api/textChanges'
import { Chip, Skeleton } from '@/shared/ui'
import { formatCount, resultCountLabel } from '../model/textFilter'
import { fieldEventLabel, type EventFieldCounts } from '../model/textEvents'
import { ALL_FIELDS_CHIP, FIELD_TABLE_HINT, FIELD_TABLE_NOTE, FIELD_TABLE_TITLE, fieldCellValue, fieldTableView } from '../model/textFields'

interface TextFieldTableProps {
  /** 분야 건수. 아직 모르면 null */
  listing: TextListing | null
  /** 고른 분야. null이면 전체 */
  field: TextField | null
  /** 칸마다 관련 주요 사건 수(3.37). 사건이 없으면 null이고 '· 사건 n'이 빠진다 */
  eventCounts: EventFieldCounts | null
  /** 칸을 고르거나(분야) 풀었을 때(null) */
  onChoose: (field: TextField | null) => void
  /** 칩 줄 맨 끝에 둘 것(3.55 위험 관련 칩) */
  extra?: ReactNode
}

/**
 * 문장 변화 탭 맨 위의 분야별 변경(3.28 → 3.58 칩 한 줄). 건수는 코드가 센 기본 목록 건수이고, 칩을 누르면 아래 목록을 그 분야로 거른다.
 * 맨 앞 '전체'는 거르기를 풀고, 맨 끝에는 위험 관련 칩(extra)을 둔다. 0건인 칩은 고를 것이 없어 누를 수 없다. 다만 주소로 이미 고른 칩은 풀 수 있게 둔다.
 */
export function TextFieldTable({ listing, field, eventCounts, onChoose, extra }: TextFieldTableProps) {
  return match(fieldTableView(listing))
    .with({ kind: 'hidden' }, () => null)
    .with({ kind: 'loading' }, () => <Skeleton label={`${FIELD_TABLE_TITLE}을 불러오는 중이에요…`} shape="card" count={1} />)
    .with({ kind: 'table' }, ({ cells, total }) => (
      <section className="field-table" aria-labelledby="field-table-title">
        <div className="field-table__head">
          <h3 id="field-table-title" className="field-table__title">
            {FIELD_TABLE_TITLE}
          </h3>
          <span className="field-table__total">
            {resultCountLabel(total)} · {FIELD_TABLE_HINT}
          </span>
        </div>
        <div className="field-table__cells" role="group" aria-label={FIELD_TABLE_TITLE} aria-describedby="field-table-note">
          <Chip className="field-chip" pressed={field === null} onClick={() => onChoose(null)}>
            {ALL_FIELDS_CHIP} <span className="chip__count">{formatCount(total)}</span>
          </Chip>
          {cells.map((cell) => {
            const pressed = cell.field === field
            const eventLabel = fieldEventLabel(cell, eventCounts)
            return (
              <Chip key={cell.field} className="field-chip" pressed={pressed} disabled={cell.count === 0 && !pressed} onClick={() => onChoose(pressed ? null : cell.field)}>
                {cell.label} <span className="chip__count">{fieldCellValue(cell)}</span>
                {eventLabel !== null && <span className="field-chip__events"> · {eventLabel}</span>}
              </Chip>
            )
          })}
          {extra}
        </div>
        {/* 무엇을 센 건수인지는 칩 줄의 설명으로 읽힌다(3.58에서 표 아래 문단을 걷음) */}
        <span id="field-table-note" className="visually-hidden">
          {FIELD_TABLE_NOTE}
        </span>
      </section>
    ))
    .exhaustive()
}
