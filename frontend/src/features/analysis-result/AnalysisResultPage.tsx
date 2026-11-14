import { useResultTour } from '@/shared/hooks/useResultTour'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ParamChanges } from '@/shared/lib/searchParams'
import {
  Button,
  Icon,
  MenuButton,
  MenuItem,
  Notice,
  Page,
  PageHeader,
  PageReveal,
  Skeleton,
  Tabs,
  type TabItem,
} from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { OPEN_CHAT_INPUT_EVENT } from '@/shared/lib/shortcuts'
import type { SjDiv } from '@/shared/api/results'
import type { TextSectionCount } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { useRevealReady } from '@/shared/hooks/useRevealReady'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useRecordRecentAnalysis } from '@/shared/hooks/useRecentAnalyses'
import { useRecordCurrentCompany } from '@/shared/hooks/useCurrentCompany'
import { communityDraftParamChanges } from '@/shared/lib/communityQuoteLink'
import { basisLabel } from '@/shared/lib/comparisonBasis'
import { companyOverviewLink } from '@/shared/lib/currentCompany'
import { CommunityTab, type CommunityDraft } from '@/shared/community/components/CommunityTab'
import { ChatPanel, type PostDraft } from './components/ChatPanel'
import { focusChatInput } from './model/chatInput'
import { ExportBriefButton } from './components/ExportBriefButton'
import { FinancialTab } from './components/FinancialTab'
import { ComparisonContextCard } from './components/ComparisonContextCard'
import { NewsTab } from './components/NewsTab'
import { OutdatedNotice } from './components/OutdatedNotice'
import { ResultTour } from './components/ResultTour'
import { SourceTab } from './components/SourceTab'
import { SourceViewSwitch } from './components/SourceViewSwitch'
import { SummaryTab } from './components/SummaryTab'
import { TextTab } from './components/TextTab'
import { ActivityTab } from './components/ActivityTab'
import { ResultOverviewContext, ResultReportsContext } from './overviewSlot'
import { useAnalysis } from './hooks/useAnalysis'
import { useAgentChat, type AgentChatController } from './hooks/useAgentChat'
import { useAskSuggestions } from './hooks/useAskSuggestions'
import { useExportBrief } from './hooks/useExportBrief'
import { useResultParams } from './hooks/useResultParams'
import { chatContextOf } from './model/chatLinks'
import { resultTabLabels, resultTitle } from './model/resultTitle'
import {
  financialParamChanges,
  isLegacyAskTab,
  openChangedAccounts,
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  openPriorityList,
  openTextList,
  openTextSection,
  reportSelectionSeed,
  resultTabBar,
  tabBarValue,
  type SourceView,
  sourceParamChanges,
  summaryParamChanges,
  textParamChanges,
  type ResultParams,
  type ResultTab,
  type SourceTarget,
} from './model/resultParams'
import './analysis-result.css'

const tabs: TabItem<ResultTab>[] = resultTabBar.map((value) => ({ value, label: resultTabLabels[value] }))

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

  return (
    // 분석과 첫 탭의 주요 데이터가 응답한 뒤 머리 → 비교 맥락 → 탭 → 내용 순으로 한 번에 떠오른다(#960)
    <PageReveal fallback={<ResultSkeleton />}>
      <AnalysisState state={state} onRetry={reload} params={params} update={update} />
    </PageReveal>
  )
}

function ResultSkeleton() {
  return (
    <Page width="wide">
      <Skeleton label="분석 결과를 불러오는 중입니다…" shape="block" />
    </Page>
  )
}

interface AnalysisStateProps {
  state: LoadState<Analysis>
  onRetry: () => void
  params: ResultParams
  update: (changes: ParamChanges) => void
}

