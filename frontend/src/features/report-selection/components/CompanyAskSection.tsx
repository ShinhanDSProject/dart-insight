import { useState } from 'react'
import { match } from 'ts-pattern'
import type { CompanyQuestionAnswer } from '@/shared/api/companyQuestions'
import { cx } from '@/shared/lib/cx'
import { askedAtLabel, draftMessage, parseQuestion, questionCountLabel, quoteLabel } from '@/shared/lib/questionText'
import { Badge, Button, FieldHint, FieldLabel, Input, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useCompanyAsk } from '../hooks/useCompanyAsk'
import { briefingAiLabel, toggleOpen } from '../model/companyBriefing'
import {
  citationLocation,
  COMPANY_ASK_ERROR_MESSAGES,
  COMPANY_ASK_EXAMPLES,
  COMPANY_ASK_INTRO,
  unansweredTitle,
} from '../model/companyAsk'
import '../report-selection.css'

const TITLE_ID = 'company-ask-title'
const INPUT_ID = 'company-ask-input'
const HINT_ID = 'company-ask-hint'
const ERROR_ID = 'company-ask-error'
const ANSWERS_ID = 'company-ask-answers'

/**
 * 기업 화면 개요 탭 'AI에게 묻기 · 사업보고서 기준'(FS-53, ADR-0029). 예시 질문을 누르거나 직접 물으면 최신 사업보고서
 * 원문 문단으로만 답한다. 답마다 'AI 생성' 표시와 인용 버튼(누르면 섹션 경로와 인용 문단)을 둔다.
 */
export function CompanyAskSection({ corpCode }: { corpCode: string }) {
  const ask = useCompanyAsk(corpCode)
  // 가장 최근 답 하나만 펼쳐 두고 이전 질문은 접어 둔다(#385)
  const [olderOpen, setOlderOpen] = useState(false)
  const { state, history } = ask
  const sending = state.request.status === 'sending'
  const lastAnswered = state.items.find((i) => i.questionId === state.lastAnsweredId)
  const report = history.state.status === 'success' ? history.state.data.report : null

  return (
    <Panel className="company-ask" aria-labelledby={TITLE_ID}>
      <div className="company-ask__head">
        <PanelTitle id={TITLE_ID}>AI에게 묻기 · 사업보고서 기준</PanelTitle>
      </div>
      <p className="company-ask__intro">{COMPANY_ASK_INTRO}</p>
      {report && (
        <p className="company-ask__source">
          근거 보고서: <span>{report.reportName}</span>{' '}
          <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
        </p>
      )}

      <ul className="company-ask__examples" aria-label="예시 질문">
        {COMPANY_ASK_EXAMPLES.map((question) => (
          <li key={question}>
            <Button variant="secondary" disabled={sending} onClick={() => ask.ask(question)}>
              {question}
            </Button>
          </li>
        ))}
      </ul>

      <AskForm ask={ask} sending={sending} />

      <p className="visually-hidden" role="status">
        {lastAnswered && !sending ? `'${lastAnswered.question}'에 대한 답이 왔어요.` : ''}
      </p>

      <ol className="company-ask__answers" id={ANSWERS_ID} aria-label="질문과 답">
        {match(state.request)
          .with({ status: 'idle' }, () => null)
          .with({ status: 'sending' }, ({ question }) => (
            <li className="company-ask__answer" aria-busy="true">
              <p className="company-ask__question">{question}</p>
              <LoadingState message="사업보고서 원문에서 찾는 중이에요. 처음 묻는 기업은 수십 초 걸릴 수 있어요." />
            </li>
          ))
          .with({ status: 'error' }, ({ question, error }) => (
            <li className="company-ask__answer">
              <p className="company-ask__question">{question}</p>
              <ErrorState error={error} onRetry={ask.retry} messages={COMPANY_ASK_ERROR_MESSAGES} />
            </li>
          ))
          .exhaustive()}
        {(olderOpen ? state.items : state.items.slice(0, 1)).map((item) => (
          <li key={item.questionId} className="company-ask__answer">
            <AnswerCard item={item} />
          </li>
        ))}
      </ol>
      {state.items.length > 1 && (
        <Button
          variant="link"
          className="company-ask__older"
          aria-expanded={olderOpen}
          aria-controls={ANSWERS_ID}
          onClick={() => setOlderOpen((open) => !open)}
        >
          {olderOpen ? '이전 질문 접기' : `이전 질문 ${state.items.length - 1}개 보기`}
        </Button>
      )}

      {match(history.state)
        .with({ status: 'loading' }, () => <LoadingState message="이전에 한 질문을 불러오는 중이에요…" />)
        .with({ status: 'error' }, () => (
          <Notice role="status">
            <p>
              이전에 한 질문을 불러오지 못했어요.{' '}
              <Button variant="link" onClick={history.reload}>
                다시 시도
              </Button>
            </p>
          </Notice>
        ))
        .with({ status: 'success' }, () =>
          state.items.length === 0 && state.request.status === 'idle' ? (
            <p className="company-ask__empty">아직 한 질문이 없어요. 위의 예시 질문을 눌러 보거나 직접 물어보세요.</p>
          ) : null,
        )
        .exhaustive()}
    </Panel>
  )
}

