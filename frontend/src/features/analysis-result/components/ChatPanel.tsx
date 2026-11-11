import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { ChatAction, ChatCitation, ChatContext, ChatCrossCheck, ChatMessageResponse } from '@/shared/api/agentChat'
import { useGlossaryTerms } from '@/shared/glossary/hooks/useGlossaryTerms'
import { findCardByKey, findCardByName } from '@/shared/glossary/model/glossaryCards'
import type { AsyncState } from '@/shared/hooks/asyncState'
import type { ParamChanges } from '@/shared/lib/searchParams'
import { Badge, Button, ButtonLink, Icon, Mascot, Notice, PanelTitle, SidePanel, TextArea } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import type { AgentChatController } from '../hooks/useAgentChat'
import { ChatConfirmAction } from './ChatConfirmAction'
import { ChatFeedback } from './ChatFeedback'
import { ChatPinAction, ChatRequestAnalysisAction } from './ChatNavigateActions'
import { GlossaryCard } from './GlossaryCard'
import {
  briefLines,
  chatActionTarget,
  citationChanges,
  citationLabel,
  citationLink,
  citationNote,
  citationTitle,
  CROSS_CHECK_NOTE,
  crossCheckView,
  parseChatAnswer,
  type ChatActionTarget,
} from '../model/chatLinks'
import { chatExamples, chatMessageOf, confirmKey, MAX_MESSAGE, type ChatExchange } from '../model/chatState'
import { aiInfoLabel } from '../model/summaryLabels'
import './chat-panel.css'

const errorMessages: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  ANALYSIS_NOT_READY: '분석이 아직 끝나지 않아 채팅을 쓸 수 없어요. 분석이 끝난 뒤 다시 와 주세요.',
  ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요.',
  COMMON_INVALID_INPUT: `요청은 2~${MAX_MESSAGE}자로 입력해 주세요.`,
}

interface ChatPanelProps {
  analysisId: number
  chat: AgentChatController
  /** 보낼 때의 화면 맥락(지금 보는 탭·고른 변경) */
  context: ChatContext
  /** 이 분석에서 답할 수 있는 예시 질문 */
  suggestions: string[]
  /** 근거 칩·이동 액션: 결과 화면 주소를 바꾼다 */
  onNavigate: (changes: ParamChanges) => void
  /** 비교 브리프 내려받기 액션 */
  onDownloadBrief: () => void
  /** 브리프 내려받기 진행 상태('내보내기' 메뉴와 같은 상태). 받는 중이면 버튼을 끄고 실패하면 알린다 */
  briefState: AsyncState<void>
  /** 글 초안 열기 액션: 커뮤니티 탭 글쓰기 칸을 초안·인용으로 채운다(저장은 사용자가 올릴 때만, AC26) */
  onPostDraft: (draft: PostDraft) => void
  onClose: () => void
}

export type PostDraft = Extract<ChatActionTarget, { kind: 'post-draft' }>

/**
 * AI 에이전트 채팅 패널(ADR-0044, 탭 밖 오른쪽). 탭을 바꿔도 열린 채로 대화를 이어 간다(AC20).
 * 답의 [1]은 근거 칩이고 누르면 그 변경·계정·원문 위치를 연다. 쓰기(노트·관심 기업)는 사용자가 확인 버튼을 누를 때만 한다(AC9).
 */