function AnalysisState({ state, onRetry, params, update }: AnalysisStateProps) {
  useRevealReady(state.status !== 'loading')
  return match(state)
    .with({ status: 'loading' }, () => <ResultSkeleton />)
    .with({ status: 'error' }, ({ error }) => (
      <Page width="wide">
        <PageHeader title="분석 결과" />
        <ErrorState
          error={error}
          onRetry={onRetry}
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
    <Page width="wide" className="result-page">
      {/* 결과 머리(#550): 분석 결과 / 기업명 → 큰 기업명 → 보고서 쌍·비교 기준·수치 기준, 오른쪽 위 내보내기. 보고서는 '보고서 선택' 탭에서 바꾼다(#659) */}
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

/** 제목 아래 한 줄: 이전 → 현재 보고서 · 비교 기준 · 연결·별도 재무제표 */
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
 * 열면 검색 화면의 '최근 본 분석'(FS-7)과 상단 '최근 본 기업'(#502, #652)에 남긴다.
 */
function CompletedResult({ analysis, params, update }: AnalysisResultProps) {
  useRecordRecentAnalysis(analysis)
  useRecordCurrentCompany({ corpCode: analysis.corpCode, corpName: analysis.corpName, analysisId: analysis.analysisId })
  const chat = useAgentChat(analysis.analysisId)
  // 예전 AI 질문 탭 주소(?tab=ask)로 들어오면 패널을 열고 주소는 요약 탭으로 바꾼다(#579)
  const [search] = useSearchParams()
  const [chatOpen, setChatOpen] = useState(() => isLegacyAskTab(search))
  useEffect(() => {
    if (isLegacyAskTab(search)) update({ tab: 'summary' })
  }, [search, update])
  const brief = useExportBrief(analysis)
  const tour = useResultTour()
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
  // 'A' 단축키·요약의 'AI에게 묻기': 패널을 열고 입력창에 초점을 둔다. 이미 열려 있으면 초점만 옮긴다
  const [chatFocus, setChatFocus] = useState<'heading' | 'input'>('heading')
  const openChatInput = () => {
    if (chatOpen && !evidenceOpen) {
      focusChatInput()
      return
    }
    setChatFocus('input')
    openChat()
  }
  const openChatInputRef = useRef(openChatInput)
  useEffect(() => {
    openChatInputRef.current = openChatInput
  })
  useEffect(() => {
    const onOpen = () => openChatInputRef.current()
    window.addEventListener(OPEN_CHAT_INPUT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CHAT_INPUT_EVENT, onOpen)
  }, [])
  // 패널을 닫으면 초점을 다시 'AI 에이전트' 버튼으로 돌린다(패널이 사라지며 초점이 문서 맨 위로 떨어지지 않게)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const focusLauncher = useRef(false)
  useEffect(() => {
    if (chatOpen || !focusLauncher.current) return
    focusLauncher.current = false
    launcherRef.current?.focus()
  }, [chatOpen])
  const askChat = (message: string) => {
    chat.send(message, chatContextOf(params))
    openChat()
  }
  // 채팅의 글 초안 열기(#584): 커뮤니티 탭 글쓰기 칸을 초안으로 채운다. 본문은 주소에 넣지 않고(최대 2,000자) 화면 상태로 넘기며,
  // 인용은 기존 인용 쿼리로 붙인다(앞 초안의 인용 쿼리는 지움). 초안은 커뮤니티 탭이 한 번 적용하면 비워서
  // 탭을 나갔다 오거나 게시한 뒤에 다시 채우지 않는다. 같은 초안을 다시 눌러도 칸을 다시 채우도록 번호는 계속 올린다
  const [postDraft, setPostDraft] = useState<CommunityDraft | null>(null)
  const draftSeq = useRef(0)
  const openPostDraft = (draft: PostDraft) => {
    draftSeq.current += 1
    setPostDraft({ body: draft.body, key: draftSeq.current })
    update({ tab: 'community', ...communityDraftParamChanges(draft.quote) })
  }
  const clearPostDraft = useCallback(() => setPostDraft(null), [])
  return (
    <>
      <ComparisonContextCard analysis={analysis} tab={params.tab} />
      {/* 기업·보고서 제목을 먼저 보이고 안내는 그 아래에 둔다(#821) */}
      {analysis.outdated && <OutdatedNotice analysis={analysis} />}

      {/* 스크롤해도 탭을 위에 붙여 두어 긴 결과를 내려 본 뒤에도 바로 다른 탭으로 옮긴다(#390) */}
      <div className="result-tabs">
        <Tabs label="결과 보기" items={tabs} value={tabBarValue(params.tab)} onChange={(t) => update({ tab: t })} />
      </div>
      {/* 처음 열었을 때만 보는 순서를 짧게 안내한다(#842). 이용 안내에서 다시 볼 수 있다 */}
      {tour.visible && <ResultTour onGoTab={(tab) => update({ tab })} onOpenChat={openChat} onFinish={tour.finish} />}

      <ResultTabPanel
        analysis={analysis}
        params={params}
        update={update}
        chat={chat}
        onAskChat={askChat}
        onOpenChat={openChatInput}
        sectionCounts={sectionCounts}
        postDraft={postDraft}
        onPostDraftApplied={clearPostDraft}
      />

      {chatOpen && !evidenceOpen ? (
        <ChatPanel
          analysisId={analysis.analysisId}
          chat={chat}
          context={chatContextOf(params)}
          suggestions={examples}
          onNavigate={update}
          onDownloadBrief={brief.exportBrief}
          briefState={brief.state}
          onPostDraft={openPostDraft}
          initialFocus={chatFocus}
          onClose={() => {
            setChatOpen(false)
            setChatFocus('heading')
            focusLauncher.current = true
          }}
        />
      ) : (
        <Button variant="primary" className="chat-launcher" onClick={openChat} ref={launcherRef}>
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
  /** AI 에이전트 패널을 열고 입력창에 초점을 둔다(요약 핵심 카드의 'AI에게 묻기') */
  onOpenChat: () => void
  /** 원문 확인 목차의 '변경 N' 배지에 쓰는 최상위 섹션별 문장 변경 건수(#313). 예시 질문과 같은 문장 변화 응답에서 온다 */
  sectionCounts: TextSectionCount[]
  /** 채팅에서 연 글 초안(커뮤니티 탭 글쓰기 칸). 없으면 null */
  postDraft: CommunityDraft | null
  /** 커뮤니티 탭이 초안을 글쓰기 칸에 채웠을 때(초안은 한 번만 적용) */
  onPostDraftApplied: () => void
}

function ResultTabPanel({
  analysis,
  params,
  update,
  chat,
  onAskChat,
  onOpenChat,
  sectionCounts,
  postDraft,
  onPostDraftApplied,
}: ResultTabPanelProps) {
  const openSource = (target: SourceTarget) => update(openSourceChanges(target))
  const openText = (changeId: number) => update(openTextChanges(changeId))
  const openFinancial = (sj: SjDiv, change: number) => update(openFinancialChanges(sj, change))
  // 요약 카드, 문장 변화의 '이 항목 변화 AI에게 묻기', 재무 근거의 '이 계정 변화 AI에게 묻기'가 같이 쓴다: 채팅으로 보낸다
  const askAndOpen = onAskChat
  const asking = chat.state.request.status === 'sending'
  const returnTab = useReturnTab(params.tab)
  const renderOverview = useContext(ResultOverviewContext)
  const renderReports = useContext(ResultReportsContext)
  // '보고서 선택' 탭을 처음 열면 이 분석의 보고서 쌍을 고른 값으로 둔다(#659). 탭 줄·단축키·주소 어디로 와도 같다
  const [search] = useSearchParams()
  const seed = params.tab === 'reports' ? reportSelectionSeed(analysis, search) : null
  useEffect(() => {
    if (seed !== null) update(seed)
  }, [seed, update])
  return (
    <div key={params.tab} className="tab-transition">
      {match(params.tab)
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
            onOpenChat={onOpenChat}
            onAsk={askAndOpen}
            asking={asking}
            lens={params.summaryLens}
            view={params.summaryView}
            onChangeLens={(change) => update(summaryParamChanges(change))}
          />
        ))
        // 공시 분석(ADR-0067): 두 보고서 사이 활동과 앞으로의 영향. 바뀐 문장 전체 목록은 원문 탭의 바뀐 곳(text)에 있다
        .with('activity', () => (
          <ActivityTab
            key={analysis.analysisId}
            analysis={analysis}
            onOpenText={openText}
            onOpenFinancial={(item) => openFinancial(item.sjDiv, item.changeId)}
            onOpenAll={() => update(openTextList(null))}
          />
        ))
        // 원문 탭: 맨 위 전환으로 원문 읽기(source)와 바뀐 곳(text)을 오간다(사용자 결정 2026-11-11)
        .with('text', () => (
          <>
            <SourceViewSwitch value="text" onChange={(tab) => update({ tab })} />
            <TextTab
            key={analysis.analysisId}
            analysis={analysis}
            type={params.textType}
            sort={params.textSort}
            section={params.textSection}
            q={params.textQuery}
            risk={params.textRisk}
            field={params.textField}
            pinned={params.textPinned}
            selectedChangeId={params.selectedTextChangeId}
            detailId={params.textDetailId}
            onChange={(c) => update(textParamChanges(c))}
            onOpenSource={openSource}
            onAsk={askAndOpen}
            asking={asking}
          />
          </>
        ))
        .with('community', () => <CommunityTab corpCode={analysis.corpCode} draft={postDraft} onDraftApplied={onPostDraftApplied} />)
        .with('news', () => <NewsTab corpCode={analysis.corpCode} />)
        // 보고서 선택(#659): 기업 화면의 보고서 비교를 탭 줄 아래에 그린다. 고른 값을 넣기 전에는 그리지 않아 가장 최근 보고서가 잠깐 골라지지 않는다
        .with('reports', () => (seed === null ? renderReports?.(analysis.corpCode) : null))
        .with('source', () => (
          <>
            <SourceViewSwitch value="source" onChange={(tab) => update({ tab })} />
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
          </>
        ))
        .exhaustive()}
    </div>
  )
}

/**
 * 원문 탭의 '← 분석 결과로 돌아가기'(#550)가 갈 탭: 원문 탭(원문 읽기·바뀐 곳)을 열기 전에 마지막으로 본 탭. 처음부터 원문 탭이면 요약.
 * 주소에 새 값을 두지 않고 화면 안에서만 기억한다. 근거 계정(change)·문장(tc)은 주소에 남아 있어 돌아가면 근거도 다시 열린다.
 */
function useReturnTab(tab: ResultTab): Exclude<ResultTab, SourceView> {
  const [last, setLast] = useState<Exclude<ResultTab, SourceView>>('summary')
  if (tab !== 'source' && tab !== 'text' && tab !== last) setLast(tab)
  return last
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
