import { Link, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ParamChanges } from '@/shared/lib/searchParams'
import { ButtonLink, Notice, Tabs, type TabItem } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { FinancialTab } from './components/FinancialTab'
import { ComparisonContextCard } from './components/ComparisonContextCard'
import { SourceTab } from './components/SourceTab'
import { SummaryTab } from './components/SummaryTab'
import { TextTab } from './components/TextTab'
import { useAnalysis } from './hooks/useAnalysis'
import { useResultParams } from './hooks/useResultParams'
import {
  financialParamChanges,
  openChangedAccounts,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openTextList,
  sourceParamChanges,
  textParamChanges,
  type ResultParams,
  type ResultTab,
  type SourceTarget,
} from './model/resultParams'
import './analysis-result.css'

const tabs: TabItem<ResultTab>[] = [
  { value: 'summary', label: '요약·설명' },
  { value: 'financial', label: '재무 수치 변화' },
  { value: 'text', label: '문장·내용 변화' },
  { value: 'source', label: '원문 확인' },
]

/**
 * W-03 분석 결과(3.1). 화면 전체가 분석 ID 하나의 결과만 보여 주므로, 비교 기준을 바꾸면 새 분석으로 옮겨 가고
 * 이전 결과와 섞이지 않는다. 고른 탭·재무제표·보기·단위·근거 계정은 주소(?tab=&sj=&changed=&unit=&change=)에,
 * 문장 변화의 유형·정렬·근거 항목은 ?ttype=&tsort=&tc=에, 원문 확인의 보고서·항목·근거 위치는 ?doc=&section=&block=에 남긴다.
 */
export function AnalysisResultPage() {
  const { analysisId = '' } = useParams()
  const { state, reload } = useAnalysis(analysisId)
  const { params, update } = useResultParams()

  return match(state)
    .with({ status: 'loading' }, () => (
      <section className="page">
        <LoadingState message="분석 결과를 불러오는 중입니다…" />
      </section>
    ))
    .with({ status: 'error' }, ({ error }) => (
      <section className="page">
        <h1 className="page__title">분석 결과</h1>
        <ErrorState
          error={error}
          onRetry={reload}
          messages={{ ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요. 기업 검색에서 다시 시작해 주세요.' }}
        />
      </section>
    ))
    .with({ status: 'success' }, ({ data }) => <AnalysisResult analysis={data} params={params} update={update} />)
    .exhaustive()
}

interface AnalysisResultProps {
  analysis: Analysis
  params: ResultParams
  update: (changes: ParamChanges) => void
}

function AnalysisResult({ analysis, params, update }: AnalysisResultProps) {
  return (
    <section className="page">
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link to="/">기업 검색</Link> / 분석 결과 / {analysis.corpName}
      </nav>
      <div className="result-head">
        <h1 className="page__title">두 보고서 사이의 변화</h1>
        <ButtonLink to={selectionPath(analysis)} variant="secondary">
          보고서 선택 변경
        </ButtonLink>
      </div>

      {match(analysis.status)
        .with('COMPLETED', () => (
          <>
            <ComparisonContextCard analysis={analysis} />

            <Tabs label="결과 보기" items={tabs} value={params.tab} onChange={(t) => update({ tab: t })} />

            <ResultTabPanel analysis={analysis} params={params} update={update} />
          </>
        ))
        .with(P.union('PENDING', 'RUNNING', 'FAILED'), () => (
          <>
            <p className="page__lead">
              {analysis.previous.reportName} → {analysis.current.reportName}
            </p>
            <NotCompleted analysis={analysis} />
          </>
        ))
        .exhaustive()}
    </section>
  )
}

function ResultTabPanel({ analysis, params, update }: AnalysisResultProps) {
  const openSource = (target: SourceTarget) => update(openSourceChanges(target))
  return match(params.tab)
    .with('financial', () => (
      <FinancialTab
        key={analysis.analysisId}
        analysis={analysis}
        sjDiv={params.sjDiv}
        changedOnly={params.changedOnly}
        unit={params.unit}
        selectedChangeId={params.selectedChangeId}
        onChange={(c) => update(financialParamChanges(c))}
      />
    ))
    .with('summary', () => (
      <SummaryTab
        key={analysis.analysisId}
        analysis={analysis}
        onOpenFinancial={(sj, change) => update(openFinancialChanges(sj, change))}
        onOpenText={(change) => update(openTextChanges(change))}
        onOpenSource={openSource}
        onOpenChangedAccounts={(sj) => update(openChangedAccounts(sj))}
        onOpenTextList={(type) => update(openTextList(type))}
      />
    ))
    .with('text', () => (
      <TextTab
        key={analysis.analysisId}
        analysis={analysis}
        type={params.textType}
        sort={params.textSort}
        section={params.textSection}
        q={params.textQuery}
        selectedChangeId={params.selectedTextChangeId}
        onChange={(c) => update(textParamChanges(c))}
        onOpenSource={openSource}
      />
    ))
    .with('source', () => (
      <SourceTab
        key={analysis.analysisId}
        analysis={analysis}
        side={params.sourceSide}
        sectionNo={params.sourceSection}
        blockNo={params.sourceBlock}
        onChange={(c) => update(sourceParamChanges(c))}
      />
    ))
    .exhaustive()
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