export function ChatPanel({
  analysisId,
  chat,
  context,
  suggestions,
  onNavigate,
  onDownloadBrief,
  briefState,
  onPostDraft,
  onClose,
}: ChatPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const { exchanges, request, draft } = chat.state

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  // 새 답·보내는 중 표시가 생기면 대화 끝을 보인다
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [exchanges.length, request.status])

  const send = (message: string) => chat.send(message, context)

  return (
    <SidePanel className="chat-panel" aria-labelledby="chat-panel-title" id="chat-panel" onClose={onClose}>
      <div className="chat-panel__head">
        <PanelTitle id="chat-panel-title" ref={headingRef} tabIndex={-1}>
          AI 에이전트
        </PanelTitle>
        <Button variant="secondary" onClick={onClose}>
          <Icon name="x" size={16} /> 닫기
        </Button>
      </div>
      <p className="chat-panel__privacy">
        입력한 글은 AI 서버로 보내져요. 이름·연락처 같은 개인정보는 쓰지 마세요. 투자 판단은 답하지 않아요.
      </p>

      <div className="chat-panel__log" aria-live="polite">
        {exchanges.length === 0 && request.status === 'idle' && (
          <Examples questions={chatExamples(suggestions)} onAsk={send} />
        )}
        {exchanges.map((exchange) => (
          <Exchange
            key={exchange.id}
            exchange={exchange}
            analysisId={analysisId}
            confirmed={chat.state.confirmed}
            onConfirmed={chat.markConfirmed}
            onNavigate={onNavigate}
            onDownloadBrief={onDownloadBrief}
            briefState={briefState}
            onPostDraft={onPostDraft}
            onAsk={send}
          />
        ))}
        {match(request)
          .with({ status: 'idle' }, () => null)
          .with({ status: 'sending' }, ({ message }) => (
            <>
              <UserLine message={message} />
              <p className="chat-panel__pending" role="status">
                <Mascot mood="search" />
                기능을 고르고 근거를 찾는 중이에요… 여러 번 찾으면 수십 초 걸릴 수 있어요.
              </p>
            </>
          ))
          .with({ status: 'error' }, ({ message, error }) => (
            <>
              <UserLine message={message} />
              <ErrorState error={error} onRetry={() => chat.retry(context)} messages={errorMessages} />
            </>
          ))
          .exhaustive()}
        <div ref={endRef} />
      </div>

      <ChatForm
        draft={draft}
        onDraft={chat.setDraft}
        onSend={send}
        disabled={request.status === 'sending'}
      />
    </SidePanel>
  )
}

function Examples({ questions, onAsk }: { questions: string[]; onAsk: (q: string) => void }) {
  return (
    <div className="chat-panel__examples">
      <p className="chat-panel__hint">화면에서 찾기 어려운 것을 말로 요청해 보세요.</p>
      <div className="chat-panel__chips">
        {questions.map((q) => (
          <Button key={q} variant="secondary" onClick={() => onAsk(q)}>
            {q}
          </Button>
        ))}
      </div>
    </div>
  )
}

function UserLine({ message }: { message: string }) {
  return (
    <p className="chat-panel__user">
      <span className="visually-hidden">보낸 요청: </span>
      {message}
    </p>
  )
}

interface ExchangeProps {
  exchange: ChatExchange
  analysisId: number
  /** 저장을 마친 확인 버튼(confirmKey) */
  confirmed: string[]
  onConfirmed: (key: string) => void
  onNavigate: (changes: ParamChanges) => void
  onDownloadBrief: () => void
  briefState: AsyncState<void>
  onPostDraft: (draft: PostDraft) => void
  /** 용어 카드의 이어서 묻기: 채팅에 요청을 보낸다 */
  onAsk: (message: string) => void
}

function Exchange({
  exchange,
  analysisId,
  confirmed,
  onConfirmed,
  onNavigate,
  onDownloadBrief,
  briefState,
  onPostDraft,
  onAsk,
}: ExchangeProps) {
  const { response } = exchange
  return (
    <article className="chat-panel__exchange" aria-label={`요청: ${exchange.message}`}>
      <UserLine message={exchange.message} />
      <div className="chat-panel__answer">
        {match(response.status)
          .with('ANSWERED', () => <AnswerBody response={response} onNavigate={onNavigate} onAsk={onAsk} />)
          .with('NOT_FOUND', () => (
            <div className="mascot-row">
              <Mascot mood="none" />
              <Notice tone="attention" title="확인된 설명 없음">
                <p>{response.message ?? '실행한 기능의 결과에서 관련 자료를 찾지 못했어요.'}</p>
              </Notice>
            </div>
          ))
          .with('OUT_OF_SCOPE', () => (
            <Notice title="답하지 않는 요청이에요">
              <p>{response.message ?? '매수·매도, 목표주가, 주가 전망 같은 투자 판단에는 답하지 않아요.'}</p>
            </Notice>
          ))
          .with('REVIEW_NEEDED', () => (
            <div className="mascot-row">
              <Mascot mood="none" />
              <Notice tone="attention" title="검토 필요">
                <p>{response.message ?? '답이 근거 확인을 통과하지 못해 보여 주지 않아요. 요청을 바꿔 다시 보내 주세요.'}</p>
              </Notice>
            </div>
          ))
          .with('INCOMPLETE', () => (
            <Notice tone="attention" title="요청을 끝내지 못했어요">
              <p>{response.message ?? '범위를 좁혀 다시 보내 주세요.'}</p>
            </Notice>
          ))
          .exhaustive()}
        {/* 교차 검증 결과는 코드가 정한 값이라 답이 없어도(검토 필요 등) 보인다 */}
        {response.crossCheck !== null && <CrossCheckNotice check={response.crossCheck} />}
        <Actions
          exchangeId={exchange.id}
          analysisId={analysisId}
          response={response}
          confirmed={confirmed}
          onConfirmed={onConfirmed}
          onNavigate={onNavigate}
          onDownloadBrief={onDownloadBrief}
          briefState={briefState}
          onPostDraft={onPostDraft}
          onAsk={onAsk}
        />
        {response.status === 'ANSWERED' && response.questionId !== null && (
          <ChatFeedback analysisId={analysisId} questionId={response.questionId} />
        )}
      </div>
    </article>
  )
}

