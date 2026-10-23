import { useReducer } from 'react'
import { validateSearchQuery } from '../model/searchQuery'
import { initSearchForm, searchFormReducer } from '../model/searchForm'

/**
 * 검색 입력창. 주소의 검색어(query)가 바뀌면 입력창을 맞춘다.
 * submit은 검사를 통과하면 다듬은 검색어를, 아니면 null을 돌려준다.
 */
export function useSearchForm(query: string) {
  const [form, dispatch] = useReducer(searchFormReducer, query, initSearchForm)
  if (form.shownQuery !== query) {
    dispatch({ type: 'sync-query', query })
  }

  return {
    input: form.input,
    inputError: form.error,
    setInput: (value: string) => dispatch({ type: 'change-input', value }),
    submit: (): string | null => {
      dispatch({ type: 'submit' })
      return validateSearchQuery(form.input) === null ? form.input.trim() : null
    },
  }
}
