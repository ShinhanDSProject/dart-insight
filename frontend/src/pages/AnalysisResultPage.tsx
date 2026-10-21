import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { analysisPath, getAnalysis, requestAnalysis, type Analysis } from '../api/analyses'
import { getReportPair, type ComparisonBasis } from '../api/reports'
import type { SjDiv } from '../api/results'
import { DartLinkActions } from '../components/DartLink'
import { ErrorState, LoadingState } from '../components/StateView'
import { basisOptions } from './company/pairSelection'
import { FinancialTab } from './result/FinancialTab'
import { ReportPairCards } from './result/ReportPairCards'
import { parseUnit } from './result/format'
import './result/result.css'

type PageState = { kind: 'loading' } | { kind: 'done'; analysis: Analysis } | { kind: 'error'; error: unknown }

type Tab = 'summary' | 'financial' | 'text' | 'source'

const tabs: { value: Tab; label: string }[] = [
  { value: 'summary', label: '요약·설명' },
  { value: 'financial', label: '재무 수치 변화' },
  { value: 'text', label: '문장·내용 변화' },
  { value: 'source', label: '원문 확인' },
]

const sjDivs: SjDiv[] = ['BS', 'IS', 'CIS', 'CF', 'SCE']

/**
 * W-03 분석 결과(3.1). 화면 전체가 분석 ID 하나의 결과만 보여 주므로, 비교 기준을 바꾸면 새 분석으로 옮겨 가고
 * 이전 결과와 섞이지 않는다. 고른 탭·재무제표·보기·단위는 주소(?tab=&sj=&changed=&unit=)에 남긴다.
 */
