import { useCallback } from 'react'
import { sendAnswerFeedback, type AnswerFeedback } from '@/shared/api/questions'
import { cx } from '@/shared/lib/cx'
import { Button, Chip } from '@/shared/ui'
import { useAnswerFeedback } from '../hooks/useAnswerFeedback'
import { FEEDBACK_REASONS, feedbackStatusLabel } from '../model/answerFeedback'

interface ChatFeedbackProps {
  analysisId: number
  /** 이 답에서 근거 질문 Tool이 저장한 질문(응답 questionId) */
  questionId: number
}

/**
 * 채팅 답의 '도움이 됐나요?'(3.12, AC21). 근거 질문으로 저장된 답(questionId가 있는 답)에만 붙는다.
 * 평가는 그 질문(analysis_question)에 저장돼 AI 사용 현황의 평가 수에 더해진다. 로그인 없이 쓴다.
 * 누르면 바로 바뀌고, 저장에 실패하면 되돌린 뒤 짧게 알린다.
 */
export function ChatFeedback({ analysisId, questionId }: ChatFeedbackProps) {
  const save = useCallback(
    (feedback: AnswerFeedback) => sendAnswerFeedback(analysisId, questionId, feedback),
    [analysisId, questionId],
  )
  const { state, choose } = useAnswerFeedback(null, save)
  const { shown, save: saveState } = state
  const labelId = `chat-${questionId}-feedback`

  return (
    <div className="answer-feedback">
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
    </div>
  )
}