function AskForm({ ask, sending }: { ask: ReturnType<typeof useCompanyAsk>; sending: boolean }) {
  const { draft, draftRejected } = ask.state
  const message = draftMessage(draft, draftRejected)
  const tooLong = parseQuestion(draft).kind === 'too-long'
  return (
    <form
      className="company-ask__form"
      onSubmit={(e) => {
        e.preventDefault()
        ask.submitDraft()
      }}
    >
      <FieldLabel htmlFor={INPUT_ID}>직접 물어보기</FieldLabel>
      <div className="company-ask__row">
        <Input
          id={INPUT_ID}
          className="company-ask__input"
          value={draft}
          placeholder="예: 주요 제품은 무엇인가요?"
          // 보내는 동안 고치지 못하게 하되, 포커스는 그대로 둔다(disabled면 포커스가 빠짐)
          readOnly={sending}
          aria-disabled={sending}
          invalid={message !== null}
          aria-describedby={cx(HINT_ID, message !== null && ERROR_ID)}
          onChange={(e) => ask.setDraft(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={sending}>
          {sending ? '찾는 중…' : '묻기'}
        </Button>
      </div>
      <FieldHint id={HINT_ID} className={cx('company-ask__count', tooLong && 'company-ask__count--over')}>
        <span className="visually-hidden">글자 수 </span>
        {questionCountLabel(draft)}
      </FieldHint>
      {message !== null && (
        <p id={ERROR_ID} className="company-ask__error" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

export function AnswerCard({ item }: { item: CompanyQuestionAnswer }) {
  const [open, setOpen] = useState<number | null>(null)
  const title = unansweredTitle(item)
  return (
    <article className="company-ask__card" aria-label={`질문: ${item.question}`}>
      <div className="company-ask__card-head">
        <p className="company-ask__question">{item.question}</p>
        {item.aiGenerated && <Badge tone="accent">AI 생성</Badge>}
      </div>
      {match(title)
        .with(null, () => <p className="company-ask__text">{item.answer}</p>)
        .otherwise((t) => (
          <Notice tone={item.status === 'REVIEW_NEEDED' ? 'attention' : 'info'} title={t}>
            <p>{item.message}</p>
          </Notice>
        ))}
      {item.citations.length > 0 && (
        <ol className="company-ask__citations" aria-label="인용한 원문">
          {item.citations.map((citation) => {
            const expanded = open === citation.no
            const panelId = `company-ask-quote-${item.questionId}-${citation.no}`
            return (
              <li key={citation.no}>
                <Button
                  variant="link"
                  className="company-ask__cite"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen((current) => toggleOpen(current, citation.no))}
                >
                  [{citation.no}] {citationLocation(citation)}
                  <span className="visually-hidden"> 원문 {expanded ? '닫기' : '보기'}</span>
                </Button>
                {expanded && (
                  <blockquote id={panelId} className="company-ask__quote">
                    {citation.quote ? quoteLabel(citation.quote) : '원문 문단을 찾지 못했어요. DART 원문에서 확인해 주세요.'}
                  </blockquote>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <p className="company-ask__meta">
        {askedAtLabel(item.createdAt)} 질문 · {item.report.reportName}
        {item.aiGenerated && item.ai && <span> · {briefingAiLabel(item.ai)}</span>}
      </p>
    </article>
  )
}