interface AnswerBodyProps {
  response: ChatMessageResponse
  onNavigate: (c: ParamChanges) => void
  onAsk: (message: string) => void
}

function AnswerBody({ response, onNavigate, onAsk }: AnswerBodyProps) {
  const answer = response.answer ?? ''
  const [openTerm, setOpenTerm] = useState<string | null>(null)
  const toggleTerm = (evidenceId: string) => setOpenTerm((open) => (open === evidenceId ? null : evidenceId))
  const termCitation = response.citations.find((c) => c.kind === 'GLOSSARY' && c.evidenceId === openTerm) ?? null
  return (
    <>
      {/* 근거 인용이 있는 답에만 붙인다(화면 이동·목록 같은 답은 원문을 찾은 것이 아니다) */}
      {response.citations.length > 0 && (
        <p className="chat-panel__found">
          <Mascot mood="joy" />
          원문에서 근거를 찾았어요
        </p>
      )}
      {response.generalExplanation && (
        // 근거 없는 일반 설명은 답 위에 표시한다(ADR-0064)
        <p className="chat-panel__meta">
          <Badge tone="attention">AI 일반 설명 · 공시 근거 아님</Badge>
        </p>
      )}
      {match(response.format)
        .with('BRIEF', () => (
          // 정리 형식: 한 줄에 한 가지 내용, 줄 끝마다 근거 칩(AC24)
          <ul className="chat-panel__brief-list">
            {briefLines(answer).map((line, i) => (
              <li key={i}>
                <AnswerText
                  text={line}
                  citations={response.citations}
                  onNavigate={onNavigate}
                  openTerm={openTerm}
                  onToggleTerm={toggleTerm}
                />
              </li>
            ))}
          </ul>
        ))
        .with('CHAT', () => (
          <p className="chat-panel__text">
            <AnswerText
              text={answer}
              citations={response.citations}
              onNavigate={onNavigate}
              openTerm={openTerm}
              onToggleTerm={toggleTerm}
            />
          </p>
        ))
        .exhaustive()}
      {termCitation !== null && <CitationGlossaryCard citation={termCitation} onAsk={onAsk} />}
      {response.aiGenerated && (
        <p className="chat-panel__meta">
          <Badge tone="accent">AI 생성</Badge> <span>{aiInfoLabel(response.ai)}</span>
        </p>
      )}
    </>
  )
}

interface AnswerTextProps {
  text: string
  citations: ChatCitation[]
  onNavigate: (c: ParamChanges) => void
  /** 펼친 용어 카드 근거(evidenceId). 없으면 null */
  openTerm: string | null
  onToggleTerm: (evidenceId: string) => void
}

/** 답 글과 그 안의 근거 칩 */
function AnswerText({ text, citations, onNavigate, openTerm, onToggleTerm }: AnswerTextProps) {
  return (
    <>
      {parseChatAnswer(text, citations).map((s, i) =>
        match(s)
          .with({ kind: 'text' }, ({ text }) => <span key={i}>{text}</span>)
          .with({ kind: 'citation' }, ({ citation }) =>
            citation.kind === 'GLOSSARY' ? (
              <button
                key={i}
                type="button"
                className="chat-panel__citation"
                title={citationTitle(citation)}
                aria-expanded={openTerm === citation.evidenceId}
                onClick={() => onToggleTerm(citation.evidenceId)}
              >
                [{citation.no}] {citationLabel(citation)} · 용어 카드
              </button>
            ) : (
              <CitationChip key={i} citation={citation} onNavigate={onNavigate} />
            ),
          )
          .exhaustive(),
      )}
    </>
  )
}

