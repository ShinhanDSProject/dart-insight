import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { useCompanyLookup } from '@/shared/hooks/useCompanyLookup'
import { LOOKUP_LIMIT, nextResultFocus } from '@/shared/lib/companyLookup'
import { browserStorage, loadRecentAnalyses, type RecentAnalysis } from '@/shared/lib/recentAnalyses'
import { Icon } from '@/shared/ui/Icon'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'

/** 상단 바 검색창의 id. 첫 화면 검색창(company-query)과 겹치지 않게 따로 둔다 */
export const HEADER_SEARCH_ID = 'header-company-query'
/** 목록에서 키보드로 옮겨 다닐 기업 링크 */
const RESULT_LINK = '[data-result-link]'
/** 아직 아무것도 치지 않았을 때 보이는 최근 본 분석 수(#655) */
const RECENT_LIMIT = 5

/**
 * 상단 바의 둥근 기업 검색(#548). 첫 화면이 아닌 화면에만 둔다.
 * 글자를 고쳐 치면(2자 이상, 입력을 멈추면) 아래에 기업 목록을 띄우고, 기업을 누르면 홈을 거치지 않고 그 기업 화면으로 간다(#655).
 * 글자를 치기 전(기업 이름만 있거나 비었을 때)에 검색창을 누르면 홈과 같은 '최근 본 분석'을 띄워, 누르면 그 분석 결과로 간다.
 * 입력칸에서 Enter를 누르면 첫 화면 검색 결과(/?q=)로 간다. 검색어 검사·전체 결과 표시는 첫 화면이 그대로 맡는다.
 * 키보드는 기업 고르기(#426)와 같다: ↓로 목록에 들어가고 ↑↓·Home·End로 옮기며, 첫 기업에서 ↑나 Esc는 입력칸으로 돌아온다.
 * 기업·분석 화면에서는 그 기업 이름을 넣어 둔다(FS-69, 시안). 누르면 이름 전체가 선택돼, 지우지 않고 바로 다른 이름을 친다.
 * 기업이 바뀌면 부모가 key로 새로 그려 고쳐 쓴 글자를 버린다.
 */
export function HeaderSearch({ companyName = null }: { companyName?: string | null }) {
  const navigate = useNavigate()
  // 사용자가 고쳐 쓴 글자. 손대기 전(null)에는 기업 이름을 보이고 목록을 찾지 않는다
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // 검색창을 누를 때 읽어 둔 최근 본 분석. 다른 화면에서 늘었을 수 있어 열 때마다 다시 읽는다
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  // 고른 뒤·Esc로 입력칸에 초점을 돌려줄 때는 목록을 다시 열지 않는다
  const reopenOnFocus = useRef(true)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const value = draft ?? companyName ?? ''
  const lookup = useCompanyLookup(draft ?? '')
  const showRecent = (draft ?? '').trim() === ''
  const showResults = open && (showRecent ? recent.length > 0 : lookup.state.status !== 'idle')

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [open])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = value.trim()
    navigate(query === '' ? '/' : `/?q=${encodeURIComponent(query)}`)
    setDraft(null)
    setOpen(false)
  }

  function onPick() {
    setDraft(null)
    setOpen(false)
  }

  function focusInputClosed() {
    reopenOnFocus.current = false
    inputRef.current?.focus()
    reopenOnFocus.current = true
  }

  function resultLinks(): HTMLElement[] {
    return Array.from(popoverRef.current?.querySelectorAll<HTMLElement>(RESULT_LINK) ?? [])
  }

  function moveFrom(current: number | null, event: KeyboardEvent) {
    const links = resultLinks()
    const next = nextResultFocus(current, event.key, links.length)
    if (next === null) return
    event.preventDefault()
    if (next === 'input') focusInputClosed()
    else links[next].focus()
  }

  function onResultsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      // 목록만 닫는다. 좁은 화면에서 감싼 메뉴(Layout)까지 닫지 않게 올려 보내지 않는다
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      focusInputClosed()
      return
    }
    const index = resultLinks().indexOf(document.activeElement as HTMLElement)
    if (index >= 0) moveFrom(index, event)
  }

  return (
    <form className="header-search" role="search" aria-label="기업 검색" onSubmit={onSubmit} ref={formRef}>
      <label htmlFor={HEADER_SEARCH_ID} className="visually-hidden">
        회사명 또는 종목코드
      </label>
      <Icon name="search" size={16} />
      <input
        id={HEADER_SEARCH_ID}
        ref={inputRef}
        className="header-search__input"
        type="search"
        autoComplete="off"
        placeholder="회사명 또는 종목코드"
        value={value}
        onFocus={(event) => {
          event.target.select()
          if (!reopenOnFocus.current) return
          setRecent(loadRecentAnalyses(browserStorage()).slice(0, RECENT_LIMIT))
          setOpen(true)
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && showResults) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          } else if (event.key === 'ArrowDown' && showResults) {
            moveFrom(null, event)
          }
        }}
      />
      <div className="header-search__popover" hidden={!showResults} ref={popoverRef} onKeyDown={onResultsKeyDown}>
        {showRecent ? <RecentList items={recent} onPick={onPick} /> : <LookupList lookup={lookup} onPick={onPick} />}
      </div>
    </form>
  )
}

function RecentList({ items, onPick }: { items: RecentAnalysis[]; onPick: () => void }) {
  return (
    <>
      <p className="header-search__heading" id="header-search-recent">
        최근 본 분석
      </p>
      <ul className="header-search__results" aria-labelledby="header-search-recent">
        {items.map((item) => (
          <li key={item.analysisId}>
            <Link to={`/analyses/${item.analysisId}`} className="header-search__result header-search__result--recent" data-result-link="" onClick={onPick}>
              {item.corpName}
              <span className="header-search__code">
                {item.previousReportName} → {item.currentReportName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function LookupList({ lookup, onPick }: { lookup: ReturnType<typeof useCompanyLookup>; onPick: () => void }) {
  return match(lookup.state)
    .with({ status: 'idle' }, () => null)
    .with({ status: 'loading' }, () => <LoadingState message="기업을 찾는 중이에요…" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={lookup.reload} />)
    .with({ status: 'success' }, ({ data }) =>
      data.items.length === 0 ? (
        <p className="field-hint">'{lookup.query}'에 맞는 기업이 없어요.</p>
      ) : (
        <ul className="header-search__results" aria-label={`'${lookup.query}' 검색 결과`}>
          {data.items.slice(0, LOOKUP_LIMIT).map((company) => (
            <li key={company.corpCode}>
              <Link
                to={`/companies/${encodeURIComponent(company.corpCode)}`}
                className="header-search__result"
                data-result-link=""
                onClick={onPick}
              >
                {company.corpName}
                <span className="header-search__code">{company.stockCode ?? '비상장'}</span>
              </Link>
            </li>
          ))}
        </ul>
      ),
    )
    .exhaustive()
}
