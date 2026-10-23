import { describe, expect, it } from 'vitest'
import { initSearchForm, searchFormReducer } from './searchForm'

describe('searchFormReducer', () => {
  it('입력하면 입력값만 바뀐다', () => {
    const state = searchFormReducer(initSearchForm('삼성'), { type: 'change-input', value: '삼성전' })
    expect(state).toEqual({ input: '삼성전', error: null, shownQuery: '삼성' })
  })

  it('짧은 검색어로 제출하면 안내를 남긴다', () => {
    const state = searchFormReducer(initSearchForm('a'), { type: 'submit' })
    expect(state.error).toBe('2자 이상 입력해 주세요.')
  })

  it('올바른 검색어로 제출하면 안내를 지운다', () => {
    const withError = { ...initSearchForm('삼성'), error: '2자 이상 입력해 주세요.' }
    expect(searchFormReducer(withError, { type: 'submit' }).error).toBeNull()
  })

  it('주소의 검색어가 바뀌면 입력창을 맞추고 안내를 지운다', () => {
    const typed = { input: 'x', error: '2자 이상 입력해 주세요.', shownQuery: '삼성' }
    expect(searchFormReducer(typed, { type: 'sync-query', query: 'LG' })).toEqual(initSearchForm('LG'))
  })

  it('주소의 검색어가 같으면 입력 중인 값을 그대로 둔다', () => {
    const typed = { input: '삼성전자', error: null, shownQuery: '삼성' }
    expect(searchFormReducer(typed, { type: 'sync-query', query: '삼성' })).toBe(typed)
  })
})
