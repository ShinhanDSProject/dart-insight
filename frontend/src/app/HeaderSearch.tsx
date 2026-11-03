import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/shared/ui/Icon'

/** 상단 바 검색창의 id. 첫 화면 검색창(company-query)과 겹치지 않게 따로 둔다 */
export const HEADER_SEARCH_ID = 'header-company-query'

/**
 * 상단 바의 둥근 기업 검색(#548). 첫 화면이 아닌 화면에만 둔다.
 * 검색어를 넣고 Enter를 누르면 첫 화면 검색 결과(/?q=)로 간다. 검색어 검사·결과 표시는 첫 화면이 그대로 맡는다.
 * 기업·분석 화면에서는 그 기업 이름을 넣어 둔다(FS-69, 시안). 누르면 이름 전체가 선택돼, 지우지 않고 바로 다른 이름을 친다.
 * 기업이 바뀌면 부모가 key로 새로 그려 고쳐 쓴 글자를 버린다.
 */
export function HeaderSearch({ companyName = null }: { companyName?: string | null }) {
  const navigate = useNavigate()
  // 사용자가 고쳐 쓴 글자. 손대기 전(null)에는 기업 이름을 보인다
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? companyName ?? ''

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = value.trim()
    navigate(query === '' ? '/' : `/?q=${encodeURIComponent(query)}`)
    setDraft(null)
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
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
      />
    </form>
  )
}