export function AnalysisResultPage() {
  const { analysisId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getAnalysis(analysisId)
      .then((analysis) => {
        if (!cancelled) setState({ kind: 'done', analysis })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysisId, retry])

  if (state.kind === 'loading') {
    return (
      <section className="page">
        <LoadingState message="분석 결과를 불러오는 중입니다…" />
      </section>
    )
  }
  if (state.kind === 'error') {
    return (
      <section className="page">
        <h1 className="page__title">분석 결과</h1>
        <ErrorState
          error={state.error}
          onRetry={() => setRetry((n) => n + 1)}
          messages={{ ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요. 기업 검색에서 다시 시작해 주세요.' }}
        />
      </section>
    )
  }

  const { analysis } = state
  const tabParam = searchParams.get('tab')
  const tab: Tab = tabs.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'financial'
  const sjParam = searchParams.get('sj')
  const sjDiv: SjDiv = sjDivs.includes(sjParam as SjDiv) ? (sjParam as SjDiv) : 'BS'
  const changedOnly = searchParams.get('changed') === '1'
  const unit = parseUnit(searchParams.get('unit'))

  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <section className="page">
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link to="/">기업 검색</Link> / 분석 결과 / {analysis.corpName}
      </nav>
      <div className="result-head">
        <div>
          <h1 className="page__title">두 보고서 사이의 변화</h1>
          <p className="page__lead">
            {analysis.previous.reportName} → {analysis.current.reportName}
          </p>
        </div>
        <Link to={selectionPath(analysis)} className="button button--secondary">
          보고서 선택 변경
        </Link>
      </div>

      {analysis.status !== 'COMPLETED' ? (
        <NotCompleted analysis={analysis} />
      ) : (
        <>
          <ReportPairCards previous={analysis.previous} current={analysis.current} />
          <BasisSwitcher analysis={analysis} />

          <nav className="result-tabs" aria-label="결과 보기">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                className="result-tabs__item"
                aria-current={tab === t.value ? 'page' : undefined}
                onClick={() => update({ tab: t.value })}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'financial' && (
            <FinancialTab
              key={analysis.analysisId}
              analysis={analysis}
              sjDiv={sjDiv}
              changedOnly={changedOnly}
              unit={unit}
              onChange={(c) =>
                update({
                  ...(c.sj !== undefined ? { sj: c.sj } : {}),
                  ...(c.changed !== undefined ? { changed: c.changed ? '1' : null } : {}),
                  ...(c.unit !== undefined ? { unit: c.unit } : {}),
                })
              }
            />
          )}
          {tab === 'summary' && (
            <ComingLater title="요약·설명" issue="3.2 근거 기반 요약·설명(M2)">
              원문 근거가 있는 변화만 골라 요약하는 기능은 다음 단계(M2)에서 붙어요. 지금은 '재무 수치 변화'에서 계정별
              증감을 확인할 수 있어요.
            </ComingLater>
          )}
          {tab === 'text' && (
            <ComingLater title="문장·내용 변화" issue="2.5 본문·표 변경 탐지, 3.9 본문 변경 탭(M2)">
              본문 문장과 표의 추가·삭제·수정은 원문 구조화(4.2) 뒤에 비교해요. 지금은 '원문 확인'에서 두 보고서 원문을 열어
              볼 수 있어요.
            </ComingLater>
          )}
          {tab === 'source' && (
            <div className="source-grid">
              <section className="panel" aria-label="비교 보고서 원문">
                <h2 className="panel__title">비교 보고서 · {analysis.previous.reportName}</h2>
                <DartLinkActions rceptNo={analysis.previous.rceptNo} dartUrl={analysis.previous.dartUrl} />
              </section>
              <section className="panel" aria-label="현재 보고서 원문">
                <h2 className="panel__title">현재 보고서 · {analysis.current.reportName}</h2>
                <DartLinkActions rceptNo={analysis.current.rceptNo} dartUrl={analysis.current.dartUrl} />
              </section>
              <p className="panel__note">원문 안의 근거 위치로 바로 이동하는 기능은 3.5(M2)에서 붙어요.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function selectionPath(analysis: Analysis): string {
  const params = new URLSearchParams({ current: analysis.current.rceptNo, basis: analysis.basis })
  if (analysis.basis === 'CUSTOM') params.set('previous', analysis.previous.rceptNo)
  return `/companies/${encodeURIComponent(analysis.corpCode)}?${params.toString()}`
}

function NotCompleted({ analysis }: { analysis: Analysis }) {
  const failed = analysis.status === 'FAILED'
  return (
    <div className={failed ? 'not-comparable' : 'notice'} role="status">
      <p>{failed ? '분석하지 못했어요. 진행 화면에서 사유를 보고 다시 요청할 수 있어요.' : '분석이 아직 끝나지 않았어요.'}</p>
      <Link to={`/analyses/${analysis.analysisId}/progress`}>진행 화면으로 가기</Link>
    </div>
  )
}

/** 비교 기준 전환. 현재 보고서는 그대로 두고 비교 보고서만 바꿔 새 분석을 연다. */
function BasisSwitcher({ analysis }: { analysis: Analysis }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  async function switchTo(basis: ComparisonBasis) {
    if (basis === analysis.basis) return
    setMessage(null)
    setError(null)
    if (basis === 'CUSTOM') {
      navigate(`/companies/${encodeURIComponent(analysis.corpCode)}?${new URLSearchParams({
        current: analysis.current.rceptNo,
        basis: 'CUSTOM',
      }).toString()}`)
      return
    }
    setBusy(true)
    try {
      const pair = await getReportPair(analysis.corpCode, basis, analysis.current.rceptNo)
      if (!pair.previous) {
        setMessage(pair.reason?.message ?? '비교 기준에 맞는 이전 보고서가 없어요.')
        return
      }
      const created = await requestAnalysis({
        corpCode: analysis.corpCode,
        currentRceptNo: analysis.current.rceptNo,
        previousRceptNo: pair.previous.rceptNo,
        basis,
      })
      navigate(analysisPath(created.analysisId, created.status))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="basis-bar" aria-label="비교 기준">
      <div className="basis-bar__row">
        <span className="pair__label" id="result-basis-label">
          비교 기준
        </span>
        <div className="segmented" role="group" aria-labelledby="result-basis-label">
          {basisOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              className="segmented__item"
              aria-pressed={analysis.basis === o.value}
              disabled={busy}
              onClick={() => void switchTo(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="pair__hint">
          {busy ? '새 비교를 준비하는 중…' : '바꾸면 요약·수치·문장·근거가 같은 보고서 쌍으로 함께 바뀌어요.'}
        </span>
      </div>
      <p className="panel__note">
        수치 기준: {analysis.fsDiv === 'OFS' ? '별도' : '연결'} 재무제표 · 분석 한계: 비교할 수치가 없는 항목은 계산하지 않아요.
      </p>
      {message && (
        <p className="notice notice--attention" role="status">
          {message}
        </p>
      )}
      {error !== null && (
        <ErrorState
          error={error}
          messages={{ ANALYSIS_NOT_COMPARABLE: '그 비교 기준의 보고서 쌍은 비교할 수 없어요. 보고서 선택에서 확인해 주세요.' }}
        />
      )}
    </section>
  )
}

function ComingLater({ title, issue, children }: { title: string; issue: string; children: ReactNode }) {
  return (
    <section className="panel coming-later" aria-label={title}>
      <h2 className="panel__title">{title}</h2>
      <p>{children}</p>
      <p className="panel__note">관련 작업: {issue}</p>
    </section>
  )
}
