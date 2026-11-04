import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { match } from 'ts-pattern'
import type { ChatAction, ChatCitation, ChatContext, ChatMessageResponse } from '@/shared/api/agentChat'
import type { AsyncState } from '@/shared/hooks/asyncState'
import type { ParamChanges } from '@/shared/lib/searchParams'
import { Badge, Button, Icon, Notice, PanelTitle, SidePanel, TextArea } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import type { AgentChatController } from '../hooks/useAgentChat'
import { ChatConfirmAction } from './ChatConfirmAction'
import { ChatFeedback } from './ChatFeedback'
import {
  chatActionTarget,
  citationChanges,
  citationLabel,
  citationNote,
  parseChatAnswer,
  type ChatActionTarget,
} from '../model/chatLinks'
import { CHAT_EXAMPLES, chatMessageOf, confirmKey, MAX_MESSAGE, type ChatExchange } from '../model/chatState'
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
  onClose: () => void
}

/**
 * AI 에이전트 채팅 패널(ADR-0044, 탭 밖 오른쪽). 탭을 바꿔도 열린 채로 대화를 이어 간다(AC20).
 * 답의 [1]은 근거 칩이고 누르면 그 변경·계정·원문 위치를 연다. 쓰기(노트·관심 기업)는 사용자가 확인 버튼을 누를 때만 한다(AC9).
 */
export function ChatPanel({ analysisId, chat, context, suggestions, onNavigate, onDownloadBrief, briefState, onClose }: ChatPanelProps) {
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
          <Examples questions={[...suggestions, ...CHAT_EXAMPLES].slice(0, 6)} onAsk={send} />
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
          />
        ))}
        {match(request)
          .with({ status: 'idle' }, () => null)
          .with({ status: 'sending' }, ({ message }) => (
            <>
              <UserLine message={message} />
              <p className="chat-panel__pending" role="status">
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
}

function Exchange({ exchange, analysisId, confirmed, onConfirmed, onNavigate, onDownloadBrief, briefState }: ExchangeProps) {
  const { response } = exchange
  return (
    <article className="chat-panel__exchange" aria-label={`요청: ${exchange.message}`}>
      <UserLine message={exchange.message} />
      <div className="chat-panel__answer">
        {match(response.status)
          .with('ANSWERED', () => <AnswerBody response={response} onNavigate={onNavigate} />)
          .with('NOT_FOUND', () => (
            <Notice tone="attention" title="확인된 설명 없음">
              <p>{response.message ?? '실행한 기능의 결과에서 관련 자료를 찾지 못했어요.'}</p>
            </Notice>
          ))
          .with('OUT_OF_SCOPE', () => (
            <Notice title="답하지 않는 요청이에요">
              <p>{response.message ?? '매수·매도, 목표주가, 주가 전망 같은 투자 판단에는 답하지 않아요.'}</p>
            </Notice>
          ))
          .with('REVIEW_NEEDED', () => (
            <Notice tone="attention" title="검토 필요">
              <p>{response.message ?? '답이 근거 확인을 통과하지 못해 보여 주지 않아요. 요청을 바꿔 다시 보내 주세요.'}</p>
            </Notice>
          ))
          .with('INCOMPLETE', () => (
            <Notice tone="attention" title="요청을 끝내지 못했어요">
              <p>{response.message ?? '범위를 좁혀 다시 보내 주세요.'}</p>
            </Notice>
          ))
          .exhaustive()}
        <Actions
          exchangeId={exchange.id}
          response={response}
          confirmed={confirmed}
          onConfirmed={onConfirmed}
          onNavigate={onNavigate}
          onDownloadBrief={onDownloadBrief}
          briefState={briefState}
        />
        {response.status === 'ANSWERED' && response.questionId !== null && (
          <ChatFeedback analysisId={analysisId} questionId={response.questionId} />
        )}
      </div>
    </article>
  )
}

function AnswerBody({ response, onNavigate }: { response: ChatMessageResponse; onNavigate: (c: ParamChanges) => void }) {
  const segments = parseChatAnswer(response.answer ?? '', response.citations)
  return (
    <>
      <p className="chat-panel__text">
        {segments.map((s, i) =>
          match(s)
            .with({ kind: 'text' }, ({ text }) => <span key={i}>{text}</span>)
            .with({ kind: 'citation' }, ({ citation }) => (
              <CitationChip key={i} citation={citation} onNavigate={onNavigate} />
            ))
            .exhaustive(),
        )}
      </p>
      {response.aiGenerated && (
        <p className="chat-panel__meta">
          <Badge tone="accent">AI 생성</Badge> <span>{aiInfoLabel(response.ai)}</span>
        </p>
      )}
    </>
  )
}

function CitationChip({ citation, onNavigate }: { citation: ChatCitation; onNavigate: (c: ParamChanges) => void }) {
  const changes = citationChanges(citation)
  const note = citationNote(citation)
  const label = `[${citation.no}] ${citationLabel(citation)}${note ? ` · ${note}` : ''}`
  const title = citation.quote ?? citation.sentence ?? citation.sectionPath
  if (changes === null) {
    return (
      <span className="chat-panel__citation" title={title}>
        {label}
      </span>
    )
  }
  return (
    <button type="button" className="chat-panel__citation" title={title} onClick={() => onNavigate(changes)}>
      {label}
    </button>
  )
}

type ActionsProps = { exchangeId: number; response: ChatMessageResponse } & Omit<ExchangeProps, 'exchange' | 'analysisId'>

function Actions({ exchangeId, response, confirmed, onConfirmed, onNavigate, onDownloadBrief, briefState }: ActionsProps) {
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
          action={action}
          target={target}
          done={confirmed.includes(key)}
          onDone={() => onConfirmed(key)}
          onNavigate={onNavigate}
          onDownloadBrief={onDownloadBrief}
          briefState={briefState}
        />
      ))}
    </div>
  )
}

interface ActionButtonProps {
  action: ChatAction
  target: ChatActionTarget
  /** 확인 버튼만: 이미 저장했다 */
  done: boolean
  onDone: () => void
  onNavigate: (changes: ParamChanges) => void
  onDownloadBrief: () => void
  briefState: AsyncState<void>
}

function ActionButton({ action, target, done, onDone, onNavigate, onDownloadBrief, briefState }: ActionButtonProps) {
  const [showTerm, setShowTerm] = useState(false)
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
    .with({ kind: 'glossary' }, ({ term, entry }) => (
      <div className="chat-panel__term">
        <Button variant="secondary" aria-expanded={showTerm} onClick={() => setShowTerm((v) => !v)}>
          {label}: {term}
        </Button>
        {showTerm && (
          <p className="chat-panel__term-body">
            {entry ? `${entry.term}: ${entry.definition}` : '등록된 용어가 없어요.'}
          </p>
        )}
      </div>
    ))
    .with({ kind: 'ignore' }, () => null)
    .exhaustive()
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
