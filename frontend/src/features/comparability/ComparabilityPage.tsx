import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis } from '@/shared/api/analyses'
import type { Company } from '@/shared/api/companies'
import type { ComparabilityResult } from '@/shared/api/comparability'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { companyPageTitle } from '@/shared/lib/pageTitle'
import {
  Badge,
  Button,
  ButtonLink,
  Notice,
  Page,
  PageHeader,
  Panel,
  PanelTitle,
  ReportCard,
  ReportCardPair,
} from '@/shared/ui'
import { AlertState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { checkHeader, checkStatusLabel, checkStatusTone, resultSummary, statementBasisLabel } from './model/comparabilityLabels'
import { basisLabel, parseBasis } from '@/shared/lib/comparisonBasis'
import { useComparabilityCheck } from './hooks/useComparabilityCheck'
import { useCompanyInfo } from './hooks/useCompanyInfo'
import './comparability.css'

const errorMessages: Record<string, string> = {
  REPORT_NOT_FOUND: '보고서를 찾지 못했어요. 보고서 선택으로 돌아가 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 재무제표를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 재무제표를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

/**
 * W-01 ③ 비교 검증(2.2). 주소: /companies/:corpCode/compare?current=&previous=&basis=
 * 비교할 수 없으면 분석을 시작하지 않고 사유와 다음 행동을 보여 준다('분석 실행'은 비활성).
 * 비교할 수 있으면 '분석 실행'으로 분석을 요청하고 W-02로 간다(2.3).
 * 배치(#549): 화면 머리(상태 배지) → 이전·현재 보고서 카드 → '비교 조건' 표 → 안내 상자 → '보고서 다시 선택' / '분석 실행'.
 */
export function ComparabilityPage() {
  const { corpCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const currentNo = searchParams.get('current') ?? ''
  const previousNo = searchParams.get('previous') ?? ''
  const basis = parseBasis(searchParams.get('basis'))
  const navigate = useNavigate()
  const company = useCompanyInfo(corpCode)
  useDocumentTitle(companyPageTitle(company?.corpName ?? null, '비교 확인'))
  const { state, reload } = useComparabilityCheck({ corpCode, currentRceptNo: currentNo, previousRceptNo: previousNo, basis })
  const submit = useAsyncAction<void>()
  // 요청이 끝나 다음 화면으로 넘어가는 동안에도 버튼을 다시 누르지 못하게 한다
  const submitting = submit.state.status === 'loading' || submit.state.status === 'success'
  const backTo = `/companies/${encodeURIComponent(corpCode)}?${searchParams.toString()}`
  const result = state.status === 'success' ? state.data : null
  const header = checkHeader(result)

  function runAnalysis() {
    void submit.run(async () => {
      const created = await requestAnalysis({ corpCode, currentRceptNo: currentNo, previousRceptNo: previousNo, basis })
      navigate(analysisPath(created.analysisId, created.status))
    })
  }

  return (
    <Page>
      <PageHeader
        breadcrumb={
          <>
            <Link to={backTo}>보고서 선택</Link> / 비교 조건 확인
          </>
        }
        title={header.title}
        lead={leadLine(company, result, basisLabel(basis))}
        aside={header.badge ? <Badge tone={header.badge.tone}>{header.badge.label}</Badge> : undefined}
      />

      {match(state)
        // 두 보고서가 정해지지 않으면 확인하지 않는다(idle)
        .with({ status: 'idle' }, () => (
          <AlertState title="비교할 두 보고서가 정해지지 않았어요.">
            <Link to={backTo}>보고서 선택으로 돌아가기</Link>
          </AlertState>
        ))
        .with({ status: 'loading' }, () => (
          <LoadingState message="두 보고서의 재무제표를 확인하는 중입니다… 처음 확인하는 보고서는 OpenDART에서 받아 오느라 조금 걸려요." />
        ))
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success' }, ({ data }) => <CheckResult result={data} />)
        .exhaustive()}

      {match(submit.state)
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState
            error={error}
            messages={{ ANALYSIS_NOT_COMPARABLE: '비교할 수 없는 보고서 쌍이라 분석을 시작하지 않았어요.' }}
          />
        ))
        .with({ status: P.union('idle', 'loading', 'success') }, () => null)
        .exhaustive()}
      <div className="compare-actions">
        <ButtonLink to={backTo} variant="secondary">
          보고서 다시 선택
        </ButtonLink>
        {match(state)
          .with({ status: 'success', data: { comparable: true } }, () => (
            <Button variant="primary" onClick={runAnalysis} disabled={submitting}>
              {submitting ? '분석을 요청하는 중…' : '분석 실행'}
            </Button>
          ))
          // 비교할 수 없으면 버튼은 보이되 누르지 못한다(사유는 위 안내 상자)
          .with({ status: 'success', data: { comparable: false } }, () => (
            <Button variant="primary" disabled aria-describedby="not-comparable">
              분석 실행
            </Button>
          ))
          .with({ status: P.union('idle', 'loading', 'error') }, () => null)
          .exhaustive()}
      </div>
    </Page>
  )
}

/** 부제: '기업명 · 종목코드 · 이전 → 현재 · 비교 기준'. 모르는 값은 빼고 잇는다 */
function leadLine(company: Company | null, result: ComparabilityResult | null, basis: string): string | undefined {
  const parts = [
    company?.corpName,
    company?.listed ? company.stockCode : null,
    result ? `${result.previous.reportName} → ${result.current.reportName}` : null,
    result ? basis : null,
  ].filter((part): part is string => typeof part === 'string' && part !== '')
  return parts.length === 0 ? undefined : parts.join(' · ')
}

function CheckResult({ result }: { result: ComparabilityResult }) {
  return (
    <>
      <ReportCardPair>
        <ReportCard side="previous" report={result.previous} />
        <ReportCard side="current" report={result.current} />
      </ReportCardPair>

      <Panel aria-labelledby="check-title">
        <PanelTitle id="check-title">비교 조건</PanelTitle>
        <table className="check-table">
          <caption className="visually-hidden">비교 조건 확인 결과. 항목, 내용, 결과 순입니다.</caption>
          <tbody>
            {result.checks.map((check) => (
              <tr key={check.item}>
                <th scope="row">{check.label}</th>
                <td>{check.detail}</td>
                <td className="check-table__status">
                  <Badge tone={checkStatusTone(check.status)}>{checkStatusLabel(check.status)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {result.comparable ? (
        <Notice title="비교 조건을 확인했어요" role="status" className="check-notice">
          {resultSummary(result)} 공시에서 확인할 수 없는 설명은 추정하지 않아요.
        </Notice>
      ) : (
        <Notice
          tone="blocked"
          title={`비교 불가 · ${resultSummary(result)}`}
          id="not-comparable"
          role="alert"
          className="check-notice"
        >
          <ul className="not-comparable__reasons">
            {result.reasons.map((reason, i) => (
              <li key={`${reason.code}-${i}`}>
                {reason.message} <span className="not-comparable__next">{reason.nextAction}</span>
              </li>
            ))}
          </ul>
          <p className="not-comparable__note">분석은 시작하지 않고, 다른 보고서로 대신하거나 수치를 만들어 내지 않아요.</p>
        </Notice>
      )}

      {result.comparable && (
        <Panel aria-labelledby="statements-title">
          <PanelTitle id="statements-title">비교하는 재무제표</PanelTitle>
          <ul className="statement-list">
            {result.statements.map((s) => (
              <li key={s.sjDiv} className={s.comparable ? undefined : 'statement-list__item--off'}>
                <span className="statement-list__name">{s.label}</span>
                <span>{statementBasisLabel(s)}</span>
                {s.note && <span className="statement-list__note">{s.note}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
