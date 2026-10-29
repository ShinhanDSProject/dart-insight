import { Link, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ParamChanges } from '@/shared/lib/searchParams'
import { Button, ButtonLink, Notice, Skeleton, Tabs, type TabItem } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import type { SjDiv } from '@/shared/api/results'
import type { TextSectionCount } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useRecordRecentAnalysis } from '@/shared/hooks/useRecentAnalyses'
import { AskTab } from './components/AskTab'
import { FinancialTab } from './components/FinancialTab'
import { ComparisonContextCard } from './components/ComparisonContextCard'
import { OtherAnalyses } from './components/OtherAnalyses'
import { OutdatedNotice } from './components/OutdatedNotice'
import { SourceTab } from './components/SourceTab'
import { SummaryTab } from './components/SummaryTab'
import { TextTab } from './components/TextTab'
import { useAnalysis } from './hooks/useAnalysis'
import { useAsk, type AskController } from './hooks/useAsk'
import { useAskSuggestions } from './hooks/useAskSuggestions'
import { useResultParams } from './hooks/useResultParams'
import { resultTabLabels, resultTitle } from './model/resultTitle'
import {
  financialParamChanges,
  openChangedAccounts,
  openAsk,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openTextList,
  openTextSearch,
  openTextSection,
  resultTabs,
  sourceParamChanges,
  summaryParamChanges,
  textParamChanges,
  type ResultParams,
  type ResultTab,
  type SourceTarget,
} from './model/resultParams'
import './analysis-result.css'

const tabs: TabItem<ResultTab>[] = resultTabs.map((value) => ({ value, label: resultTabLabels[value] }))

/**
 * W-03 분석 결과(3.1). 화면 전체가 분석 ID 하나의 결과만 보여 주므로, 비교 기준을 바꾸면 새 분석으로 옮겨 가고
 * 이전 결과와 섞이지 않는다. 고른 탭·재무제표·보기·단위·근거 계정은 주소(?tab=&sj=&changed=&unit=&change=)에,
 * 문장 변화의 유형·정렬·근거 항목은 ?ttype=&tsort=&tc=에, AI 질문 탭은 ?tab=ask(질문·답은 주소에 남기지 않음), 원문 확인의 보고서·항목·근거 위치는 ?doc=&section=&block=에 남긴다.
 */
