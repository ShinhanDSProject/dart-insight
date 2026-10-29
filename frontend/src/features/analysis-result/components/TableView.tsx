import { match } from 'ts-pattern'
import type { TableCell } from '@/shared/api/textChanges'
import { DataTable } from '@/shared/ui'
import { highlightSegments } from '../model/sourceSearch'
import { rowStatusBadgeLabel, type TableRowDiff, type TableSideDiff } from '../model/tableDiff'

export interface TableViewProps {
  rows: TableCell[][]
  caption: string
  /** 항목 내 검색어(#523). 있으면 일치하는 글자를 <mark>로 강조한다 */
  highlightQuery?: string | null
  /** 원문 비교 창의 표 변경 강조(#524) */
  diff?: TableSideDiff | null
}

/**
 * 원문 표(4.2에서 읽은 셀). 머리글(TH)·병합(colspan·rowspan)을 그대로 보여 준다.
 * 머리글의 방향은 원문에 없으므로, 첫 줄 머리글은 열 머리글, 그 아래 첫 칸 머리글은 행 머리글로 본다.
 */
export function TableView({ rows, caption, highlightQuery = null, diff = null }: TableViewProps) {
  return (
    <DataTable caption={caption} density="compact">
      <tbody>
        {rows.map((row, r) => {
          const rowDiff = diff?.rows[r]
          return (
            <tr key={r} className={rowClassName(rowDiff)}>
              {row.map((cell, c) => {
                const content = (
                  <TableCellContent
                    text={cell.text}
                    column={c}
                    rowDiff={rowDiff}
                    highlightQuery={highlightQuery}
                  />
                )
                return cell.header ? (
                  <th key={c} scope={headerScope(r, c)} colSpan={cell.colspan} rowSpan={cell.rowspan}>
                    {content}
                  </th>
                ) : (
                  <td key={c} colSpan={cell.colspan} rowSpan={cell.rowspan}>
                    {content}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}

function rowClassName(rowDiff: TableRowDiff | undefined): string | undefined {
  if (rowDiff === undefined) return undefined
  return match(rowDiff)
    .with({ status: 'matched' }, () => undefined)
    .with({ status: 'added' }, () => 'table-diff__row--added')
    .with({ status: 'removed' }, () => 'table-diff__row--removed')
    .exhaustive()
}

function TableCellContent({
  text,
  column,
  rowDiff,
  highlightQuery,
}: {
  text: string
  column: number
  rowDiff: TableRowDiff | undefined
  highlightQuery: string | null
}) {
  const badge = column === 0 ? rowStatusBadgeLabel(rowDiff) : null
  const changed = rowDiff?.status === 'matched' && rowDiff.changedCols.has(column)
  const display = changed && text.trim().length === 0 ? '—' : text

  return (
    <>
      {badge !== null && <span className="change-side__tag table-diff__tag">{badge}</span>}
      {changed ? (
        <mark className="text-evidence__changed">
          <SourceHighlightText text={display} query={highlightQuery} />
          <span className="visually-hidden"> (변경됨)</span>
        </mark>
      ) : (
        <SourceHighlightText text={text} query={highlightQuery} />
      )}
    </>
  )
}

export function SourceHighlightText({ text, query }: { text: string; query?: string | null }) {
  if (!query) return <>{text}</>
  const segments = highlightSegments(text, query)
  if (segments.length === 1 && !segments[0].hit) return <>{text}</>
  return (
    <>
      {segments.map((seg, index) =>
        seg.hit ? (
          <mark key={index} className="source-search__hit">
            {seg.text}
          </mark>
        ) : (
          <span key={index}>{seg.text}</span>
        ),
      )}
    </>
  )
}

function headerScope(row: number, column: number): 'col' | 'row' | undefined {
  if (row === 0) return 'col'
  return column === 0 ? 'row' : undefined
}