/** 교차 검증 결과(AC19). 어긋남은 '검토해 볼 신호'로만 보이고 허위·오류로 단정하지 않는다 */
function CrossCheckNotice({ check }: { check: ChatCrossCheck }) {
  const view = crossCheckView(check)
  return (
    <Notice tone={view.tone} title={`교차 검증: ${view.title}`} className="chat-panel__cross-check">
      <p>{check.reason}</p>
      <p className="chat-panel__cross-check-note">{CROSS_CHECK_NOTE}</p>
    </Notice>
  )
}

function CitationChip({ citation, onNavigate }: { citation: ChatCitation; onNavigate: (c: ParamChanges) => void }) {
  const changes = citationChanges(citation)
  const note = citationNote(citation)
  const label = `[${citation.no}] ${citationLabel(citation)}${note ? ` · ${note}` : ''}`
  const title = citationTitle(citation)
  if (changes === null) {
    const link = citationLink(citation)
    if (link === null) {
      return (
        <span className="chat-panel__citation" title={title}>
          {label}
        </span>
      )
    }
    return match(link)
      .with({ kind: 'route' }, ({ to }) => (
        <Link className="chat-panel__citation" title={title} to={to}>
          {label}
        </Link>
      ))
      .with({ kind: 'external' }, ({ href }) => (
        <a className="chat-panel__citation" title={title} href={href} target="_blank" rel="noopener noreferrer">
          {label}
          <span className="visually-hidden"> (새 창에서 DART 원문 열기)</span>
        </a>
      ))
      .exhaustive()
  }
  return (
    <button type="button" className="chat-panel__citation" title={title} onClick={() => onNavigate(changes)}>
      {label}
    </button>
  )
}

type ActionsProps = { exchangeId: number; response: ChatMessageResponse } & Omit<ExchangeProps, 'exchange'>

function Actions({
  exchangeId,
  analysisId,
  response,
  confirmed,
  onConfirmed,
  onNavigate,
  onDownloadBrief,
  briefState,
  onPostDraft,
  onAsk,
}: ActionsProps) {
  // 키는 응답 actions 안의 순서로 정한다(무시한 액션을 빼도 바뀌지 않게)
  const targets = response.actions
    .map((action, index) => ({ action, key: confirmKey(exchangeId, index), target: chatActionTarget(action, response.citations) }))
    .filter(({ target }) => target.kind !== 'ignore')
  if (targets.length === 0) return null
  return (
    <div className="chat-panel__actions">
      {targets.map(({ action, key, target }) => (
        <ActionButton
          key={key}
          analysisId={analysisId}
          action={action}
          target={target}
          done={confirmed.includes(key)}
          onDone={() => onConfirmed(key)}
          onNavigate={onNavigate}
          onDownloadBrief={onDownloadBrief}
          briefState={briefState}
          onPostDraft={onPostDraft}
          onAsk={onAsk}
        />
      ))}
    </div>
  )
}

interface ActionButtonProps {
  analysisId: number
  action: ChatAction
  target: ChatActionTarget
  /** 확인 버튼만: 이미 저장했다 */
  done: boolean
  onDone: () => void
  onNavigate: (changes: ParamChanges) => void
  onDownloadBrief: () => void
  briefState: AsyncState<void>
  onPostDraft: (draft: PostDraft) => void
  onAsk: (message: string) => void
}

