import { useCallback, useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { AnswerFeedback, QuestionAnswer, QuestionCitation, QuestionFact } from '@/shared/api/questions'
import type { SjDiv } from '@/shared/api/results'
import { cx } from '@/shared/lib/cx'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { Badge, Button, Card, Chip, Notice, type BadgeTone } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useAnswerFeedback } from '../hooks/useAnswerFeedback'
import { FEEDBACK_REASONS, feedbackStatusLabel } from '../model/answerFeedback'
import { factLabel, parseAnswer } from '../model/answerText'
import { askedAtLabel, citationSideLabel, quoteLabel } from '../model/askQuestion'
import { answerCopyText } from '../model/copyText'
import { formatCount } from '../model/overview'
import type { SourceTarget } from '../model/resultParams'
import { aiInfoLabel } from '../model/summaryLabels'
import { CopyWithSourcesButton } from './CopyWithSourcesButton'

export interface AnswerLinks {
  onOpenSource: (target: SourceTarget) => void
  onOpenFinancial: (sjDiv: SjDiv, changeId: number) => void
  /** 찾지 못한 질문을 문장 변화 탭에서 이어서 찾는다 */
  onSearchText: (question: string) => void
}

/** 질문 줄. 모든 카드 맨 위에 같은 모양으로 둔다 */
function QuestionLine({ id, question, time }: { id: string; question: string; time?: string }) {
  return (
    <header className="answer-card__head">
      <p className="answer-card__question" id={id}>
        <span className="answer-card__q" aria-hidden="true">
          Q
        </span>
        <span>{question}</span>
      </p>
      {time && <span className="answer-card__time">{time}</span>}
    </header>
  )
}

/** 답을 기다리는 동안. 질문을 먼저 보이고 아래에 찾는 중 자리를 둔다 */
export function PendingAnswerCard({ question }: { question: string }) {
  return (
    <Card as="article" className="answer-card answer-card--pending" aria-labelledby="ask-pending-q" aria-busy="true">
      <QuestionLine id="ask-pending-q" question={question} />
      <div className="answer-pending" role="status">
        <span className="answer-pending__label">
          <span className="answer-pending__dot" aria-hidden="true" />
          원문에서 찾는 중…
        </span>
        <span className="answer-pending__line ask-skeleton" aria-hidden="true" />
        <span className="answer-pending__line ask-skeleton" aria-hidden="true" />
        <span className="answer-pending__line answer-pending__line--short ask-skeleton" aria-hidden="true" />
      </div>
    </Card>
  )
}

const errorMessages: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  ANALYSIS_NOT_READY: '분석이 아직 끝나지 않아 물어볼 수 없어요.',
  ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요.',
  COMMON_INVALID_INPUT: '질문은 2~200자로 입력해 주세요.',
}

/** 질문을 보내지 못함. 같은 질문을 다시 보낼 수 있다 */
export function FailedAnswerCard({ question, error, onRetry }: { question: string; error: unknown; onRetry: () => void }) {
  return (
    <Card as="article" className="answer-card" aria-labelledby="ask-failed-q">
      <QuestionLine id="ask-failed-q" question={question} />
      <ErrorState error={error} onRetry={onRetry} messages={errorMessages} />
    </Card>
  )
}

/** 답 평가를 저장한다(3.12). 실패하면 거부된 Promise */
export type SendFeedback = (questionId: number, feedback: AnswerFeedback) => Promise<unknown>

