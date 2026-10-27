import { useId, useState } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { DisclosureList } from '@/shared/api/disclosures'
import { formatDate } from '@/shared/lib/reportLabels'
import { Button, DataTable, DotTimeline, Notice, Panel, PanelTitle, SegmentedControl, type SegmentOption } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useCompanyDisclosures } from '../hooks/useCompanyDisclosures'
import {
  CHART_DAYS,
  CHART_TABLE_PAGE_SIZE,
  chartPoints,
  chartRows,
  defaultChartView,
  NARROW_CHART_QUERY,
  type ChartView,
} from '../model/disclosureChart'
import { compareWithReportPath } from '../model/disclosureTimeline'
import '../report-selection.css'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 1년 공시를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 1년 공시를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

const viewOptions: readonly SegmentOption<ChartView>[] = [
  { value: 'chart', label: '차트' },
  { value: 'table', label: '표로 보기' },
]

/**
 * 기업 개요 탭의 '공시 타임라인'(FS-58, #445). 최근 1년 공시를 가로 시간축·6개 묶음 줄에 점으로 놓는다.
 * 점을 누르면 DART 원문(새 창), 정기보고서는 툴팁에서 '이 보고서로 비교하기'로 보고서 비교에 연다.
 * 같은 자료를 '표로 보기'로 바꿔 볼 수 있고, 좁은 화면은 표로 시작한다. 받기에 실패해도 이 영역만 오류를 보인다.
 */
export function DisclosureChartSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyDisclosures(corpCode, CHART_DAYS)
  const titleId = useId()

  return (
    <Panel className="disclosure-chart" aria-labelledby={titleId}>
      <PanelTitle id={titleId}>공시 타임라인</PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="최근 1년 공시를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success' }, ({ data }) => <DisclosureChart corpCode={corpCode} list={data} />)
        .exhaustive()}
    </Panel>
  )
}

function DisclosureChart({ corpCode, list }: { corpCode: string; list: DisclosureList }) {
  const [view, setView] = useState<ChartView>(() => defaultChartView(window.matchMedia?.(NARROW_CHART_QUERY).matches ?? false))
  const period = `${formatDate(list.from)} ~ ${formatDate(list.to)}`
  const source = <DartSourceLine detail={`OpenDART 공시검색 · 기준 기간 ${period} 접수(정정 전 공시는 빼고 최종본만)`} />

  if (list.items.length === 0) {
    return (
      <>
        <EmptyState title="최근 1년 공시 없음">
          <p>{period}에 이 기업이 낸 공시를 찾지 못했어요.</p>
        </EmptyState>
        {source}
      </>
    )
  }

  return (
    <div className="disclosure-chart__body">
      <div className="disclosure-chart__head">
        <p className="panel__note">
          최근 1년 공시 {list.items.length}건을 접수일과 묶음으로 놓았어요. 점을 누르면 DART 원문이 새 창으로 열려요.
        </p>
        <SegmentedControl aria-label="보기" options={viewOptions} value={view} onChange={setView} />
      </div>
      {list.refreshError && (
        <Notice tone="attention" role="status">
          OpenDART에서 최신 공시를 받지 못해 받아 둔 목록으로 보여 드려요.
        </Notice>
      )}
      {match(view)
        .with('chart', () => (
          <DotTimeline
            label={`최근 1년 공시 타임라인(${period})`}
            rows={chartRows(list.groups)}
            points={chartPoints(corpCode, list.items)}
            from={list.from}
            to={list.to}
            emphasisLabel="정기보고서"
            otherLabel="그 밖의 공시"
          />
        ))
        .with('table', () => <DisclosureChartTable corpCode={corpCode} list={list} period={period} />)
        .exhaustive()}
      <p className="panel__note">묶음은 공시 제목의 낱말로 나눈 것이라 실제 내용과 다를 수 있어요. 원문으로 확인해 주세요.</p>
      {source}
    </div>
  )
}

function DisclosureChartTable({ corpCode, list, period }: { corpCode: string; list: DisclosureList; period: string }) {
  const [limit, setLimit] = useState(CHART_TABLE_PAGE_SIZE)
  const tableId = useId()
  const shown = list.items.slice(0, limit)
  const remaining = list.items.length - shown.length

  return (
    <>
      <DataTable id={tableId} caption={`최근 1년 공시(${period}), 접수일이 최근인 순서`} density="dense">
        <thead>
          <tr>
            <th scope="col">접수일</th>
            <th scope="col">묶음</th>
            <th scope="col">공시</th>
            <th scope="col">원문</th>
            <th scope="col">비교</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => (
            <tr key={item.rceptNo}>
              <td>
                <time dateTime={item.receivedDate}>{formatDate(item.receivedDate)}</time>
              </td>
              <td>{item.groupLabel}</td>
              <td>{item.reportName}</td>
              <td>
                <DartLinkInline rceptNo={item.rceptNo} dartUrl={item.dartUrl} label={item.reportName} />
              </td>
              <td>
                {item.periodic && (
                  <Link to={compareWithReportPath(corpCode, item.rceptNo)}>
                    이 보고서로 비교하기<span className="visually-hidden"> ({item.reportName})</span>
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {remaining > 0 && (
        <div className="disclosure-chart__more">
          <Button variant="link" aria-controls={tableId} onClick={() => setLimit((n) => n + CHART_TABLE_PAGE_SIZE)}>
            더 보기 ({Math.min(remaining, CHART_TABLE_PAGE_SIZE)}건 / 남은 {remaining}건)
          </Button>
        </div>
      )}
    </>
  )
}
