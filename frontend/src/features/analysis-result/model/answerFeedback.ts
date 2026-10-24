import { match } from 'ts-pattern'
import type { AnswerFeedback, FeedbackReason } from '@/shared/api/questions'

/**
 * 답 카드의 평가(3.12, FS-9). 누르면 바로 보이게 바꾸고(낙관적), 저장에 실패하면 마지막으로 저장된 평가로 되돌린다.
 * 보이는 평가·저장된 평가·저장 상태가 함께 바뀌어 reducer로 둔다(ST-2).
 */

export { FEEDBACK_REASONS } from '@/shared/lib/feedbackReasons'

/** 누른 버튼 */
export type FeedbackChoice =
  | { kind: 'helpful' }
  | { kind: 'not-helpful' }
  | { kind: 'reason'; reason: FeedbackReason }

/**
 * 누른 버튼으로 보낼 평가. 바뀌는 것이 없으면 null(보내지 않음).
 * 이미 고른 사유를 다시 누르면 사유만 지운다. 평가 자체를 지우는 API는 없어 눌린 버튼을 다시 눌러도 그대로 둔다.
 */
export function nextFeedback(current: AnswerFeedback | null, choice: FeedbackChoice): AnswerFeedback | null {
  return match(choice)
    .with({ kind: 'helpful' }, () => (current?.helpful === true ? null : { helpful: true, reason: null }))
    .with({ kind: 'not-helpful' }, () => (current?.helpful === false ? null : { helpful: false, reason: null }))
    .with({ kind: 'reason' }, ({ reason }) => ({
      helpful: false,
      reason: current?.helpful === false && current.reason === reason ? null : reason,
    }))
    .exhaustive()
}

export type FeedbackSave = { status: 'idle' } | { status: 'saving' } | { status: 'saved' } | { status: 'error' }

export interface FeedbackState {
  /** 화면에 보이는 평가(저장 중이면 보낸 값) */
  shown: AnswerFeedback | null
  /** 서버에 저장된 마지막 평가. 실패하면 이 값으로 되돌린다 */
  confirmed: AnswerFeedback | null
  /** 마지막으로 보낸 요청 번호. 늦게 온 앞 요청의 결과가 뒤 요청을 덮지 않게 한다 */
  seq: number
  save: FeedbackSave
}

export type FeedbackAction =
  | { type: 'choose'; feedback: AnswerFeedback; seq: number }
  | { type: 'saved'; feedback: AnswerFeedback; seq: number }
  | { type: 'fail'; seq: number }

export function initialFeedbackState(feedback: AnswerFeedback | null): FeedbackState {
  return { shown: feedback, confirmed: feedback, seq: 0, save: { status: 'idle' } }
}

export function answerFeedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  return match<FeedbackAction, FeedbackState>(action)
    .with({ type: 'choose' }, ({ feedback, seq }) => ({ ...state, shown: feedback, seq, save: { status: 'saving' } }))
    .with({ type: 'saved' }, ({ feedback, seq }) => {
      if (seq === state.seq) return { ...state, confirmed: feedback, save: { status: 'saved' } }
      // 앞 요청이 늦게 저장됨: 서버 값은 이것이다. 뒤 요청이 이미 실패해 되돌렸다면 보이는 값도 맞춘다
      return { ...state, confirmed: feedback, shown: state.save.status === 'error' ? feedback : state.shown }
    })
    .with({ type: 'fail' }, ({ seq }) =>
      seq === state.seq ? { ...state, shown: state.confirmed, save: { status: 'error' } } : state,
    )
    .exhaustive()
}

/** 평가 줄 옆의 짧은 안내. 저장하는 동안과 아무것도 안 했을 때는 빈 글 */
export function feedbackStatusLabel(save: FeedbackSave): string {
  return match(save)
    .with({ status: 'saved' }, () => '의견 고마워요')
    .with({ status: 'error' }, () => '저장하지 못했어요. 다시 눌러 주세요.')
    .with({ status: 'idle' }, { status: 'saving' }, () => '')
    .exhaustive()
}
