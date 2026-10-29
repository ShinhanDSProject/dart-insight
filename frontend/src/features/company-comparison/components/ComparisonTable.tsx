import { match } from 'ts-pattern'
import { Link } from 'react-router'
import type { ReportType } from '@/shared/api/reports'
import { dartViewerUrl } from '@/shared/lib/dart'
import { formatRatio, periodSourceRceptNo, ratioReasonLabel } from '@/shared/lib/financialRatios'
import { periodLabel, reportTypeLabel } from '@/shared/lib/reportLabels'
import { Button, DataTable } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import {
  comparisonRows,
  formatAmount,
  MAX_COMPANIES,
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
 *
 * 기업을 더하거나 빼고, 보고서 종류·기준을 바꿔도 표 모양이 흔들리지 않게(#424) 열은 늘 최대 수(4)만큼 두고 폭을 고정한다.
 * 고르지 않은 자리는 빈 열로 남긴다.
 */
export function ComparisonTable({ columns, type, onRetry }: ComparisonTableProps) {
  const rows = comparisonRows(columns)
  const emptySlots = Array.from({ length: Math.max(0, MAX_COMPANIES - columns.length) }, (_, i) => `empty-${i}`)
  return (
    <DataTable
      caption="여러 기업 주요 수치 표(금액 단위 원, 조·억으로 줄여 표시 · 비율 단위 %, 기업은 고른 순서)"
      density="dense"
      className="company-compare__table"
    >
      <colgroup>
        <col className="company-compare__col-label" />
        {Array.from({ length: MAX_COMPANIES }, (_, i) => (
          <col key={i} className="company-compare__col-company" />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col">항목</th>
          {columns.map((column) => (
            <th key={column.corpCode} scope="col" className="company-compare__head">
              <ColumnHead column={column} />
            </th>
          ))}
          {emptySlots.map((key) => (
            <th key={key} scope="col" className="company-compare__head company-compare__head--empty">
              기업을 더해 주세요
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
            {emptySlots.map((key) => (
              <td key={key} className="company-compare__empty" />
            ))}
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
  const { period, previousPeriod, sourceRceptNo } = column
  const corrected = sourceRceptNo !== period.rceptNo
  const prevSourceRceptNo = previousPeriod ? periodSourceRceptNo(previousPeriod) : null
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
      <div className="company-compare__links">
        <Link
          to={`/companies/${encodeURIComponent(column.corpCode)}?view=overview`}
          className="company-compare__link"
          aria-label={`${column.name} 기업 개요`}
        >
          기업 개요
        </Link>
        {previousPeriod && prevSourceRceptNo && (
          <Link
            to={`/companies/${encodeURIComponent(column.corpCode)}/compare?current=${encodeURIComponent(sourceRceptNo)}&previous=${encodeURIComponent(prevSourceRceptNo)}&basis=YOY`}
            className="company-compare__link"
            aria-label={`${column.name} 전년 동기 보고서 비교`}
          >
            전년 동기 비교
          </Link>
        )}
      </div>
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
    .with({ status: 'value' }, ({ amount, currency, yoy }) => (
      <>
        <span className="company-compare__amount">{formatAmount(amount, currency)}</span>
        {yoy && <span className="company-compare__yoy">{yoy}</span>}
      </>
    ))
    .with({ status: 'missing' }, () => <span className="company-compare__none">자료 없음</span>)
    .with({ status: 'none' }, () => null)
    .exhaustive()
}

function RatioText({ cell }: { cell: RatioCell }) {
  return match(cell)
    .with({ status: 'value' }, ({ result, yoy }) => {
      const value = formatRatio(result.value)
      return value === null ? (
        <span className="company-compare__none">{ratioReasonLabel(result)}</span>
      ) : (
        <>
          <span className="company-compare__ratio">{value}</span>
          {yoy && <span className="company-compare__yoy">{yoy}</span>}
        </>
      )
    })
    .with({ status: 'none' }, () => null)
    .exhaustive()
}
