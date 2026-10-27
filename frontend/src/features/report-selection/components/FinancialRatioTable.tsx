import { useState } from 'react'
import type { TrendPeriod } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { cx } from '@/shared/lib/cx'
import { dartViewerUrl } from '@/shared/lib/dart'
import {
  formatRatio,
  isIncomeRatio,
  ratioReasonLabel,
  type RatioKey,
  type RatioResult,
} from '@/shared/lib/financialRatios'
import { Button, DataTable } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import {
  formatRatioAmount,
  incomeBasisLabel,
  periodShortLabel,
  type IncomeBasis,
  type RatioTable,
} from '../model/financialTrend'

const DETAIL_ID = 'fin-ratio-detail'

interface Selected {
  key: RatioKey
  rceptNo: string
}

interface FinancialRatioTableProps {
  table: RatioTable
  type: ReportType
  basis: IncomeBasis
}

/**
 * 기업 개요 '주요 재무 흐름'의 비율 보기(FS-54, #410). 행은 비율, 열은 기간(오래된 순서)이다.
 * 값을 누르면 표 아래에 계산식·두 금액·근거 보고서의 DART 링크를 보여 준다.
 * 계산하지 못한 칸은 0이나 '—'가 아니라 이유('계산 불가 · 매출액 미기재')를 적는다. 좋음·나쁨 색과 문구는 쓰지 않는다.
 */
export function FinancialRatioTable({ table, type, basis }: FinancialRatioTableProps) {
  const [selected, setSelected] = useState<Selected | null>(null)

  const columnOf = (rceptNo: string) => table.periods.findIndex((p) => p.rceptNo === rceptNo)
  const detail = (() => {
    if (selected === null) return null
    const column = columnOf(selected.rceptNo)
    const row = table.rows.find((r) => r.key === selected.key)
    const result = row?.cells[column]
    const period = table.periods[column]
    return result === undefined || period === undefined ? null : { result, period }
  })()

  function toggle(next: Selected) {
    setSelected((current) =>
      current !== null && current.key === next.key && current.rceptNo === next.rceptNo ? null : next,
    )
  }

  return (
    <div className="fin-ratio">
      <DataTable caption="재무 비율 표(단위 %, 값을 누르면 계산식과 근거 보고서를 보여 드려요)" density="dense">
        <thead>
          <tr>
            <th scope="col">비율 · 단위 %</th>
            {table.periods.map((period) => (
              <th key={period.rceptNo} scope="col" className="num">
                {periodShortLabel(period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.name}{' '}
                <span className="fin-ratio__formula">{row.formula}</span>
              </th>
              {row.cells.map((result, column) => {
                const period = table.periods[column]
                const open = selected?.key === row.key && selected.rceptNo === period.rceptNo
                const text = formatRatio(result.value) ?? ratioReasonLabel(result)
                return (
                  <td key={period.rceptNo} className="num">
                    <button
                      type="button"
                      className={cx('fin-ratio__value', result.value === null && 'fin-ratio__value--none')}
                      aria-expanded={open}
                      aria-controls={DETAIL_ID}
                      aria-label={`${periodShortLabel(period)} ${row.name} ${text}`}
                      onClick={() => toggle({ key: row.key, rceptNo: period.rceptNo })}
                    >
                      {text}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </DataTable>
      <div id={DETAIL_ID} className="fin-ratio__detail-slot" aria-live="polite">
        {detail !== null && (
          <RatioDetail
            result={detail.result}
            period={detail.period}
            type={type}
            basis={basis}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}

interface RatioDetailProps {
  result: RatioResult
  period: TrendPeriod
  type: ReportType
  basis: IncomeBasis
  onClose: () => void
}

function RatioDetail({ result, period, type, basis, onClose }: RatioDetailProps) {
  const title = `${periodShortLabel(period)} ${result.name}`
  return (
    <section className="fin-ratio__detail" aria-label={`${title} 계산 근거`}>
      <div className="fin-ratio__detail-head">
        <p className="fin-ratio__detail-title">
          {title} <span className="fin-ratio__detail-value">{formatRatio(result.value) ?? ratioReasonLabel(result)}</span>
        </p>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
      <dl className="fin-ratio__facts">
        <dt>계산식</dt>
        <dd>{result.formula}</dd>
        <dt>{result.numeratorName}</dt>
        <dd>{formatRatioAmount(result.numerator, result.currency)}</dd>
        <dt>{result.denominatorName}</dt>
        <dd>{formatRatioAmount(result.denominator, result.currency)}</dd>
        {isIncomeRatio(result.key) && (
          <>
            <dt>손익 금액 기준</dt>
            <dd>{incomeBasisLabel(type, basis, period.periodEnd)} · 연환산하지 않았어요</dd>
          </>
        )}
        <dt>근거 보고서</dt>
        {result.sourceRceptNos.map((source) => (
          <dd key={source}>
            {period.reportName} · 접수번호 {source}
            {source !== period.rceptNo && ' (정정 공시 값)'}{' '}
            <DartLinkInline
              rceptNo={source}
              dartUrl={source === period.rceptNo ? period.dartUrl : dartViewerUrl(source)}
              label={`${period.reportName}(접수번호 ${source})`}
            />
          </dd>
        ))}
      </dl>
    </section>
  )
}
