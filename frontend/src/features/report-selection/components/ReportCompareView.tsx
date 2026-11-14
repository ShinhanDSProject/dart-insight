import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { ComparisonBasis, ReportItem, ReportList } from '@/shared/api/reports'
import { Badge, Button, ButtonLink, FieldHint, Notice, Panel, PanelTitle, ReportStackScene } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { basisHint } from '@/shared/lib/comparisonBasis'
import { openHeaderSearch } from '@/shared/lib/headerSearch'
import { formatDate } from '@/shared/lib/reportLabels'
import { useMinimumLoadingState } from '@/shared/hooks/useMinimumLoading'
import { useCompanyReports } from '../hooks/useCompanyReports'
import { useReportSelection } from '../hooks/useReportSelection'
import { PairSelector } from './PairSelector'
import { PastAnalyses } from './PastAnalyses'
import { ReportTable } from './ReportTable'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 보고서 목록을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

const refreshErrorMessages: Record<string, string> = {
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘었어요',
  DART_REQUEST_FAILED: 'OpenDART에 연결하지 못했어요',
}

/**
 * 보고서 비교 탭(W-01 ② 보고서 선택). 고른 값은 주소에 남긴다.
 * - ?current=접수번호: 현재 보고서. 없으면 가장 최근 보고서
 * - ?basis=YOY|PREV|CUSTOM: 비교 기준. 없으면 전년 동기(잠정안)
 * - ?previous=접수번호: 직접 선택(CUSTOM)에서 고른 비교 보고서
 * 두 보고서를 고르면 비교 검증(W-01 ③, /companies/:corpCode/compare)으로 간다.
 * 배치(#549 → #840): 제목·'기업 변경' → 지금 고른 두 보고서와 '이대로 비교하기'(화면을 내리지 않아도 보임) → 지난 분석 →
 * 비교 기준과 이전·현재 보고서 카드(바꾸기) → 접어 둔 '정기보고서 목록' 표 → 주의 안내.
 */
