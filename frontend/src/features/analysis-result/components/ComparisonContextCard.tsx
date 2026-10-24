import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { getReportPair, type ComparisonBasis, type ReportItem } from '@/shared/api/reports'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { basisOptions } from '@/shared/lib/comparisonBasis'
import { correctionLabel, formatDate, periodLabel, reportTypeLabel } from '@/shared/lib/reportLabels'
import { Card, FieldHint, FieldLabel, Notice, SegmentedControl, Term } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState } from '@/shared/ui/StateView'

/**
 * 결과 화면 위쪽의 비교 맥락 카드(FS-4 R5). 회사, 이전 → 현재 보고서, 비교 기준, 수치 기준, 원문 링크를 한 카드에 두고
 * 보고서별 상세(종류·대상 기간·제출일·정정 여부·원문)는 '보고서 자세히'에 접어 둔다.
 */
export function ComparisonContextCard({ analysis }: { analysis: Analysis }) {
  return (
    <Card as="section" className="context-card" aria-label="비교 맥락">
      <p className="context-card__corp">{analysis.corpName}</p>
      <div className="context-card__pair">
        <ReportName role="이전 보고서" report={analysis.previous} withTerms />
        <span className="context-card__arrow" aria-hidden="true">
          →
        </span>
        <ReportName role="현재 보고서" report={analysis.current} />
      </div>
      <BasisSwitcher analysis={analysis} />
      <p className="context-card__note">
        수치 기준: <Term name="fsDiv">{analysis.fsDiv === 'OFS' ? '별도' : '연결'}</Term> 재무제표 · 금액은 보고서 통화 기준이고, 단위는 재무 수치
        변화에서 바꿀 수 있어요 · 분석 한계: 비교할 수치가 없는 항목은 계산하지 않아요.
      </p>
      <details className="context-card__details">
        <summary>보고서 자세히</summary>
        <div className="context-card__facts">
          <ReportFacts role="이전 보고서" report={analysis.previous} withTerms />
          <ReportFacts role="현재 보고서" report={analysis.current} />
        </div>
      </details>
    </Card>
  )
}

/** withTerms: 한 화면에 같은 용어 풀이를 한 번만 붙이려고, 처음 나오는(이전 보고서) 쪽에만 켠다 */
function ReportName({ role, report, withTerms = false }: { role: string; report: ReportItem; withTerms?: boolean }) {
  return (
    <p className="context-card__report">
      <span className="context-card__role">{role}</span>
      <span className="context-card__name">{report.reportName}</span>
      <span className="context-card__meta">
        {withTerms ? <Term name="rceptNo">접수번호</Term> : '접수번호'} {report.rceptNo} · 원문{' '}
        <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={`${role} ${report.reportName}`} />
      </span>
    </p>
  )
}

function ReportFacts({ role, report, withTerms = false }: { role: string; report: ReportItem; withTerms?: boolean }) {
  return (
    <section className="context-card__fact-group" aria-label={`${role} 상세`}>
      <p className="context-card__role">{role}</p>
      <dl className="context-card__fact-list">
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
function BasisSwitcher({ analysis }: { analysis: Analysis }) {
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