/** 받은 답 하나. 상태마다 다른 안내를 보인다 */
export function AnswerCard({ item, links, onFeedback }: { item: QuestionAnswer; links: AnswerLinks; onFeedback: SendFeedback }) {
  const headId = `ask-q-${item.questionId}`
  return (
    <Card as="article" className="answer-card" aria-labelledby={headId}>
      <QuestionLine id={headId} question={item.question} time={askedAtLabel(item.createdAt)} />
      {match(item.status)
        .with('ANSWERED', () => <AnsweredBody item={item} links={links} onFeedback={onFeedback} />)
        .with('NOT_FOUND', () => (
          <Notice tone="attention" className="answer-card__notice" title="관련 내용을 찾지 못했어요">
            <p>{item.message ?? '두 보고서에서 이 질문과 관련된 문단이나 수치를 찾지 못했어요.'}</p>
            <div className="answer-card__notice-actions">
              <Button variant="secondary" onClick={() => links.onSearchText(item.question)}>
                문장·내용 변화에서 찾아보기
              </Button>
            </div>
          </Notice>
        ))
        .with('OUT_OF_SCOPE', () => (
          <Notice className="answer-card__notice" title="답하지 않는 질문이에요">
            <p>{item.message ?? '매수·매도, 목표주가, 주가 전망처럼 투자 판단이 필요한 질문에는 답하지 않아요.'}</p>
          </Notice>
        ))
        .with('REVIEW_NEEDED', () => (
          <Notice tone="attention" className="answer-card__notice" title="검토 필요">
            <p>{item.message ?? '답이 근거 확인을 통과하지 못해 보여 주지 않아요. 질문을 바꿔 다시 물어봐 주세요.'}</p>
          </Notice>
        ))
        .exhaustive()}
      {item.ai && item.status !== 'ANSWERED' && <AiMeta item={item} />}
    </Card>
  )
}

function AiMeta({ item }: { item: QuestionAnswer }) {
  return (
    <details className="answer-card__meta">
      <summary>생성 정보</summary>
      {aiInfoLabel(item.ai)}
    </details>
  )
}

/** 표시를 누르면 그 근거 줄로 옮겨 가 잠깐 강조한다 */
function useFocusRef(questionId: number) {
  const [active, setActive] = useState<{ key: string; n: number } | null>(null)
  const idOf = (key: string) => `ask-${questionId}-${key}`
  const focus = (key: string) => {
    setActive((prev) => ({ key, n: (prev?.n ?? 0) + 1 }))
    const el = document.getElementById(idOf(key))
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }
  return { active, idOf, focus }
}

function AnsweredBody({ item, links, onFeedback }: { item: QuestionAnswer; links: AnswerLinks; onFeedback: SendFeedback }) {
  const { active, idOf, focus } = useFocusRef(item.questionId)
  const segments = parseAnswer(item.answer ?? '', item.citations, item.facts)
  const citeKey = (c: QuestionCitation) => `c${c.no}`
  const factKey = (f: QuestionFact) => `f${f.ref}`
  // 같은 줄을 다시 눌러도 강조가 다시 보이게, 줄은 그대로 두고 강조 조각만 새로 그린다
  const flash = (key: string) =>
    active?.key === key ? <span key={active.n} className="answer-cite__flash" aria-hidden="true" /> : null

  return (
    <>
      <div className="answer-card__answer">
        <Badge tone="accent" className="answer-card__ai">
          AI 생성
        </Badge>
        <p className="answer-card__text">
          {segments.map((s, i) =>
            match(s)
              .with({ kind: 'text' }, ({ text }) => <span key={i}>{text}</span>)
              .with({ kind: 'citation' }, ({ citation }) => (
                <button
                  key={i}
                  type="button"
                  className="answer-marker"
                  aria-label={`인용 ${citation.no}: ${displaySectionPath(citation.sectionPath)}`}
                  title={displaySectionPath(citation.sectionPath)}
                  onClick={() => focus(citeKey(citation))}
                >
                  {citation.no}
                </button>
              ))
              .with({ kind: 'fact' }, ({ fact }) => (
                <button
                  key={i}
                  type="button"
                  className="answer-marker answer-marker--fact"
                  aria-label={`${factLabel(fact.ref)}: ${fact.sentence}`}
                  title={fact.sentence}
                  onClick={() => focus(factKey(fact))}
                >
                  {factLabel(fact.ref)}
                </button>
              ))
              .exhaustive(),
          )}
        </p>
      </div>

      {item.citations.length > 0 && (
        <EvidenceGroup title="인용한 원문" count={item.citations.length}>
          <ol className="answer-evidence">
            {item.citations.map((c) => (
              <li
                key={c.no}
                id={idOf(citeKey(c))}
                tabIndex={-1}
                className={cx('answer-cite', active?.key === citeKey(c) && 'answer-cite--active')}
              >
                {flash(citeKey(c))}
                <span className="answer-cite__no" aria-hidden="true">
                  {c.no}
                </span>
                <div className="answer-cite__body">
                  <p className="answer-cite__where">
                    <span className="visually-hidden">인용 {c.no}, </span>
                    <Badge tone={sideTone(c.side)}>{citationSideLabel(c.side)}</Badge>
                    <span className="answer-cite__path">{displaySectionPath(c.sectionPath)}</span>
                  </p>
                  <blockquote className="answer-cite__quote">“{quoteLabel(c.quote)}”</blockquote>
                </div>
                <Button
                  variant="link"
                  className="answer-cite__open"
                  onClick={() => links.onOpenSource({ side: c.side, section: c.sectionNo, block: c.blockNo })}
                >
                  원문 보기<span className="visually-hidden"> ({c.reportName})</span>
                </Button>
              </li>
            ))}
          </ol>
        </EvidenceGroup>
      )}

      {item.facts.length > 0 && (
        <EvidenceGroup title="계산한 수치" count={item.facts.length}>
          <ul className="answer-evidence">
            {item.facts.map((f) => (
              <li
                key={f.ref}
                id={idOf(factKey(f))}
                tabIndex={-1}
                className={cx('answer-cite answer-cite--fact', active?.key === factKey(f) && 'answer-cite--active')}
              >
                {flash(factKey(f))}
                <span className="answer-cite__no answer-cite__no--fact" aria-hidden="true">
                  {factLabel(f.ref)}
                </span>
                <p className="answer-cite__body answer-cite__sentence">
                  <span className="visually-hidden">{factLabel(f.ref)}, </span>
                  {f.sentence}
                </p>
                <Button variant="link" className="answer-cite__open" onClick={() => links.onOpenFinancial(f.sjDiv, f.changeId)}>
                  수치 근거<span className="visually-hidden"> ({f.accountName})</span>
                </Button>
              </li>
            ))}
          </ul>
        </EvidenceGroup>
      )}

      <CopyWithSourcesButton className="answer-card__copy" text={() => answerCopyText(item)} target="답" />

      <FeedbackRow item={item} onFeedback={onFeedback} />

      {item.ai && <AiMeta item={item} />}
    </>
  )
}

