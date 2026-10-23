import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { analysisPath, getAnalysis, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { getReportPair, type ComparisonBasis } from '@/shared/api/reports'
import type { SjDiv } from '@/shared/api/results'
import type { DocumentSide } from '@/shared/api/documents'
import type { ChangeType, TextSort } from '@/shared/api/textChanges'
import { ButtonLink, FieldHint, FieldLabel, Notice, SegmentedControl, Tabs, type TabItem } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { basisOptions } from '@/shared/lib/comparisonBasis'
import { FinancialTab } from './components/FinancialTab'
import { ReportPairCards } from './components/ReportPairCards'
import { SourceTab } from './components/SourceTab'
import { SummaryTab } from './components/SummaryTab'
import { TextTab } from './components/TextTab'
import { parseUnit } from './model/format'
import './analysis-result.css'

type PageState = { kind: 'loading' } | { kind: 'done'; analysis: Analysis } | { kind: 'error'; error: unknown }

type Tab = 'summary' | 'financial' | 'text' | 'source'

const tabs: TabItem<Tab>[] = [
  { value: 'summary', label: '요약·설명' },
  { value: 'financial', label: '재무 수치 변화' },
  { value: 'text', label: '문장·내용 변화' },
  { value: 'source', label: '원문 확인' },
]

const sjDivs: SjDiv[] = ['BS', 'IS', 'CIS', 'CF', 'SCE']
const changeTypes: ChangeType[] = ['ADDED', 'DELETED', 'MODIFIED', 'REVIEW_NEEDED']

/**
 * W-03 분석 결과(3.1). 화면 전체가 분석 ID 하나의 결과만 보여 주므로, 비교 기준을 바꾸면 새 분석으로 옮겨 가고
 * 이전 결과와 섞이지 않는다. 고른 탭·재무제표·보기·단위·근거 계정은 주소(?tab=&sj=&changed=&unit=&change=)에,
 * 문장 변화의 유형·정렬·근거 항목은 ?ttype=&tsort=&tc=에, 원문 확인의 보고서·항목·근거 위치는 ?doc=&section=&block=에 남긴다.
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
  const tab: Tab = tabs.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'summary'
  const sjParam = searchParams.get('sj')
  const sjDiv: SjDiv = sjDivs.includes(sjParam as SjDiv) ? (sjParam as SjDiv) : 'BS'
  const changedOnly = searchParams.get('changed') === '1'
  const unit = parseUnit(searchParams.get('unit'))
  const changeParam = Number(searchParams.get('change'))
  const selectedChangeId = Number.isInteger(changeParam) && changeParam > 0 ? changeParam : null
  const ttypeParam = searchParams.get('ttype')
  const textType: ChangeType | null = changeTypes.includes(ttypeParam as ChangeType) ? (ttypeParam as ChangeType) : null
  const textSort: TextSort = searchParams.get('tsort') === 'document' ? 'document' : 'priority'
  const tcParam = Number(searchParams.get('tc'))
  const selectedTextChangeId = Number.isInteger(tcParam) && tcParam > 0 ? tcParam : null
  const sourceSide: DocumentSide = searchParams.get('doc') === 'previous' ? 'previous' : 'current'
  const sourceSection = positiveInt(searchParams.get('section'))
  const sourceBlock = positiveInt(searchParams.get('block'))

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
        <ButtonLink to={selectionPath(analysis)} variant="secondary">
          보고서 선택 변경
        </ButtonLink>
      </div>

      {analysis.status !== 'COMPLETED' ? (
        <NotCompleted analysis={analysis} />
      ) : (
        <>
          <ReportPairCards previous={analysis.previous} current={analysis.current} />
          <BasisSwitcher analysis={analysis} />

          <Tabs label="결과 보기" items={tabs} value={tab} onChange={(t) => update({ tab: t })} />

          {tab === 'financial' && (
            <FinancialTab
              key={analysis.analysisId}
              analysis={analysis}
              sjDiv={sjDiv}
              changedOnly={changedOnly}
              unit={unit}
              selectedChangeId={selectedChangeId}
              onChange={(c) =>
                update({
                  // 재무제표를 바꾸면 보던 근거를 닫는다
                  ...(c.sj !== undefined ? { sj: c.sj, change: null } : {}),
                  ...(c.change !== undefined ? { change: c.change === null ? null : String(c.change) } : {}),
                  ...(c.changed !== undefined ? { changed: c.changed ? '1' : null } : {}),
                  ...(c.unit !== undefined ? { unit: c.unit } : {}),
                })
              }
            />
          )}
          {tab === 'summary' && (
            <SummaryTab
              key={analysis.analysisId}
              analysis={analysis}
              onOpenFinancial={(sj, change) => update({ tab: 'financial', sj, change: String(change), changed: null })}
              onOpenText={(change) => update({ tab: 'text', ttype: null, tsort: null, tc: String(change) })}
              onOpenSource={(target) =>
                update({
                  tab: 'source',
                  doc: target.side,
                  section: String(target.section),
                  block: target.block === null ? null : String(target.block),
                })
              }
            />
          )}
          {tab === 'text' && (
            <TextTab
              key={analysis.analysisId}
              analysis={analysis}
              type={textType}
              sort={textSort}
              selectedChangeId={selectedTextChangeId}
              onChange={(c) =>
                update({
                  // 거르기·정렬을 바꾸면 보던 근거를 닫는다
                  ...(c.type !== undefined ? { ttype: c.type, tc: null } : {}),
                  ...(c.sort !== undefined ? { tsort: c.sort === 'priority' ? null : c.sort, tc: null } : {}),
                  ...(c.change !== undefined ? { tc: c.change === null ? null : String(c.change) } : {}),
                })
              }
              onOpenSource={(target) =>
                update({
                  tab: 'source',
                  doc: target.side,
                  section: String(target.section),
                  block: target.block === null ? null : String(target.block),
                })
              }
            />
          )}
          {tab === 'source' && (
            <SourceTab
              key={analysis.analysisId}
              analysis={analysis}
              side={sourceSide}
              sectionNo={sourceSection}
              blockNo={sourceBlock}
              onChange={(c) =>
                update({
                  ...(c.side !== undefined ? { doc: c.side } : {}),
                  ...(c.section !== undefined ? { section: c.section === null ? null : String(c.section) } : {}),
                  ...(c.block !== undefined ? { block: c.block === null ? null : String(c.block) } : {}),
                })
              }
            />
          )}
        </>
      )}
    </section>
  )
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n > 0 ? n : null
}

function selectionPath(analysis: Analysis): string {
  const params = new URLSearchParams({ current: analysis.current.rceptNo, basis: analysis.basis })
  if (analysis.basis === 'CUSTOM') params.set('previous', analysis.previous.rceptNo)
  return `/companies/${encodeURIComponent(analysis.corpCode)}?${params.toString()}`
}

function NotCompleted({ analysis }: { analysis: Analysis }) {
  const failed = analysis.status === 'FAILED'
  return (
    <Notice tone={failed ? 'blocked' : 'info'} role="status">
      <p>{failed ? '분석하지 못했어요. 진행 화면에서 사유를 보고 다시 요청할 수 있어요.' : '분석이 아직 끝나지 않았어요.'}</p>
      <Link to={`/analyses/${analysis.analysisId}/progress`}>진행 화면으로 가기</Link>
    </Notice>
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
        <FieldLabel as="span" id="result-basis-label">
          비교 기준
        </FieldLabel>
        <SegmentedControl
          aria-labelledby="result-basis-label"
          options={basisOptions}
          value={analysis.basis}
          disabled={busy}
          onChange={(basis) => void switchTo(basis)}
        />
        <FieldHint>{busy ? '새 비교를 준비하는 중…' : '바꾸면 요약·수치·문장·근거가 같은 보고서 쌍으로 함께 바뀌어요.'}</FieldHint>
      </div>
      <p className="panel__note">
        수치 기준: {analysis.fsDiv === 'OFS' ? '별도' : '연결'} 재무제표 · 분석 한계: 비교할 수치가 없는 항목은 계산하지 않아요.
      </p>
      {message && (
        <Notice as="p" tone="attention" role="status">
          {message}
        </Notice>
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