export function ReportCompareView({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyReports(corpCode)
  const visibleState = useMinimumLoadingState(state, 900)
  // 목록이 오면 불러오는 장면(최소 900ms)이 끝나기 전에 비교 보고서를 미리 찾아 둔다
  const selection = useReportSelection(corpCode, state.status === 'success' ? state.data.items : null)

  return match(visibleState)
    .with({ status: 'loading' }, () => (
      <div className="report-compare-loading">
        <ReportStackScene label="OpenDART 정기보고서 수집 중" />
        <LoadingState message="정기보고서 목록을 불러오는 중이에요… 처음 여는 기업은 OpenDART에서 받아 오느라 조금 걸려요." />
      </div>
    ))
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
    .with({ status: 'success' }, ({ data }) => <ReportSelection corpCode={corpCode} reports={data} selection={selection} />)
    .exhaustive()
}

interface ReportSelectionProps {
  corpCode: string
  reports: ReportList
  selection: ReturnType<typeof useReportSelection>
}

function ReportSelection({ corpCode, reports, selection }: ReportSelectionProps) {
  const reportItems = reports.items
  const { current, basis, previous, lookup, retryLookup, selectCurrent, selectBasis, selectPrevious } = selection

  return (
    <section className="pick" aria-labelledby="pick-title">
      <div className="pick__head">
        <div className="pick__heading">
          <h2 className="pick__title" id="pick-title">
            비교할 보고서 두 건을 선택하세요
          </h2>
          <p className="pick__lead">현재 보고서는 기본으로 가장 최근 보고서예요.</p>
        </div>
        {/* 홈으로 가지 않고 상단 바 검색창에서 바로 다른 기업을 찾는다(#655) */}
        <Button variant="secondary" onClick={openHeaderSearch}>
          기업 변경
        </Button>
      </div>

      {reports.refreshError && (
        <Notice tone="attention" role="status">
          {refreshNotice(reports)}
        </Notice>
      )}

      {current && (
        <PairSummary
          corpCode={corpCode}
          basis={basis}
          current={current}
          previous={previous}
          searching={basis !== 'CUSTOM' && lookup.status === 'loading'}
        />
      )}

      <PastAnalyses corpCode={corpCode} />

      {current && (
        <PairSelector
          items={reportItems}
          basis={basis}
          current={current}
          previous={previous}
          lookup={lookup}
          onBasisChange={selectBasis}
          onCurrentChange={selectCurrent}
          onPreviousChange={selectPrevious}
          onRetry={retryLookup}
        />
      )}

      {/* 위 카드의 고르기 칸으로 대부분 고를 수 있어 표는 접어 둔다(#840). 보고서가 없으면 안내가 보이게 펼친다 */}
      <Panel aria-labelledby="report-list-title">
        <details className="pick__list" open={reportItems.length === 0}>
        <summary className="pick__list-head">
          <PanelTitle id="report-list-title">정기보고서 목록</PanelTitle>
          <Badge>
            {reportItems.length}
            <span className="visually-hidden">개</span>
          </Badge>
          <span className="pick__list-toggle" aria-hidden="true" />
        </summary>
        {reportItems.length === 0 ? (
          <EmptyState title="이 기업의 정기보고서가 없어요.">
            <p>
              사업·반기·분기보고서를 낸 적이 없거나 12월 결산이 아닌 회사일 수 있어요. 지금은 12월 결산 회사의 보고서만
              비교할 수 있어요.
            </p>
            <Link to="/">다른 기업 검색</Link>
          </EmptyState>
        ) : (
          <ReportTable
            items={reportItems}
            current={current}
            previous={previous}
            onSelectCurrent={(report) => selectCurrent(report.rceptNo)}
          />
        )}
        </details>
      </Panel>

      <Notice tone="attention" title="12월 결산 회사의 사업·반기·분기보고서만 비교할 수 있어요" className="pick__notice">
        대상 기간과 제출일은 따로 보여 줘요. 정정 여부를 확인하지 못하면 추정하지 않고 '확인 안 됨'으로 표시해요.
      </Notice>
    </section>
  )
}

interface PairSummaryProps {
  corpCode: string
  basis: ComparisonBasis
  current: ReportItem
  previous: ReportItem | null
  /** 비교 기준(전년 동기·직전 기간)에 맞는 이전 보고서를 서버에서 찾는 중 */
  searching: boolean
}

/**
 * 지금 고른 두 보고서와 '이대로 비교하기'(#840). 처음 온 사람이 기본값 그대로 바로 비교를 시작하게 맨 위에 둔다.
 * 비교 기준이 자동이면 '추천', 직접 골랐으면 고른 짝을 보인다. 이전 보고서가 아직 없으면 버튼 대신 고르라는 안내.
 * 자동으로 찾는 동안에는 고르라고 하지 않고 찾는 중이라고 알린다(금방 '이대로 비교하기'가 나타남).
 */
function PairSummary({ corpCode, basis, current, previous, searching }: PairSummaryProps) {
  const compareTo = `/companies/${encodeURIComponent(corpCode)}/compare?${new URLSearchParams({
    current: current.rceptNo,
    previous: previous?.rceptNo ?? '',
    basis,
  }).toString()}`
  return (
    <section className="pick-summary" aria-labelledby="pick-summary-title">
      <h3 className="pick-summary__title" id="pick-summary-title">
        {basis === 'CUSTOM' ? '이 두 보고서를 비교해요' : '이렇게 비교하는 걸 추천해요'}
      </h3>
      <p className="pick-summary__pair">
        {previous ? previous.reportName : searching ? '이전 보고서 찾는 중' : '이전 보고서 고르기 전'}
        <span className="pick-summary__arrow" aria-hidden="true">
          →
        </span>
        <span className="visually-hidden">에서</span>
        {current.reportName}
      </p>
      <p className="pick-summary__hint">{basisHint(basis)}</p>
      {previous ? (
        <div className="pick-summary__actions">
          <ButtonLink to={compareTo} variant="primary">
            이대로 비교하기 →
          </ButtonLink>
          <span className="pick-summary__more">아래에서 비교 기준이나 보고서를 바꿀 수 있어요.</span>
        </div>
      ) : searching ? (
        <FieldHint role="status">비교 기준에 맞는 이전 보고서를 찾고 있어요…</FieldHint>
      ) : (
        <FieldHint>아래에서 이전 보고서를 고르면 비교할 수 있어요.</FieldHint>
      )}
    </section>
  )
}

function refreshNotice(reports: ReportList): string {
  const reason = refreshErrorMessages[reports.refreshError ?? ''] ?? 'OpenDART에서 최신 목록을 받지 못했어요'
  const when = reports.fetchedAt ? `${formatDate(reports.fetchedAt.slice(0, 10))}에 ` : ''
  return `${reason}. ${when}받아 둔 목록을 보여 줘요.`
}
