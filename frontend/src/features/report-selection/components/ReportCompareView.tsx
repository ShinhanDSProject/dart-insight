import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { ReportList } from '@/shared/api/reports'
import { Badge, ButtonLink, FieldHint, Notice, Panel, PanelTitle } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { formatDate } from '@/shared/lib/reportLabels'
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
 * 배치(#549): 제목·'기업 변경' → 비교 기준 → 이전·현재 보고서 카드 → '정기보고서 목록' 표 → 주의 안내 → 오른쪽 아래 주 버튼.
 */
export function ReportCompareView({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyReports(corpCode)
  const selection = useReportSelection(corpCode, state.status === 'success' ? state.data.items : null)

  return match(state)
    .with({ status: 'loading' }, () => (
      <LoadingState message="정기보고서 목록을 불러오는 중입니다… 처음 여는 기업은 OpenDART에서 받아 오느라 조금 걸려요." />
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
        <ButtonLink to="/" variant="secondary">
          기업 변경
        </ButtonLink>
      </div>

      {reports.refreshError && (
        <Notice tone="attention" role="status">
          {refreshNotice(reports)}
        </Notice>
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

      <Panel aria-labelledby="report-list-title">
        <div className="pick__list-head">
          <PanelTitle id="report-list-title">정기보고서 목록</PanelTitle>
          <Badge>
            {reportItems.length}
            <span className="visually-hidden">개</span>
          </Badge>
        </div>
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
      </Panel>

      <Notice tone="attention" title="12월 결산 회사의 사업·반기·분기보고서만 비교할 수 있어요" className="pick__notice">
        대상 기간과 제출일은 따로 보여 줘요. 정정 여부를 확인하지 못하면 추정하지 않고 '확인 안 됨'으로 표시해요.
      </Notice>

      {current && (
        <div className="pick__actions">
          {previous ? (
            <ButtonLink
              to={`/companies/${encodeURIComponent(corpCode)}/compare?${new URLSearchParams({
                current: current.rceptNo,
                previous: previous.rceptNo,
                basis,
              }).toString()}`}
              variant="primary"
            >
              선택한 보고서 비교 확인 →
            </ButtonLink>
          ) : (
            <FieldHint>이전 보고서를 고르면 비교 조건을 확인할 수 있어요.</FieldHint>
          )}
        </div>
      )}
    </section>
  )
}

function refreshNotice(reports: ReportList): string {
  const reason = refreshErrorMessages[reports.refreshError ?? ''] ?? 'OpenDART에서 최신 목록을 받지 못했어요'
  const when = reports.fetchedAt ? `${formatDate(reports.fetchedAt.slice(0, 10))}에 ` : ''
  return `${reason}. ${when}받아 둔 목록을 보여 줘요.`
}
