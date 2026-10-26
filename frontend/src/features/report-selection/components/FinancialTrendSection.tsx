import { useState, type CSSProperties } from 'react'
import { match } from 'ts-pattern'
import type { FinancialTrend, FsDiv } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { formatCompactAmount, position } from '@/shared/lib/chartScale'
import { dartViewerUrl, verifiedDartUrl } from '@/shared/lib/dart'
import { reportTypeLabel } from '@/shared/lib/reportLabels'
import { Button, DataTable, Notice, Panel, PanelTitle, SegmentedControl, type SegmentOption } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useFinancialTrends } from '../hooks/useFinancialTrends'
import {
  accountSummary,
  availableReportTypes,
  basisNote,
  chartAccounts,
  columnBars,
  effectiveBasis,
  failedCount,
  formatChartAmount,
  formatTrendAmount,
  periodShortLabel,
  selectedReportType,
  tableUnitLabel,
  trendSeries,
  type IncomeBasis,
  type SeriesAccount,
  type TrendSeries,
  type TrendView,
} from '../model/financialTrend'

const fsDivOptions: readonly SegmentOption<FsDiv>[] = [
  { value: 'CFS', label: '연결' },
  { value: 'OFS', label: '별도' },
]

const basisOptions: readonly SegmentOption<IncomeBasis>[] = [
  { value: 'CUMULATIVE', label: '누적' },
  { value: 'QUARTER', label: '3개월' },
]

const viewOptions: readonly SegmentOption<TrendView>[] = [
  { value: 'chart', label: '차트' },
  { value: 'table', label: '표' },
]

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '기업을 찾지 못해 재무 흐름을 보여 드릴 수 없어요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 보고서 목록을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
}

/**
 * 기업 개요 탭의 '주요 재무 흐름'(FS-46, #330). 최근 정기보고서들의 OpenDART 주요계정을 같은 종류 보고서끼리
 * (예: 반기끼리) 작은 막대 차트와 표로 보여 준다. 차트는 라이브러리 없이 그린다(ADR-0018).
 * 없는 값은 0으로 그리지 않고 '—'(값 없음)로 둔다. 표의 열 머리글이 값의 근거 공시(접수번호) 링크다.
 */
export function FinancialTrendSection({ corpCode }: { corpCode: string }) {
  const [fsDiv, setFsDiv] = useState<FsDiv>('CFS')
  const { state, reload } = useFinancialTrends(corpCode, fsDiv)

  return (
    <Panel className="fin-trend" aria-labelledby="fin-trend-title">
      <div className="fin-trend__head">
        <div>
          <PanelTitle id="fin-trend-title">주요 재무 흐름</PanelTitle>
          <p className="fin-trend__sub">
            최근 정기보고서의 OpenDART 주요계정이에요. 같은 종류 보고서끼리 비교해요.
          </p>
        </div>
        <SegmentedControl aria-label="재무제표 기준" options={fsDivOptions} value={fsDiv} onChange={setFsDiv} />
      </div>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="주요 재무 흐름을 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success' }, ({ data }) => <TrendBody trend={data} onRetry={reload} />)
        .exhaustive()}
    </Panel>
  )
}

function TrendBody({ trend, onRetry }: { trend: FinancialTrend; onRetry: () => void }) {
  const [chosenType, setChosenType] = useState<ReportType | null>(null)
  const [basis, setBasis] = useState<IncomeBasis>('CUMULATIVE')
  const [view, setView] = useState<TrendView>('chart')

  const type = selectedReportType(trend.periods, chosenType)
  if (type === null) {
    return <EmptyState title="정기보고서가 없어 재무 흐름을 보여 드릴 수 없어요." />
  }
  const series = trendSeries(trend, type, basis)
  const typeOptions = availableReportTypes(trend.periods).map((value) => ({ value, label: reportTypeLabel(value) }))
  const failed = failedCount(trend.periods)
  const latest = series.periods.at(-1) ?? null

  return (
    <div className="fin-trend__body">
      <div className="fin-trend__controls">
        <SegmentedControl aria-label="비교할 보고서 종류" options={typeOptions} value={type} onChange={setChosenType} />
        {type !== 'ANNUAL' && (
          <SegmentedControl
            aria-label="손익 금액 기준"
            options={basisOptions}
            value={effectiveBasis(type, basis)}
            onChange={setBasis}
          />
        )}
        <SegmentedControl aria-label="보기" options={viewOptions} value={view} onChange={setView} />
      </div>
      <p className="panel__note">{basisNote(type, basis, trend.fsDiv, latest?.periodEnd ?? null)}</p>

      {failed > 0 && (
        <Notice tone="attention" role="status" title={`보고서 ${failed}개의 주요계정을 받지 못했어요.`}>
          <p>받지 못한 기간은 빈칸(—)으로 두었어요. 잠시 뒤 다시 시도하면 그 보고서만 다시 받아요.</p>
          <Button variant="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        </Notice>
      )}
      {trend.refreshError !== null && (
        <Notice tone="attention" role="status">
          보고서 목록을 새로 받지 못해 저장된 목록으로 보여 드려요.
        </Notice>
      )}

      {series.accounts.length === 0 ? (
        <EmptyState title={`${reportTypeLabel(type)}의 주요계정 값이 없어요.`}>
          <p>다른 재무제표 기준(연결·별도)이나 보고서 종류를 골라 보세요.</p>
        </EmptyState>
      ) : (
        match(view)
          .with('chart', () => <TrendCharts series={series} />)
          .with('table', () => <TrendTable series={series} />)
          .exhaustive()
      )}

      {series.emptyAccounts.length > 0 && series.accounts.length > 0 && (
        <p className="panel__note">고른 기간 내내 값이 없는 계정은 뺐어요: {series.emptyAccounts.join(', ')}</p>
      )}
      <p className="panel__note">
        출처: DART(OpenDART 단일회사 주요계정). 표 보기의 열 머리글에서 각 보고서의 DART 원문을 열 수 있어요.
      </p>
    </div>
  )
}

