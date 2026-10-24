import { useReducer, type KeyboardEvent } from 'react'
import { match } from 'ts-pattern'
import type { QuestionAnswer } from '@/shared/api/questions'
import type { LoadState } from '@/shared/hooks/asyncState'
import { cx } from '@/shared/lib/cx'
import { Button, FieldHint, FieldLabel, Notice, Panel, PanelTitle } from '@/shared/ui'
import { LoadingState } from '@/shared/ui/StateView'
import type { AskController } from '../hooks/useAsk'
import { ASK_INTRO, draftMessage, parseQuestion, questionCountLabel, RISK_QUESTION, sectionQuestion } from '../model/askQuestion'
import { followUpQuestions } from '../model/followUp'
import { splitAnswers } from '../model/pastAnswers'
import { SECTION_COMBO_CLOSED, sectionComboReducer, sectionSuggestions } from '../model/sectionSuggestions'
import { AnswerCard, FailedAnswerCard, PendingAnswerCard, type AnswerLinks } from './AnswerCard'
import { AskSuggestions } from './AskSuggestions'
import { PastAnswers } from './PastAnswers'

interface AskTabProps extends AnswerLinks {
  ask: AskController
  suggestions: LoadState<string[]>
  /** 이 분석의 최상위 섹션 제목(문장 변화 탭의 섹션 선택과 같은 출처). 입력 중 섹션 질문을 제안한다(#267) */
  sections: string[]
}

/**
 * W-03 ⑤ AI 질문(3.10, FS-5). 예시 질문을 누르거나 직접 물으면, 두 보고서 원문 문단과 코드가 계산한 수치로만 답한다.
 * 답의 [1]·[F1]을 누르면 아래 근거 줄로 가고, '원문 보기'·'수치 근거'로 원문 확인·재무 수치 탭의 그 위치를 연다.
 */
export function AskTab({ ask, suggestions, sections, ...links }: AskTabProps) {
  const { state, history } = ask
  const sending = state.request.status === 'sending'
  const lastAnswered = state.items.find((i) => i.questionId === state.lastAnsweredId)
  const suggestionList = match(suggestions)
    .with({ status: 'loading' }, () => [])
    .with({ status: 'error' }, () => [RISK_QUESTION])
    .with({ status: 'success' }, ({ data }) => data)
    .exhaustive()
  const asked = [
    ...state.items.map((i) => i.question),
    ...match(state.request)
      .with({ status: 'idle' }, () => [])
      .with({ status: 'sending' }, { status: 'error' }, ({ question }) => [question])
      .exhaustive(),
  ]
  // 최근 답 몇 개만 펼치고 오래된 것은 '이전 질문' 목록으로 접는다(#273). 새 답은 맨 앞이라 늘 펼쳐 보인다
  const { recent, older } = splitAnswers(state.items)
  const renderAnswer = (item: QuestionAnswer) => (
    <AnswerCard
      item={item}
      links={links}
      onFeedback={ask.sendFeedback}
      followUp={{
        questions: followUpQuestions(item, { suggestions: suggestionList, asked, sections }),
        onAsk: ask.ask,
        disabled: sending,
      }}
    />
  )

  return (
    <Panel className="ask" aria-labelledby="ask-title">
      <div className="ask__head">
        <PanelTitle id="ask-title">AI에게 물어보기</PanelTitle>
        <p className="ask__intro">{ASK_INTRO}</p>
      </div>

      <AskSuggestions suggestions={suggestions} onAsk={ask.ask} disabled={sending} />

      <AskForm ask={ask} sending={sending} sections={sections} />

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
        {recent.map((item) => (
          <li key={item.questionId}>{renderAnswer(item)}</li>
        ))}
      </ol>

      {older.length > 0 && <PastAnswers items={older} renderAnswer={renderAnswer} />}

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

const SECTION_LIST_ID = 'ask-section-suggestions'
const sectionOptionId = (index: number) => `ask-section-option-${index}`

function AskForm({ ask, sending, sections }: { ask: AskController; sending: boolean; sections: string[] }) {
  const { draft, draftRejected } = ask.state
  const message = draftMessage(draft, draftRejected)
  const tooLong = parseQuestion(draft).kind === 'too-long'
  const [combo, dispatchCombo] = useReducer(sectionComboReducer, SECTION_COMBO_CLOSED)
  const matches = sending ? [] : sectionSuggestions(sections, draft)
  const expanded = combo.status === 'open' && matches.length > 0
  const active = match(combo)
    .with({ status: 'open' }, ({ active }) => (expanded && active !== null && active < matches.length ? active : null))
    .with({ status: 'closed' }, () => null)
    .exhaustive()

  // 섹션 제안을 고르면 질문 문구로 채우고 닫는다(#267). 보내지는 않는다
  const choose = (title: string) => {
    ask.setDraft(sectionQuestion(title))
    dispatchCombo({ type: 'close' })
  }

  // ↑↓로 섹션 제안을 고르고 Esc로 닫는다. Enter는 고른 제안이 있으면 채우고, 없으면 보낸다. Shift+Enter는 줄바꿈.
  // 한글 조합 중의 키는 글자를 끝내는 것이라 무시한다
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (matches.length === 0) return
      e.preventDefault()
      dispatchCombo({ type: 'move', delta: e.key === 'ArrowDown' ? 1 : -1, count: matches.length })
      return
    }
    if (e.key === 'Escape') {
      if (!expanded) return
      e.preventDefault()
      dispatchCombo({ type: 'close' })
      return
    }
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (active !== null) choose(matches[active])
    else ask.submitDraft()
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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={SECTION_LIST_ID}
          aria-activedescendant={active !== null ? sectionOptionId(active) : undefined}
          className="ask-form__input"
          rows={2}
          value={draft}
          placeholder="예: 매출액은 왜 늘었나요?"
          // 보내는 동안 고치지 못하게 하되, 포커스는 그대로 둔다(disabled면 포커스가 빠짐)
          readOnly={sending}
          aria-disabled={sending}
          aria-invalid={message !== null}
          aria-describedby={cx('ask-hint', message !== null && 'ask-error')}
          onChange={(e) => {
            ask.setDraft(e.target.value)
            dispatchCombo({ type: 'input' })
          }}
          onKeyDown={onKeyDown}
          onBlur={() => dispatchCombo({ type: 'close' })}
        />
        <ul id={SECTION_LIST_ID} className="ask-form__suggestions" role="listbox" aria-label="섹션 질문 제안" hidden={!expanded}>
          {expanded &&
            matches.map((title, index) => (
              <li
                key={title}
                id={sectionOptionId(index)}
                role="option"
                aria-selected={index === active}
                className={cx('ask-form__suggestion', index === active && 'ask-form__suggestion--active')}
                // 누르는 동안 입력창 포커스가 빠져 목록이 닫히지 않게 한다. 고르기는 키보드로도 된다(입력창의 ↑↓·Enter)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(title)}
              >
                {sectionQuestion(title)}
              </li>
            ))}
        </ul>
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
