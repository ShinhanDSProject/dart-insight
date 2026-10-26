import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { ReportList } from '@/shared/api/reports'
import { ButtonLink, FieldHint, Notice, Panel, PanelTitle } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { formatDate } from '@/shared/lib/reportLabels'
import { useCompanyReports } from '../hooks/useCompanyReports'
import { useReportSelection } from '../hooks/useReportSelection'
import { PairSelector } from './PairSelector'
import { PastAnalyses } from './PastAnalyses'
import { ReportDetailPanel } from './ReportDetailPanel'
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
    <>
      <p className="page__lead">비교할 두 보고서를 고르세요. 현재 보고서는 기본으로 가장 최근 보고서예요.</p>

      {reports.refreshError && (
        <Notice tone="attention" role="status">
          {refreshNotice(reports)}
        </Notice>
      )}

      <PastAnalyses corpCode={corpCode} />

      <Panel as="div">
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
        {/* 다음 단계 버튼은 긴 보고서 목록 위에 둔다(목록 아래면 길게 스크롤해야 찾음) */}
        {current && (
          <div className="pair-actions">
            {previous ? (
              <ButtonLink
                to={`/companies/${encodeURIComponent(corpCode)}/compare?${new URLSearchParams({
                  current: current.rceptNo,
                  previous: previous.rceptNo,
                  basis,
                }).toString()}`}
                variant="primary"
              >
                비교 조건 확인 →
              </ButtonLink>
            ) : (
              <FieldHint>비교 보고서를 고르면 비교 조건을 확인할 수 있어요.</FieldHint>
            )}
          </div>
        )}
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
        <p className="panel__note">
          대상 기간과 제출일은 따로 보여 줘요. 정정 여부를 확인하지 못하면 추정하지 않고 '확인 안 됨'으로 표시해요.
          <br />
          12월 결산 회사의 사업·반기·분기보고서만 비교할 수 있어요.
        </p>
      </Panel>

      {current && (
        <div className="pair-details">
          {previous ? (
            <ReportDetailPanel key={previous.rceptNo} rceptNo={previous.rceptNo} title="비교 보고서 정보" />
          ) : (
            <Panel>
              <PanelTitle>비교 보고서 정보</PanelTitle>
              <p className="panel__note">비교 보고서를 고르면 종류·대상 기간·제출일·정정 여부를 여기서 확인할 수 있어요.</p>
            </Panel>
          )}
          <ReportDetailPanel key={current.rceptNo} rceptNo={current.rceptNo} title="현재 보고서 정보" />
        </div>
      )}
    </>
  )
}

function refreshNotice(reports: ReportList): string {
  const reason = refreshErrorMessages[reports.refreshError ?? ''] ?? 'OpenDART에서 최신 목록을 받지 못했어요'
  const when = reports.fetchedAt ? `${formatDate(reports.fetchedAt.slice(0, 10))}에 ` : ''
  return `${reason}. ${when}받아 둔 목록을 보여 줘요.`
}