function TrendCharts({ series }: { series: TrendSeries }) {
  const accounts = chartAccounts(series)
  if (accounts.length === 0) {
    return <p className="panel__note">차트로 보여 드릴 계정 값이 없어요. 표 보기에서 다른 계정을 볼 수 있어요.</p>
  }
  return (
    <ul className="fin-trend__charts">
      {accounts.map((account) => (
        <li key={account.key}>
          <AccountChart account={account} />
        </li>
      ))}
    </ul>
  )
}

function AccountChart({ account }: { account: SeriesAccount }) {
  const amounts = account.points.map((p) => p.amount)
  const { scale, bars } = columnBars(amounts)
  const currency = account.points.find((p) => p.currency !== null)?.currency ?? null
  const latest = account.points.at(-1)
  const titleId = `fin-trend-${account.key}`

  return (
    <figure className="fin-trend__card" aria-labelledby={titleId}>
      <figcaption className="fin-trend__card-head">
        <span className="fin-trend__card-title" id={titleId}>
          {account.name}
        </span>
        <span className="fin-trend__card-latest">
          {latest ? formatChartAmount(latest.amount, latest.currency) : '값 없음'}
        </span>
      </figcaption>
      <div className="fin-trend__plot" role="img" aria-label={accountSummary(account)}>
        <span className="fin-trend__zero" style={{ bottom: `${position(scale, 0)}%` }} aria-hidden="true" />
        <span className="fin-trend__scale" aria-hidden="true">
          {formatCompactAmount(scale.max, currency)}
        </span>
        {account.points.map((point, index) => {
          const bar = bars[index]
          return (
            // --row: 막대가 순서대로 조금씩 늦게 자라게 하는 값
            <span key={point.period.rceptNo} className="fin-trend__column" style={{ '--row': index } as CSSProperties}>
              {bar === null ? (
                <span className="fin-trend__missing" aria-hidden="true">
                  —
                </span>
              ) : (
                <span
                  className={`fin-trend__bar${bar.negative ? ' fin-trend__bar--down' : ''}`}
                  style={{ bottom: `${bar.bottom}%`, height: `${bar.height}%` }}
                  aria-hidden="true"
                />
              )}
            </span>
          )
        })}
      </div>
      <ol className="fin-trend__labels" aria-hidden="true">
        {account.points.map((point) => (
          <li key={point.period.rceptNo}>{periodShortLabel(point.period)}</li>
        ))}
      </ol>
    </figure>
  )
}

function TrendTable({ series }: { series: TrendSeries }) {
  const unit = tableUnitLabel(series)
  return (
    <DataTable caption={`주요 재무 흐름 표(단위 ${unit}, 값이 없으면 —)`} density="dense">
      <thead>
        <tr>
          <th scope="col">계정 · 단위 {unit}</th>
          {series.periods.map((period) => {
            const source = period.sourceRceptNo ?? period.rceptNo
            const sourceUrl =
              source === period.rceptNo ? verifiedDartUrl(period.rceptNo, period.dartUrl) : dartViewerUrl(source)
            return (
              <th key={period.rceptNo} scope="col" className="num">
                {sourceUrl === null ? (
                  periodShortLabel(period)
                ) : (
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    {periodShortLabel(period)}
                    <span className="visually-hidden"> DART 원문 새 창으로 열기(접수번호 {source})</span>
                  </a>
                )}
                {source !== period.rceptNo && <span className="fin-trend__corrected"> 정정 공시 값</span>}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {series.accounts.map((account) => (
          <tr key={account.key}>
            <th scope="row">{account.name}</th>
            {account.points.map((point) => (
              <td key={point.period.rceptNo} className="num">
                {point.amount === null ? (
                  <>
                    <span aria-hidden="true">{formatTrendAmount(null)}</span>
                    <span className="visually-hidden">값 없음</span>
                  </>
                ) : (
                  formatTrendAmount(point.amount)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