/** '도움이 됐나요?'(3.12, FS-9). 누르면 바로 바뀌고, 저장에 실패하면 되돌린 뒤 짧게 알린다 */
function FeedbackRow({ item, onFeedback }: { item: QuestionAnswer; onFeedback: SendFeedback }) {
  const { questionId } = item
  const save = useCallback((feedback: AnswerFeedback) => onFeedback(questionId, feedback), [onFeedback, questionId])
  const { state, choose } = useAnswerFeedback(item.feedback, save)
  const { shown, save: saveState } = state
  const labelId = `ask-${questionId}-feedback`

  return (
    <section className="answer-feedback" aria-labelledby={labelId}>
      <div className="answer-feedback__row">
        <p className="answer-feedback__label" id={labelId}>
          도움이 됐나요?
        </p>
        <div className="answer-feedback__choices" role="group" aria-labelledby={labelId}>
          <Button
            className="answer-feedback__choice"
            aria-pressed={shown?.helpful === true}
            onClick={() => choose({ kind: 'helpful' })}
          >
            도움이 됐어요
          </Button>
          <Button
            className="answer-feedback__choice"
            aria-pressed={shown?.helpful === false}
            onClick={() => choose({ kind: 'not-helpful' })}
          >
            아니에요
          </Button>
        </div>
        <span
          className={cx('answer-feedback__status', saveState.status === 'error' && 'answer-feedback__status--error')}
          role="status"
        >
          {feedbackStatusLabel(saveState)}
        </span>
      </div>
      {shown?.helpful === false && (
        <div className="answer-feedback__reasons" role="group" aria-label="도움이 안 된 이유(고르지 않아도 돼요)">
          {FEEDBACK_REASONS.map(({ reason, label }) => (
            <Chip key={reason} pressed={shown.reason === reason} onClick={() => choose({ kind: 'reason', reason })}>
              {label}
            </Chip>
          ))}
        </div>
      )}
    </section>
  )
}

/** 현재 보고서는 강조 색(원문 확인·요약과 같음) */
function sideTone(side: DocumentSide): BadgeTone {
  return match(side)
    .with('current', () => 'accent' as const)
    .with('previous', () => 'neutral' as const)
    .exhaustive()
}

function EvidenceGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="answer-card__group" aria-label={title}>
      <h3 className="answer-card__label">
        {title} <span className="answer-card__count">{formatCount(count)}</span>
      </h3>
      {children}
    </section>
  )
}
