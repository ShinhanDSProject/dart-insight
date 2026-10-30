import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { getReportPair, type ComparisonBasis, type ReportItem } from '@/shared/api/reports'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { basisOptions } from '@/shared/lib/comparisonBasis'
import { correctionLabel, formatDate, periodLabel, reportTypeLabel } from '@/shared/lib/reportLabels'
import { FieldHint, FieldLabel, Notice, SegmentedControl, Term } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState } from '@/shared/ui/StateView'
import type { ResultTab } from '../model/resultParams'
import { OtherAnalyses } from './OtherAnalyses'

/**
 * 결과 머리 아래의 비교 맥락(FS-4 R5, #550). 보고서 쌍·비교 기준·수치 기준은 머리 한 줄에 있으므로,
 * 여기에는 비교 기준 바꾸기(전년 동기·직전 기간·직접 선택)·이 기업의 다른 분석과 접수번호·보고서별 상세(종류·대상 기간·제출일·정정 여부·원문)·
 * 분석 한계를 '비교 기준 바꾸기·보고서 자세히'에 접어 둔다. 모든 탭 위에 놓이므로 접힌 한 줄로 둔다.
 */
export function ComparisonContextCard({ analysis, tab }: { analysis: Analysis; tab: ResultTab }) {
  const fsDivLabel = analysis.fsDiv === 'OFS' ? '별도' : '연결'
  return (
    <section className="context-card" aria-label="비교 맥락">
      <details className="context-card__details">
        <summary>비교 기준 바꾸기 · 보고서 자세히</summary>
        <div className="context-card__body">
          <BasisSwitcher analysis={analysis}>
            <span className="context-card__fs">
              수치 기준: <Term name="fsDiv">{fsDivLabel}</Term> 재무제표
            </span>
          </BasisSwitcher>
          {/* 분석을 옮기면 펼침 상태를 새로 시작한다 */}
          <OtherAnalyses key={analysis.analysisId} corpCode={analysis.corpCode} analysisId={analysis.analysisId} tab={tab} />
          <div className="context-card__facts">
            <ReportFacts role="이전 보고서" report={analysis.previous} withTerms />
            <ReportFacts role="현재 보고서" report={analysis.current} />
          </div>
          <p className="context-card__note">
            금액은 보고서 통화 기준이고, 단위는 재무 수치 탭의 '표 설정'에서 바꿀 수 있어요 · 분석 한계: 비교할 수치가 없는 항목은 계산하지 않아요.
          </p>
        </div>
      </details>
    </section>
  )
}

function ReportFacts({ role, report, withTerms = false }: { role: string; report: ReportItem; withTerms?: boolean }) {
  return (
    <section className="context-card__fact-group" aria-label={`${role} 상세`}>
      <p className="context-card__role">{role}</p>
      <dl className="context-card__fact-list">
        <div>
          <dt>{withTerms ? <Term name="rceptNo">접수번호</Term> : '접수번호'}</dt>
          <dd>{report.rceptNo}</dd>
        </div>
        <div>
          <dt>종류</dt>
          <dd>{reportTypeLabel(report.reportType)}</dd>
        </div>
        <div>
          <dt>대상 기간</dt>
          <dd>{periodLabel(report)}</dd>
        </div>
        <div>
          <dt>제출일</dt>
          <dd>{formatDate(report.receivedAt)}</dd>
        </div>
        <div>
          <dt>{withTerms ? <Term name="correction">정정 여부</Term> : '정정 여부'}</dt>
          <dd>{correctionLabel(report.correction)}</dd>
        </div>
        <div>
          <dt>원문</dt>
          <dd>
            <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** 비교 기준 전환. 현재 보고서는 그대로 두고 비교 보고서만 바꿔 새 분석을 연다. */
function BasisSwitcher({ analysis, children }: { analysis: Analysis; children?: ReactNode }) {
  const navigate = useNavigate()
  // 새 분석으로 옮겨 가면 null, 비교 기준에 맞는 이전 보고서가 없으면 그 안내 문장으로 끝난다
  const request = useAsyncAction<string | null>()
  const busy = request.state.status === 'loading'

  function switchTo(basis: ComparisonBasis) {
    if (basis === analysis.basis) return
    if (basis === 'CUSTOM') {
      request.reset()
      navigate(`/companies/${encodeURIComponent(analysis.corpCode)}?${new URLSearchParams({
        current: analysis.current.rceptNo,
        basis: 'CUSTOM',
      }).toString()}`)
      return
    }
    void request.run(async () => {
      const pair = await getReportPair(analysis.corpCode, basis, analysis.current.rceptNo)
      if (!pair.previous) {
        return pair.reason?.message ?? '비교 기준에 맞는 이전 보고서가 없어요.'
      }
      const created = await requestAnalysis({
        corpCode: analysis.corpCode,
        currentRceptNo: analysis.current.rceptNo,
        previousRceptNo: pair.previous.rceptNo,
        basis,
      })
      navigate(analysisPath(created.analysisId, created.status))
      return null
    })
  }

  return (
    <div className="context-card__basis">
      <div className="context-card__basis-row">
        <FieldLabel as="span" id="result-basis-label">
          비교 기준
        </FieldLabel>
        <SegmentedControl
          aria-labelledby="result-basis-label"
          options={basisOptions}
          value={analysis.basis}
          disabled={busy}
          onChange={switchTo}
        />
        {children}
        <FieldHint>{busy ? '새 비교를 준비하는 중…' : '바꾸면 요약·수치·문장·근거가 같은 보고서 쌍으로 함께 바뀌어요.'}</FieldHint>
      </div>
      {match(request.state)
        .with({ status: 'success', data: P.string }, ({ data: message }) => (
          <Notice as="p" tone="attention" role="status">
            {message}
          </Notice>
        ))
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState
            error={error}
            messages={{ ANALYSIS_NOT_COMPARABLE: '그 비교 기준의 보고서 쌍은 비교할 수 없어요. 보고서 선택에서 확인해 주세요.' }}
          />
        ))
        .with({ status: P.union('idle', 'loading', 'success') }, () => null)
        .exhaustive()}
    </div>
  )
}
