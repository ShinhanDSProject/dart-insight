import { useEffect, useId, useState } from 'react'
import { getReport, type ReportDetail } from '@/shared/api/reports'
import { DartLinkActions } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import {
  correctionLabel,
  dataStatusHelp,
  dataStatusLabel,
  formatDate,
  periodLabel,
  reportTypeLabel,
} from './reportLabels'

type DetailState = { kind: 'loading' } | { kind: 'done'; report: ReportDetail } | { kind: 'error'; error: unknown }

const errorMessages: Record<string, string> = {
  REPORT_NOT_FOUND: '보고서 정보를 찾지 못했어요. 페이지를 새로 고쳐 목록을 다시 불러와 주세요.',
}

/** W-01 ② 고른 보고서의 메타데이터(1.3). 대상 기간과 제출일을 따로 보여 주고, 모르는 값은 추정하지 않는다. */
export function ReportDetailPanel({ rceptNo, title = '현재 보고서 정보' }: { rceptNo: string; title?: string }) {
  const titleId = useId()
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getReport(rceptNo)
      .then((report) => {
        if (!cancelled) setState({ kind: 'done', report })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [rceptNo, retry])

  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId} className="panel__title">
        {title}
      </h2>
      {state.kind === 'loading' && <LoadingState message="보고서 정보를 불러오는 중입니다…" />}
      {state.kind === 'error' && (
        <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} messages={errorMessages} />
      )}
      {state.kind === 'done' && <ReportFacts report={state.report} />}
    </section>
  )
}

function ReportFacts({ report }: { report: ReportDetail }) {
  return (
    <>
      {!report.latest && (
        <div className="notice notice--attention" role="status">
          정정 공시가 나와 OpenDART 최신 목록에서 빠진 보고서예요. 최신 내용은 정정본을 확인해 주세요.
        </div>
      )}
      <dl className="facts">
        <div className="facts__row">
          <dt>보고서</dt>
          <dd>{report.reportName}</dd>
        </div>
        <div className="facts__row">
          <dt>종류</dt>
          <dd>
            {reportTypeLabel(report.reportType)} · <code>{report.disclosureType}</code>
          </dd>
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
    </>
  )
}