function ActionButton({
  analysisId,
  action,
  target,
  done,
  onDone,
  onNavigate,
  onDownloadBrief,
  briefState,
  onPostDraft,
  onAsk,
}: ActionButtonProps) {
  const label = action.label ?? '열기'
  return match(target)
    .with({ kind: 'open' }, ({ changes }) => (
      <Button variant="secondary" onClick={() => onNavigate(changes)}>
        {label}
      </Button>
    ))
    .with({ kind: 'brief' }, () => <BriefButton label={label} state={briefState} onDownload={onDownloadBrief} />)
    .with({ kind: 'save-note' }, { kind: 'favorite' }, (confirm) => (
      <ChatConfirmAction target={confirm} label={label} done={done} onDone={onDone} />
    ))
    .with({ kind: 'glossary' }, ({ term }) => <GlossaryAction label={label} term={term} onAsk={onAsk} />)
    .with({ kind: 'link' }, ({ to }) => (
      <ButtonLink variant="secondary" to={to}>
        {label}
      </ButtonLink>
    ))
    .with({ kind: 'pin' }, ({ changeId }) => <ChatPinAction analysisId={analysisId} changeId={changeId} label={label} />)
    .with({ kind: 'request-analysis' }, ({ request }) => <ChatRequestAnalysisAction request={request} label={label} />)
    .with({ kind: 'post-draft' }, (draft) => (
      <Button variant="secondary" onClick={() => onPostDraft(draft)}>
        {label}
      </Button>
    ))
    .with({ kind: 'ignore' }, () => null)
    .exhaustive()
}

/** 근거 칩(GLOSSARY)으로 펼친 용어 카드. 카드 API의 카드를 키로 찾고, 못 받았으면 근거의 한 줄 뜻·출처만 보인다 */
function CitationGlossaryCard({ citation, onAsk }: { citation: ChatCitation; onAsk: (message: string) => void }) {
  const { state } = useGlossaryTerms()
  const card = state.status === 'success' && citation.termKey ? findCardByKey(state.data, citation.termKey) : null
  const basics = { term: citation.term ?? '용어', definition: citation.definition ?? '', sources: citation.sources ?? [] }
  return <GlossaryCard card={card} basics={basics} cards={state} onAsk={onAsk} />
}

/** 용어 사전 열기 버튼(OPEN_GLOSSARY). 카드가 있으면 용어 카드를, 없으면 '등록된 용어가 없어요'(뜻을 지어내지 않음) */
function GlossaryAction({ label, term, onAsk }: { label: string; term: string; onAsk: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const { state } = useGlossaryTerms()
  const card = state.status === 'success' ? findCardByName(state.data, term) : null
  return (
    <div className="chat-panel__term">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}: {term}
      </Button>
      {open &&
        match(card)
          .with(null, () => <p className="chat-panel__term-body">등록된 용어가 없어요.</p>)
          .otherwise((found) => (
            <GlossaryCard card={found} basics={{ term: found.term, definition: found.definition, sources: found.sources }} cards={state} onAsk={onAsk} />
          ))}
    </div>
  )
}

/** 비교 브리프 내려받기. 받는 중이면 끄고, 실패하면 다시 누를 수 있게 알린다('내보내기' 메뉴와 같은 안내) */
function BriefButton({ label, state, onDownload }: { label: string; state: AsyncState<void>; onDownload: () => void }) {
  const loading = state.status === 'loading'
  return (
    <div className="chat-panel__brief">
      <Button variant="secondary" disabled={loading} aria-busy={loading} onClick={onDownload}>
        <Icon name="download" size={16} /> {loading ? '내보내는 중…' : label}
      </Button>
      {match(state)
        .with({ status: 'error' }, () => (
          <p role="alert" className="chat-panel__brief-error">
            브리프를 내려받지 못했어요. 다시 시도해 주세요.
          </p>
        ))
        .with({ status: 'idle' }, { status: 'loading' }, { status: 'success' }, () => null)
        .exhaustive()}
    </div>
  )
}

interface ChatFormProps {
  draft: string
  onDraft: (draft: string) => void
  onSend: (message: string) => void
  disabled: boolean
}

/** 입력창. Enter로 보내고 Shift+Enter로 줄을 바꾼다 */
function ChatForm({ draft, onDraft, onSend, disabled }: ChatFormProps) {
  const ready = chatMessageOf(draft) !== null
  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (ready && !disabled) onSend(draft)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }
  return (
    <form className="chat-panel__form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="chat-input">
        AI 에이전트에게 요청
      </label>
      <TextArea
        id="chat-input"
        value={draft}
        maxLength={MAX_MESSAGE}
        rows={2}
        placeholder="예: 추가된 변경만 중요도순으로 보여줘"
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button variant="primary" type="submit" disabled={!ready || disabled}>
        보내기
      </Button>
    </form>
  )
}
