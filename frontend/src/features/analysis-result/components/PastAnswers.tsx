import { useReducer, type ReactNode } from 'react'
import type { QuestionAnswer } from '@/shared/api/questions'
import { FieldLabel, Input } from '@/shared/ui'
import { askedAtLabel } from '../model/askQuestion'
import {
  filterPastAnswers,
  initialPastAnswersState,
  pastAnswersReducer,
  pastQuestionsLabel,
  showPastSearch,
} from '../model/pastAnswers'

interface PastAnswersProps {
  /** 최근 답을 뺀 이전 답(최신 순) */
  items: QuestionAnswer[]
  /** 펼친 답을 그린다(최근 답과 같은 AnswerCard) */
  renderAnswer: (item: QuestionAnswer) => ReactNode
}

const answerRegionId = (questionId: number) => `ask-past-answer-${questionId}`

/**
 * '이전 질문 N개' 목록(#273, FS-28). 질문 문장과 시각만 보이고, 누르면 그 답만 그 자리에 펼친다. 다시 누르면 접는다.
 * 이전 질문이 많으면 위에 질문 찾기 입력을 둔다.
 */
export function PastAnswers({ items, renderAnswer }: PastAnswersProps) {
  const [state, dispatch] = useReducer(pastAnswersReducer, initialPastAnswersState)
  const searchable = showPastSearch(items.length)
  const visible = searchable ? filterPastAnswers(items, state.query) : items

  return (
    <section className="ask-past" aria-labelledby="ask-past-title">
      <h3 className="ask-past__title" id="ask-past-title">
        {pastQuestionsLabel(items.length)}
      </h3>
      {searchable && (
        <div className="ask-past__search">
          <FieldLabel htmlFor="ask-past-query">질문 찾기</FieldLabel>
          <Input
            id="ask-past-query"
            type="search"
            className="ask-past__input"
            placeholder="질문 문장으로 찾기"
            value={state.query}
            onChange={(e) => dispatch({ type: 'set-query', query: e.target.value })}
          />
        </div>
      )}
      {visible.length === 0 ? (
        <p className="ask-past__empty" role="status">
          맞는 질문이 없어요
        </p>
      ) : (
        <ul className="ask-past__list">
          {visible.map((item) => {
            const open = state.openIds.includes(item.questionId)
            return (
              <li key={item.questionId} className="ask-past__item">
                <button
                  type="button"
                  className="ask-past__toggle"
                  aria-expanded={open}
                  aria-controls={answerRegionId(item.questionId)}
                  onClick={() => dispatch({ type: 'toggle', questionId: item.questionId })}
                >
                  <span className="ask-past__q" aria-hidden="true">
                    Q
                  </span>
                  <span className="ask-past__question">{item.question}</span>
                  <span className="ask-past__time">{askedAtLabel(item.createdAt)}</span>
                </button>
                <div id={answerRegionId(item.questionId)} className="ask-past__answer" hidden={!open}>
                  {open && renderAnswer(item)}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
