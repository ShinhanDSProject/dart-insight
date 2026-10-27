import { match } from 'ts-pattern'
import { formatCount } from './overview'

/**
 * AI 질문 탭의 지난 답 접기(#273, FS-28). 최근 답 몇 개만 펼치고, 그보다 오래된 것은 질문 목록으로 접는다.
 * 답 목록은 최신 순이라 앞의 것이 최근 답이다. 새로 물은 답은 맨 앞에 들어와 늘 펼쳐 보인다.
 */

/** 펼쳐 보이는 최근 답 수 */
export const RECENT_ANSWER_COUNT = 1
/** 이전 질문이 이만큼 이상이면 질문 찾기 입력을 둔다 */
export const PAST_SEARCH_MIN_COUNT = 6

export interface SplitAnswers<T> {
  recent: T[]
  older: T[]
}

/** 최신 순 답 목록을 펼칠 최근 답과 접을 이전 답으로 나눈다. 순서는 그대로 둔다 */
export function splitAnswers<T>(items: T[], recentCount: number = RECENT_ANSWER_COUNT): SplitAnswers<T> {
  return { recent: items.slice(0, recentCount), older: items.slice(recentCount) }
}

export function showPastSearch(olderCount: number): boolean {
  return olderCount >= PAST_SEARCH_MIN_COUNT
}

export function pastQuestionsLabel(count: number): string {
  return `이전 질문 ${formatCount(count)}개`
}

/** 비교용 글. 공백을 모두 지우고 소문자로 바꾼다('매출 액'과 '매출액'을 같게 본다) */
function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

/** 질문 문장에 찾는 글이 들어 있는 답만 남긴다. 공백·대소문자는 무시하고, 비었으면 모두 둔다 */
export function filterPastAnswers<T extends { question: string }>(items: T[], query: string): T[] {
  const needle = normalize(query)
  if (needle.length === 0) return items
  return items.filter((item) => normalize(item.question).includes(needle))
}

/** 이전 질문 목록의 상태. 찾는 글과 펼친 답이 함께 그려져 reducer로 둔다(ST-2) */
export interface PastAnswersState {
  query: string
  /** 펼친 답의 questionId. 누른 순서대로 */
  openIds: number[]
}

export type PastAnswersAction = { type: 'set-query'; query: string } | { type: 'toggle'; questionId: number }

export const initialPastAnswersState: PastAnswersState = { query: '', openIds: [] }

export function pastAnswersReducer(state: PastAnswersState, action: PastAnswersAction): PastAnswersState {
  return match<PastAnswersAction, PastAnswersState>(action)
    .with({ type: 'set-query' }, ({ query }) => ({ ...state, query }))
    .with({ type: 'toggle' }, ({ questionId }) => ({
      ...state,
      openIds: state.openIds.includes(questionId)
        ? state.openIds.filter((id) => id !== questionId)
        : [...state.openIds, questionId],
    }))
    .exhaustive()
}
