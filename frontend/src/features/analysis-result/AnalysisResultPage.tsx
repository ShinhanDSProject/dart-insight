import { useContext, useState } from 'react'
import { Link, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ParamChanges } from '@/shared/lib/searchParams'
import { Button, Icon, MenuButton, MenuItem, Notice, Page, PageHeader, Skeleton, Tabs, type TabItem } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import type { SjDiv } from '@/shared/api/results'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useRecordRecentAnalysis } from '@/shared/hooks/useRecentAnalyses'
import { useRecordCurrentCompany } from '@/shared/hooks/useCurrentCompany'
import { basisLabel } from '@/shared/lib/comparisonBasis'
import { companyOverviewLink } from '@/shared/lib/currentCompany'
import { CommunityTab } from '@/shared/community/components/CommunityTab'
import { ChatEntry } from './components/ChatEntry'
import { ChatPanel } from './components/ChatPanel'
import { ExportBriefButton } from './components/ExportBriefButton'
import { FinancialTab } from './components/FinancialTab'
import { ComparisonContextCard } from './components/ComparisonContextCard'
import { NewsTab } from './components/NewsTab'
import { OutdatedNotice } from './components/OutdatedNotice'
import { SourceTab } from './components/SourceTab'
import { SummaryTab } from './components/SummaryTab'
import { TextTab } from './components/TextTab'
import { ResultOverviewContext } from './overviewSlot'
import { useAnalysis } from './hooks/useAnalysis'
import { useAgentChat, type AgentChatController } from './hooks/useAgentChat'
import { useAskSuggestions } from './hooks/useAskSuggestions'
import { useExportBrief } from './hooks/useExportBrief'
import { useResultParams } from './hooks/useResultParams'
import { chatContextOf } from './model/chatLinks'
import { resultTabLabels, resultTitle } from './model/resultTitle'
import {
  financialParamChanges,
  openChangedAccounts,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openPriorityList,
  openTextList,
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
 * 문장 변화의 유형·정렬·근거 항목은 ?ttype=&tsort=&tc=에, 커뮤니티 탭은 ?tab=community(#575, AI 질문은 요약 탭 안이고 질문·답은 주소에 남기지 않음), 원문 확인의 보고서·항목·근거 위치는 ?doc=&section=&block=에 남긴다.
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
      <Page width="wide">
        <Skeleton label="분석 결과를 불러오는 중입니다…" shape="block" />
      </Page>
    ))
    .with({ status: 'error' }, ({ error }) => (
      <Page width="wide">
        <PageHeader title="분석 결과" />
        <ErrorState
          error={error}
          onRetry={reload}
          messages={{ ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요. 기업 검색에서 다시 시작해 주세요.' }}
        />
      </Page>
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
    <Page width="wide">
      {/* 결과 머리(#550): 분석 결과 / 기업명 → 큰 기업명 → 보고서 쌍·비교 기준·수치 기준·보고서 바꾸기, 오른쪽 위 내보내기 */}
      <PageHeader
        className="result-head"
        breadcrumb={
          <>
            분석 결과 / <Link to={companyOverviewLink(analysis.corpCode)}>{analysis.corpName}</Link>
          </>
        }
        title={analysis.corpName}
        lead={<ResultLead analysis={analysis} />}
        aside={<ExportMenu analysis={analysis} />}
      />

      {match(analysis.status)
        .with('COMPLETED', () => (
          <CompletedResult key={analysis.analysisId} analysis={analysis} params={params} update={update} />
        ))
        .with(P.union('PENDING', 'RUNNING', 'FAILED'), () => <NotCompleted analysis={analysis} />)
        .exhaustive()}
    </Page>
  )
}

/** 제목 아래 한 줄: 이전 → 현재 보고서 · 비교 기준 · 연결·별도 재무제표 · 보고서 바꾸기(보고서 선택 화면) */
function ResultLead({ analysis }: { analysis: Analysis }) {
  return (
    <span className="result-head__lead">
      <span>
        <span className="visually-hidden">이전 보고서 </span>
        {analysis.previous.reportName} <span aria-hidden="true">→</span>
        <span className="visually-hidden"> 현재 보고서</span> {analysis.current.reportName}
      </span>
      <span aria-hidden="true"> · </span>
      <span>{basisLabel(analysis.basis)}</span>
      <span aria-hidden="true"> · </span>
      <span>{analysis.fsDiv === 'OFS' ? '별도' : '연결'}재무제표</span>
      <Link className="result-head__change" to={selectionPath(analysis)}>
        보고서 바꾸기
      </Link>
    </span>
  )
}

/** 오른쪽 위 '내보내기'. 브리프 내려받기(완료된 분석만)와 인쇄를 묶는다. 표 CSV는 재무 수치 탭의 '표 설정'에 있다 */
function ExportMenu({ analysis }: { analysis: Analysis }) {
  return (
    <MenuButton label={<><Icon name="download" size={16} /> 내보내기</>} aria-label="내보내기">
      {analysis.status === 'COMPLETED' && <ExportBriefButton analysis={analysis} />}
      {/* 인쇄용 화면은 메뉴·버튼·근거 패널을 빼고 비교 맥락·지금 탭·출처를 남긴다(FS-8 R3, print.css) */}
      <MenuItem onClick={() => window.print()}>인쇄</MenuItem>
    </MenuButton>
  )
}

/**
 * 완료된 분석의 결과. AI 에이전트 채팅(ADR-0044)의 대화는 여기에 두어 탭을 바꿔도 패널과 대화가 남는다(AC20).
 * 채팅 패널은 탭 밖 오른쪽(SidePanel)이고, 근거 패널과 자리가 같아 근거를 보는 동안에는 숨긴다(대화는 남음).
 * 요약 카드·문장 변화·재무 근거의 'AI에게 묻기'는 그 요청을 지금 화면 맥락과 함께 채팅으로 보낸다.
 * 열면 검색 화면의 '최근 본 분석'(FS-7)과 왼쪽 메뉴 '지금 보는 기업'(#502)에 남긴다.
 */
function CompletedResult({ analysis, params, update }: AnalysisResultProps) {
  useRecordRecentAnalysis(analysis)
  useRecordCurrentCompany({ corpCode: analysis.corpCode, corpName: analysis.corpName, analysisId: analysis.analysisId })
  const chat = useAgentChat(analysis.analysisId)
  const [chatOpen, setChatOpen] = useState(false)
  const brief = useExportBrief(analysis)
  const { questions: suggestions, sectionCounts } = useAskSuggestions(analysis.analysisId)
  const examples = match(suggestions)
    .with({ status: 'success' }, ({ data }) => data)
    .otherwise(() => [])
  const evidenceOpen =
    (params.tab === 'financial' && params.selectedChangeId !== null) ||
    (params.tab === 'text' && params.selectedTextChangeId !== null)
  // 채팅을 열면 보던 근거 패널을 닫는다(같은 자리). 보낼 화면 맥락은 닫기 전 주소로 만든다
  const openChat = () => {
    setChatOpen(true)
    if (evidenceOpen) update({ change: null, tc: null })
  }
  const askChat = (message: string) => {
    chat.send(message, chatContextOf(params))
    openChat()
  }
  return (
    <>
      {analysis.outdated && <OutdatedNotice analysis={analysis} />}
      <ComparisonContextCard analysis={analysis} tab={params.tab} />

      {/* 스크롤해도 탭을 위에 붙여 두어 긴 결과를 내려 본 뒤에도 바로 다른 탭으로 옮긴다(#390) */}
      <div className="result-tabs">
        <Tabs label="결과 보기" items={tabs} value={params.tab} onChange={(t) => update({ tab: t })} />
      </div>

      <ResultTabPanel
        analysis={analysis}
        params={params}
        update={update}
        chat={chat}
        onAskChat={askChat}
        suggestions={examples}
        sectionCounts={sectionCounts}
      />

      {chatOpen && !evidenceOpen ? (
        <ChatPanel
          chat={chat}
          context={chatContextOf(params)}
          suggestions={examples}
          onNavigate={update}
          onDownloadBrief={brief.exportBrief}
          onClose={() => setChatOpen(false)}
        />
      ) : (
        <Button variant="primary" className="chat-launcher" onClick={openChat}>
          AI 에이전트
        </Button>
      )}
    </>
  )
}

interface ResultTabPanelProps extends AnalysisResultProps {
  chat: AgentChatController
  /** 요청을 지금 화면 맥락과 함께 채팅으로 보내고 패널을 연다 */
  onAskChat: (message: string) => void
  /** 이 분석에서 답할 수 있는 예시 질문 */
  suggestions: string[]
  /** 원문 확인 목차의 '변경 N' 배지에 쓰는 최상위 섹션별 문장 변경 건수(#313). 예시 질문과 같은 문장 변화 응답에서 온다 */
  sectionCounts: TextSectionCount[]
}

function ResultTabPanel({ analysis, params, update, chat, onAskChat, suggestions, sectionCounts }: ResultTabPanelProps) {
  const openSource = (target: SourceTarget) => update(openSourceChanges(target))
  const openText = (changeId: number) => update(openTextChanges(changeId))
  const openFinancial = (sj: SjDiv, change: number) => update(openFinancialChanges(sj, change))
  // 요약 카드, 문장 변화의 '이 항목 변화 AI에게 묻기', 재무 근거의 '이 계정 변화 AI에게 묻기'가 같이 쓴다: 채팅으로 보낸다
  const askAndOpen = onAskChat
  const asking = chat.state.request.status === 'sending'
  const returnTab = useReturnTab(params.tab)
  const renderOverview = useContext(ResultOverviewContext)
  return match(params.tab)
    // 기업 개요(#589): 기업 화면의 개요를 이 탭 줄 아래에 그대로 그린다. 바로 가기 바는 위에 붙은 탭 줄 밑에 붙는다
    .with('overview', () => <div className="result-overview">{renderOverview?.(analysis.corpCode)}</div>)
    .with('financial', () => (
      <FinancialTab
        key={analysis.analysisId}
        analysis={analysis}
        sjDiv={params.sjDiv}
        changedOnly={params.changedOnly}
        unit={params.unit}
        accountQuery={params.accountQuery}
        order={params.financialOrder}
        selectedChangeId={params.selectedChangeId}
        onChange={(c) => update(financialParamChanges(c))}
        onAsk={askAndOpen}
        asking={asking}
        onOpenSource={openSource}
        onOpenText={openText}
      />
    ))
    .with('summary', () => (
      <SummaryTab
        key={analysis.analysisId}
        analysis={analysis}
        onOpenFinancial={openFinancial}
        onOpenText={openText}
        onOpenSource={openSource}
        onOpenChangedAccounts={(sj) => update(openChangedAccounts(sj))}
        onOpenTextList={(type) => update(openTextList(type))}
        onOpenPriorityList={() => update(openPriorityList())}
        onOpenTextSection={(section) => update(openTextSection(section))}
        askPanel={<ChatEntry suggestions={suggestions} onAsk={onAskChat} disabled={asking} />}
        onAsk={askAndOpen}
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
    .with('community', () => <CommunityTab corpCode={analysis.corpCode} />)
    .with('news', () => <NewsTab corpCode={analysis.corpCode} />)
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
        onBack={() => update({ tab: returnTab })}
      />
    ))
    .exhaustive()
}

/**
 * 원문 탭의 '← 분석 결과로 돌아가기'(#550)가 갈 탭: 원문을 열기 전에 마지막으로 본 탭. 처음부터 원문 탭이면 요약.
 * 주소에 새 값을 두지 않고 화면 안에서만 기억한다. 근거 계정(change)·문장(tc)은 주소에 남아 있어 돌아가면 근거도 다시 열린다.
 */
function useReturnTab(tab: ResultTab): Exclude<ResultTab, 'source'> {
  const [last, setLast] = useState<Exclude<ResultTab, 'source'>>('summary')
  if (tab !== 'source' && tab !== last) setLast(tab)
  return last
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
