import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/shared/ui/Icon'

/** 상단 바 검색창의 id. 첫 화면 검색창(company-query)과 겹치지 않게 따로 둔다 */
export const HEADER_SEARCH_ID = 'header-company-query'

/**
 * 상단 바의 둥근 기업 검색(#548). 첫 화면이 아닌 화면에만 둔다.
 * 검색어를 넣고 Enter를 누르면 첫 화면 검색 결과(/?q=)로 간다. 검색어 검사·결과 표시는 첫 화면이 그대로 맡는다.
 */
export function HeaderSearch() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = value.trim()
    navigate(query === '' ? '/' : `/?q=${encodeURIComponent(query)}`)
    setValue('')
  }

  return (
    <form className="header-search" role="search" aria-label="기업 검색" onSubmit={onSubmit}>
      <label htmlFor={HEADER_SEARCH_ID} className="visually-hidden">
        회사명 또는 종목코드
      </label>
      <Icon name="search" size={16} />
      <input
        id={HEADER_SEARCH_ID}
        className="header-search__input"
        type="search"
        autoComplete="off"
        placeholder="회사명 또는 종목코드"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  )
}
