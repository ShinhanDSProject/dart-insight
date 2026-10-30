import { match } from 'ts-pattern'
import type { ReportDetail as ReportDetailData } from '@/shared/api/reports'
import { Notice } from '@/shared/ui'
import { DartLinkActions } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import {
  correctionLabel,
  dataStatusHelp,
  dataStatusLabel,
  formatDate,
  periodLabel,
  reportTypeLabel,
} from '@/shared/lib/reportLabels'
import { useReportDetail } from '../hooks/useReportDetail'

const errorMessages: Record<string, string> = {
  REPORT_NOT_FOUND: '보고서 정보를 찾지 못했어요. 페이지를 새로 고쳐 목록을 다시 불러와 주세요.',
}

/**
 * W-01 ② 고른 보고서의 메타데이터(1.3). 이전·현재 보고서 카드 안에 붙는다(#549).
 * 대상 기간과 제출일을 따로 보여 주고, 모르는 값은 추정하지 않는다.
 * 보고서 이름·대상 기간·제출일·정정 여부·자료 상태는 카드·표와 겹쳐서 '보고서 자세히'에 접어 둔다.
 * 정정본으로 대체된 보고서라는 안내와 불러오기 오류는 접지 않는다.
 */
export function ReportDetail({ rceptNo }: { rceptNo: string }) {
  const { state, reload } = useReportDetail(rceptNo)
  return match(state)
    .with({ status: 'loading' }, () => <LoadingState message="보고서 정보를 불러오는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
    .with({ status: 'success' }, ({ data }) => <ReportFacts report={data} />)
    .exhaustive()
}

function ReportFacts({ report }: { report: ReportDetailData }) {
  return (
    <>
      {!report.latest && (
        <Notice tone="attention" role="status">
          정정 공시가 나와 OpenDART 최신 목록에서 빠진 보고서예요. 최신 내용은 정정본을 확인해 주세요.
        </Notice>
      )}
      <details className="report-detail">
        <summary>보고서 자세히</summary>
        <dl className="facts">
          <div className="facts__row">
            <dt>보고서</dt>
            <dd>{report.reportName}</dd>
          </div>
          <div className="facts__row">
            <dt>종류</dt>
            <dd>{reportTypeLabel(report.reportType)}</dd>
          </div>
          <div className="facts__row">
            <dt>대상 기간</dt>
            <dd>{periodLabel(report)}</dd>
          </div>
          <div className="facts__row">
            <dt>제출일</dt>
            <dd>{formatDate(report.receivedAt)}</dd>
          </div>
          <div className="facts__row">
            <dt>정정 여부</dt>
            <dd>
              {correctionLabel(report.correction)}
              {report.remark && <span className="facts__meta"> · 비고 '{report.remark}'</span>}
            </dd>
          </div>
          <div className="facts__row">
            <dt>제출인</dt>
            <dd>{report.filerName ?? '확인 안 됨'}</dd>
          </div>
          <div className="facts__row">
            <dt>재무 자료</dt>
            <dd>
              {dataStatusLabel(report.financialDataStatus)}
              <span className="facts__meta"> · {dataStatusHelp[report.financialDataStatus]}</span>
            </dd>
          </div>
          <div className="facts__row">
            <dt>접수번호</dt>
            <dd>
              <code>{report.rceptNo}</code>
            </dd>
          </div>
        </dl>
        <DartLinkActions rceptNo={report.rceptNo} dartUrl={report.dartUrl} />
      </details>
    </>
  )
}
