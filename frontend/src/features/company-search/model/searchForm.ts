import { match } from 'ts-pattern'
import { validateSearchQuery } from './searchQuery'

/** 검색 입력창 상태. shownQuery는 입력창이 마지막으로 맞춘 주소(?q=)의 검색어 */
export interface SearchFormState {
  input: string
  error: string | null
  shownQuery: string
}

export type SearchFormAction =
  | { type: 'change-input'; value: string }
  | { type: 'submit' }
  | { type: 'sync-query'; query: string }

export function initSearchForm(query: string): SearchFormState {
  return { input: query, error: null, shownQuery: query }
}

export function searchFormReducer(state: SearchFormState, action: SearchFormAction): SearchFormState {
  return match<SearchFormAction, SearchFormState>(action)
    .with({ type: 'change-input' }, ({ value }) => ({ ...state, input: value }))
    .with({ type: 'submit' }, () => ({ ...state, error: validateSearchQuery(state.input) }))
    // 뒤로 가기나 로고 클릭으로 주소의 검색어가 바뀌면 입력창도 맞추고 안내를 지운다.
    // 입력을 멈춰 자동 검색으로 바뀐 주소(다듬은 입력과 같음)면 치던 글을 그대로 두고(끝에 친 공백이 지워지지 않게) 안내만 지운다
    .with({ type: 'sync-query' }, ({ query }) => {
      if (query === state.shownQuery) return state
      return state.input.trim() === query ? { ...state, error: null, shownQuery: query } : initSearchForm(query)
    })
    .exhaustive()
}
