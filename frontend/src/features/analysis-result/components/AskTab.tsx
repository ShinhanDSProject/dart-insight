import type { KeyboardEvent } from 'react'
import { match } from 'ts-pattern'
import type { LoadState } from '@/shared/hooks/asyncState'
import { cx } from '@/shared/lib/cx'
import { Button, FieldHint, FieldLabel, Notice, Panel, PanelTitle } from '@/shared/ui'
import { LoadingState } from '@/shared/ui/StateView'
import type { AskController } from '../hooks/useAsk'
import { ASK_INTRO, draftMessage, parseQuestion, questionCountLabel } from '../model/askQuestion'
import { AnswerCard, FailedAnswerCard, PendingAnswerCard, type AnswerLinks } from './AnswerCard'
import { AskSuggestions } from './AskSuggestions'

interface AskTabProps extends AnswerLinks {
  ask: AskController
  suggestions: LoadState<string[]>
}

/**
 * W-03 ⑤ AI 질문(3.10, FS-5). 예시 질문을 누르거나 직접 물으면, 두 보고서 원문 문단과 코드가 계산한 수치로만 답한다.
 * 답의 [1]·[F1]을 누르면 아래 근거 줄로 가고, '원문 보기'·'수치 근거'로 원문 확인·재무 수치 탭의 그 위치를 연다.
 */
export function AskTab({ ask, suggestions, ...links }: AskTabProps) {
  const { state, history } = ask
  const sending = state.request.status === 'sending'
  const lastAnswered = state.items.find((i) => i.questionId === state.lastAnsweredId)

  return (
    <Panel className="ask" aria-labelledby="ask-title">
      <div className="ask__head">
        <PanelTitle id="ask-title">AI에게 물어보기</PanelTitle>
        <p className="ask__intro">{ASK_INTRO}</p>
      </div>

      <AskSuggestions suggestions={suggestions} onAsk={ask.ask} disabled={sending} />

      <AskForm ask={ask} sending={sending} />

      <p className="visually-hidden" role="status">
        {lastAnswered && !sending ? `'${lastAnswered.question}'에 대한 답이 왔어요.` : ''}
      </p>

      <ol className="answer-list" aria-label="질문과 답">
        {match(state.request)
          .with({ status: 'idle' }, () => null)
          .with({ status: 'sending' }, ({ question }) => (
            <li>
              <PendingAnswerCard question={question} />
            </li>
          ))
          .with({ status: 'error' }, ({ question, error }) => (
            <li>
              <FailedAnswerCard question={question} error={error} onRetry={ask.retry} />
            </li>
          ))
          .exhaustive()}
        {state.items.map((item) => (
          <li key={item.questionId}>
            <AnswerCard item={item} links={links} />
          </li>
        ))}
      </ol>

      {match(history.state)
        .with({ status: 'loading' }, () => <LoadingState message="이전에 한 질문을 불러오는 중이에요…" />)
        .with({ status: 'error' }, () => (
          <Notice role="status" className="ask__history-error">
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
            <p className="ask__empty">아직 한 질문이 없어요. 위의 예시 질문을 눌러 보거나 직접 물어보세요.</p>
          ) : null,
        )
        .exhaustive()}
    </Panel>
  )
}

function AskForm({ ask, sending }: { ask: AskController; sending: boolean }) {
  const { draft, draftRejected } = ask.state
  const message = draftMessage(draft, draftRejected)
  const tooLong = parseQuestion(draft).kind === 'too-long'

  // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 조합 중의 Enter는 글자를 끝내는 것이라 보내지 않는다
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    ask.submitDraft()
  }

  return (
    <form
      className="ask-form"
      onSubmit={(e) => {
        e.preventDefault()
        ask.submitDraft()
      }}
    >
      <FieldLabel htmlFor="ask-input">직접 물어보기</FieldLabel>
      <div className={cx('ask-form__box', message !== null && 'ask-form__box--error', sending && 'ask-form__box--busy')}>
        <textarea
          id="ask-input"
          className="ask-form__input"
          rows={2}
          value={draft}
          placeholder="예: 매출액은 왜 늘었나요?"
          // 보내는 동안 고치지 못하게 하되, 포커스는 그대로 둔다(disabled면 포커스가 빠짐)
          readOnly={sending}
          aria-disabled={sending}
          aria-invalid={message !== null}
          aria-describedby={cx('ask-hint', message !== null && 'ask-error')}
          onChange={(e) => ask.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="ask-form__bar">
          <FieldHint id="ask-hint" className="ask-form__hint">
            Enter로 보내고 Shift+Enter로 줄을 바꿔요
          </FieldHint>
          <span className={cx('ask-form__count', tooLong && 'ask-form__count--over')}>
            <span className="visually-hidden">글자 수 </span>
            {questionCountLabel(draft)}
          </span>
          <Button type="submit" variant="primary" className="ask-form__send" disabled={sending}>
            {sending ? '찾는 중…' : '묻기'}
          </Button>
        </div>
      </div>
      {message !== null && (
        <p id="ask-error" className="ask-form__error" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