export function AnalysisResultPage() {
  const { analysisId = '' } = useParams()
  const { state, reload } = useAnalysis(analysisId)
  const { params, update } = useResultParams()
  useDocumentTitle(
    resultTitle(
      match(state)
        .with({ status: 'success' }, ({ data }) => data)
        .with({ status: P.union('loading', 'error') }, () => null)
        .exhaustive(),
      params.tab,
    ),
  )

  return match(state)
    .with({ status: 'loading' }, () => (
      <section className="page">
        <Skeleton label="분석 결과를 불러오는 중입니다…" shape="block" />
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
        <div className="result-head__actions">
          {/* 분석을 옮기면 펼침 상태를 새로 시작한다 */}
          <OtherAnalyses
            key={analysis.analysisId}
            corpCode={analysis.corpCode}
            analysisId={analysis.analysisId}
            tab={params.tab}
          />
          <ButtonLink to={selectionPath(analysis)} variant="secondary">
            보고서 선택 변경
          </ButtonLink>
          {/* 인쇄용 화면은 메뉴·버튼·근거 패널을 빼고 비교 맥락·지금 탭·출처를 남긴다(FS-8 R3, print.css) */}
          <Button onClick={() => window.print()}>인쇄</Button>
        </div>
      </div>

      {match(analysis.status)
        .with('COMPLETED', () => (
          <CompletedResult key={analysis.analysisId} analysis={analysis} params={params} update={update} />
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

/**
 * 완료된 분석의 결과. AI 질문의 상태와 예시 질문은 여기에 두어, 요약 진입 카드와 AI 질문 탭이 같이 쓰고
 * 다른 탭에 다녀와도 받은 답·보내는 질문이 남는다. 열면 검색 화면의 '최근 본 분석'에 남긴다(FS-7).
 */
function CompletedResult({ analysis, params, update }: AnalysisResultProps) {
  useRecordRecentAnalysis(analysis)
  const ask = useAsk(analysis.analysisId)
  const { questions: suggestions, sections: askSections, sectionCounts } = useAskSuggestions(analysis.analysisId)
  return (
    <>
      {analysis.outdated && <OutdatedNotice analysis={analysis} />}
      <ComparisonContextCard analysis={analysis} />

      {/* 스크롤해도 탭을 위에 붙여 두어 긴 결과를 내려 본 뒤에도 바로 다른 탭으로 옮긴다(#390) */}
      <div className="result-tabs">
        <Tabs label="결과 보기" items={tabs} value={params.tab} onChange={(t) => update({ tab: t })} />
      </div>

      <ResultTabPanel
        analysis={analysis}
        params={params}
        update={update}
        ask={ask}
        suggestions={suggestions}
        askSections={askSections}
        sectionCounts={sectionCounts}
      />
    </>
  )
}

interface ResultTabPanelProps extends AnalysisResultProps {
  ask: AskController
  suggestions: LoadState<string[]>
  /** 입력 중 섹션 질문 제안에 쓰는 최상위 섹션 제목(#267) */
  askSections: string[]
  /** 원문 확인 목차의 '변경 N' 배지에 쓰는 최상위 섹션별 문장 변경 건수(#313). 예시 질문과 같은 문장 변화 응답에서 온다 */
  sectionCounts: TextSectionCount[]
}

function ResultTabPanel({ analysis, params, update, ask, suggestions, askSections, sectionCounts }: ResultTabPanelProps) {
  const openSource = (target: SourceTarget) => update(openSourceChanges(target))
  const openFinancial = (sj: SjDiv, change: number) => update(openFinancialChanges(sj, change))
  // 요약의 예시 질문, 문장 변화의 '이 항목 변화 AI에게 묻기', 재무 근거의 '이 계정 변화 AI에게 묻기'가 같이 쓴다: 질문을 보내고 AI 질문 탭으로 옮긴다
  const askAndOpen = (question: string) => {
    ask.ask(question)
    update(openAsk())
  }
  const asking = ask.state.request.status === 'sending'
  return match(params.tab)
    .with('financial', () => (
      <FinancialTab
        key={analysis.analysisId}
        analysis={analysis}
        sjDiv={params.sjDiv}
        changedOnly={params.changedOnly}
        unit={params.unit}
        accountQuery={params.accountQuery}
        selectedChangeId={params.selectedChangeId}
        onChange={(c) => update(financialParamChanges(c))}
        onAsk={askAndOpen}
        asking={asking}
      />
    ))
    .with('summary', () => (
      <SummaryTab
        key={analysis.analysisId}
        analysis={analysis}
        onOpenFinancial={openFinancial}
        onOpenText={(change) => update(openTextChanges(change))}
        onOpenSource={openSource}
        onOpenChangedAccounts={(sj) => update(openChangedAccounts(sj))}
        onOpenTextList={(type) => update(openTextList(type))}
        onOpenTextSection={(section) => update(openTextSection(section))}
        suggestions={suggestions}
        onAsk={askAndOpen}
        onOpenAsk={() => update(openAsk())}
        asking={asking}
        lens={params.summaryLens}
        view={params.summaryView}
        onChangeLens={(change) => update(summaryParamChanges(change))}
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
        risk={params.textRisk}
        pinned={params.textPinned}
        selectedChangeId={params.selectedTextChangeId}
        onChange={(c) => update(textParamChanges(c))}
        onOpenSource={openSource}
        onAsk={askAndOpen}
        asking={asking}
      />
    ))
    .with('ask', () => (
      <AskTab
        analysis={analysis}
        ask={ask}
        suggestions={suggestions}
        sections={askSections}
        onOpenSource={openSource}
        onOpenFinancial={openFinancial}
        onSearchText={(q) => update(openTextSearch(q))}
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
        sectionCounts={sectionCounts}
        onOpenTextSection={(section) => update(openTextSection(section))}
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
