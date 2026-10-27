import { match } from 'ts-pattern'
import type { ReportType } from '@/shared/api/reports'
import { dartViewerUrl } from '@/shared/lib/dart'
import { formatRatio, ratioReasonLabel } from '@/shared/lib/financialRatios'
import { periodLabel, reportTypeLabel } from '@/shared/lib/reportLabels'
import { Button, DataTable } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import {
  comparisonRows,
  formatAmount,
  type AmountCell,
  type ComparisonColumn,
  type RatioCell,
  type ReadyColumn,
} from '../model/companyComparison'

interface ComparisonTableProps {
  columns: readonly ComparisonColumn[]
  type: ReportType
  onRetry: (corpCode: string) => void
}

/**
 * 여러 기업 주요 수치 표(FS-56). 행은 주요계정 6개 → 비율 4개, 열은 고른 순서의 기업이다.
 * 정렬 버튼·순위·최고·최저 강조는 두지 않는다. 열 머리글에 보고서·대상 기간·근거 접수번호와 DART 원문 링크를 둔다.
 * 준비되지 않은 열(불러오는 중·실패·보고서 없음)은 그 열 전체에 사유를 보여 준다.
 */
export function ComparisonTable({ columns, type, onRetry }: ComparisonTableProps) {
  const rows = comparisonRows(columns)
  return (
    <DataTable
      caption="여러 기업 주요 수치 표(금액 단위 원, 조·억으로 줄여 표시 · 비율 단위 %, 기업은 고른 순서)"
      density="dense"
      className="company-compare__table"
    >
      <thead>
        <tr>
          <th scope="col">항목</th>
          {columns.map((column) => (
            <th key={column.corpCode} scope="col" className="company-compare__head">
              <ColumnHead column={column} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={row.key}>
            <th scope="row">
              {row.name}
              {match(row)
                .with({ kind: 'amount' }, () => <span className="company-compare__unit"> · 원</span>)
                .with({ kind: 'ratio' }, ({ formula }) => (
                  <span className="company-compare__formula">
                    {' '}
                    · % <span className="visually-hidden">계산식 </span>
                    {formula}
                  </span>
                ))
                .exhaustive()}
            </th>
            {columns.map((column, columnIndex) => {
              if (column.status !== 'ready') {
                return rowIndex === 0 ? (
                  <td key={column.corpCode} rowSpan={rows.length} className="company-compare__state">
                    <ColumnState column={column} type={type} onRetry={onRetry} />
                  </td>
                ) : null
              }
              return (
                <td key={column.corpCode} className="num">
                  {match(row)
                    .with({ kind: 'amount' }, ({ cells }) => <AmountText cell={cells[columnIndex]} />)
                    .with({ kind: 'ratio' }, ({ cells }) => <RatioText cell={cells[columnIndex]} />)
                    .exhaustive()}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

function ColumnHead({ column }: { column: ComparisonColumn }) {
  return (
    <>
      <span className="company-compare__name">{column.name}</span>
      {match(column)
        .with({ status: 'ready' }, (ready) => <ReadyHead column={ready} />)
        .otherwise(() => (
          <span className="company-compare__meta">고유번호 {column.corpCode}</span>
        ))}
    </>
  )
}

function ReadyHead({ column }: { column: ReadyColumn }) {
  const { period, sourceRceptNo } = column
  const corrected = sourceRceptNo !== period.rceptNo
  return (
    <>
      <span className="company-compare__meta">{period.reportName}</span>
      <span className="company-compare__period">{periodLabel(period)}</span>
      <span className="company-compare__meta">
        접수번호 {sourceRceptNo}
        {corrected && ' (정정 공시 값)'}{' '}
        <DartLinkInline
          rceptNo={sourceRceptNo}
          dartUrl={corrected ? dartViewerUrl(sourceRceptNo) : period.dartUrl}
          label={`${column.name} ${period.reportName}(접수번호 ${sourceRceptNo})`}
        />
      </span>
      {column.newerFailed && (
        <span className="company-compare__meta">더 최근 보고서의 값을 받지 못해 이 보고서를 보여 드려요.</span>
      )}
    </>
  )
}

function ColumnState({
  column,
  type,
  onRetry,
}: {
  column: Exclude<ComparisonColumn, ReadyColumn>
  type: ReportType
  onRetry: (corpCode: string) => void
}) {
  return match(column)
    .with({ status: 'loading' }, () => (
      <p role="status" className="company-compare__state-text">
        불러오는 중이에요…
      </p>
    ))
    .with({ status: 'failed' }, () => (
      <div role="alert">
        <p className="company-compare__state-text">불러오지 못했어요</p>
        <Button variant="secondary" aria-label={`${column.name} 다시 시도`} onClick={() => onRetry(column.corpCode)}>
          다시 시도
        </Button>
      </div>
    ))
    .with({ status: 'no-report' }, () => (
      <>
        <p className="company-compare__state-text">고른 종류의 보고서가 없어요</p>
        <p className="field-hint">{reportTypeLabel(type)}가 없는 기업이에요. 다른 보고서 종류를 골라 보세요.</p>
      </>
    ))
    .with({ status: 'no-data' }, () => (
      <>
        <p className="company-compare__state-text">고른 종류 보고서의 주요계정 값이 없어요</p>
        <p className="field-hint">다른 재무제표 기준(연결·별도)이나 보고서 종류를 골라 보세요.</p>
      </>
    ))
    .exhaustive()
}

function AmountText({ cell }: { cell: AmountCell }) {
  return match(cell)
    .with({ status: 'value' }, ({ amount, currency }) => <>{formatAmount(amount, currency)}</>)
    .with({ status: 'missing' }, () => <span className="company-compare__none">자료 없음</span>)
    .with({ status: 'none' }, () => null)
    .exhaustive()
}

function RatioText({ cell }: { cell: RatioCell }) {
  return match(cell)
    .with({ status: 'value' }, ({ result }) => {
      const value = formatRatio(result.value)
      return value === null ? <span className="company-compare__none">{ratioReasonLabel(result)}</span> : <>{value}</>
    })
    .with({ status: 'none' }, () => null)
    .exhaustive()
}
