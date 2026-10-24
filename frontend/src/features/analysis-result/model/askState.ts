import { match } from 'ts-pattern'
import type { AnswerFeedback, QuestionAnswer } from '@/shared/api/questions'

/**
 * AI 질문 탭(3.10)의 상태. 입력 글·보내는 요청·답 목록이 함께 바뀌어 reducer로 둔다(ST-2).
 * 답은 최신 순이고, 기록(GET)과 새 답이 겹치면 questionId로 한 번만 둔다.
 */
export type AskRequest =
  | { status: 'idle' }
  /** fromDraft: 입력창 글을 보냈는지(답이 오면 입력창을 비움). 예시 질문이면 false */
  | { status: 'sending'; question: string; fromDraft: boolean }
  | { status: 'error'; question: string; fromDraft: boolean; error: unknown }

export interface AskState {
  draft: string
  /** 짧은 글을 보내려 했음('2자 이상' 안내). 글을 고치면 지운다 */
  draftRejected: boolean
  request: AskRequest
  items: QuestionAnswer[]
  /** 이 화면에서 마지막으로 받은 답(화면 읽기 프로그램에 알림). 없으면 null */
  lastAnsweredId: number | null
}

export type AskAction =
  | { type: 'set-draft'; draft: string }
  | { type: 'reject-draft' }
  | { type: 'send'; question: string; fromDraft: boolean }
  | { type: 'answer'; answer: QuestionAnswer }
  | { type: 'fail'; error: unknown }
  | { type: 'history'; items: QuestionAnswer[] }
  /** 저장한 답 평가(3.12)를 그 답에 적는다. 다른 탭에 다녀와도 카드가 같은 평가로 다시 그려진다 */
  | { type: 'set-feedback'; questionId: number; feedback: AnswerFeedback }

export const initialAskState: AskState = { draft: '', draftRejected: false, request: { status: 'idle' }, items: [], lastAnsweredId: null }

/** 앞의 것을 남기고 같은 questionId는 한 번만 */
function uniqueById(items: QuestionAnswer[]): QuestionAnswer[] {
  const seen = new Set<number>()
  return items.filter((item) => (seen.has(item.questionId) ? false : (seen.add(item.questionId), true)))
}

export function askReducer(state: AskState, action: AskAction): AskState {
  return match<AskAction, AskState>(action)
    .with({ type: 'set-draft' }, ({ draft }) => ({ ...state, draft, draftRejected: false }))
    .with({ type: 'reject-draft' }, () => ({ ...state, draftRejected: true }))
    // 보내는 중에는 새 질문을 받지 않는다(한 번에 하나)
    .with({ type: 'send' }, ({ question, fromDraft }) =>
      state.request.status === 'sending' ? state : { ...state, draftRejected: false, request: { status: 'sending', question, fromDraft } },
    )
    .with({ type: 'answer' }, ({ answer }) =>
      match(state.request)
        .with({ status: 'sending' }, (request) => ({
          ...state,
          draft: request.fromDraft ? '' : state.draft,
          request: { status: 'idle' } as const,
          items: uniqueById([answer, ...state.items]),
          lastAnsweredId: answer.questionId,
        }))
        .otherwise(() => state),
    )
    // 실패해도 입력창 글은 그대로 둔다(다시 보내기 쉽게)
    .with({ type: 'fail' }, ({ error }) =>
      match(state.request)
        .with({ status: 'sending' }, ({ question, fromDraft }) => ({
          ...state,
          request: { status: 'error', question, fromDraft, error } as const,
        }))
        .otherwise(() => state),
    )
    // 기록보다 이 화면에서 받은 답이 새것이라 앞에 둔다
    .with({ type: 'history' }, ({ items }) => ({ ...state, items: uniqueById([...state.items, ...items]) }))
    .with({ type: 'set-feedback' }, ({ questionId, feedback }) => ({
      ...state,
      items: state.items.map((item) => (item.questionId === questionId ? { ...item, feedback } : item)),
    }))
    .exhaustive()
}
