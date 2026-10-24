import { match } from 'ts-pattern'
import type { LoadState } from '@/shared/hooks/asyncState'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui'
import { RISK_QUESTION } from '../model/askQuestion'

interface AskSuggestionsProps {
  suggestions: LoadState<string[]>
  /** 누르면 바로 묻는다 */
  onAsk: (question: string) => void
  /** 다른 질문을 보내는 중 */
  disabled: boolean
  /** 보일 개수(요약 진입 카드는 3개) */
  limit?: number
  className?: string
}

/** 예시 질문 버튼 묶음(3.10). 만드는 동안은 자리만 잡고, 못 만들면 늘 있는 '새로 생긴 위험 요인' 질문만 보인다 */
export function AskSuggestions({ suggestions, onAsk, disabled, limit, className }: AskSuggestionsProps) {
  const list = (questions: string[]) => (
    <ul className={cx('ask-suggestions', className)} aria-label="예시 질문">
      {questions.slice(0, limit).map((question) => (
        <li key={question}>
          <Button variant="secondary" className="ask-suggestion" disabled={disabled} onClick={() => onAsk(question)}>
            {question}
          </Button>
        </li>
      ))}
    </ul>
  )

  return match(suggestions)
    .with({ status: 'loading' }, () => (
      <div className={cx('ask-suggestions', className)} role="status">
        <span className="visually-hidden">예시 질문을 만드는 중이에요.</span>
        {[0, 1, 2].map((n) => (
          <span key={n} className="ask-suggestion-skeleton ask-skeleton" aria-hidden="true" />
        ))}
      </div>
    ))
    .with({ status: 'error' }, () => list([RISK_QUESTION]))
    .with({ status: 'success' }, ({ data }) => list(data))
    .exhaustive()
}
