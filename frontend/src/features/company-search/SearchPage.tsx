import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { searchCompanies, type Company } from '@/shared/api/companies'
import { Button } from '@/shared/ui'
import { ServiceNotice } from '@/shared/ui/ServiceNotice'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { validateSearchQuery } from './model/searchQuery'
import './company-search.css'

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; query: string; items: Company[] }
  | { kind: 'error'; error: unknown }

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/** W-01 ① 기업 검색. 검색어는 주소(?q=)에 남겨 뒤로 가기를 해도 결과가 유지된다. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [input, setInput] = useState(query)
  const [inputError, setInputError] = useState<string | null>(null)
  // 뒤로 가기나 로고 클릭으로 주소의 검색어가 바뀌면 입력창도 맞춘다
  const [shownQuery, setShownQuery] = useState(query)
  if (shownQuery !== query) {
    setShownQuery(query)
    setInput(query)
    setInputError(null)
  }
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (validateSearchQuery(query) !== null) {
      setState({ kind: 'idle' })
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    searchCompanies(query.trim())
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', query: query.trim(), items: data.items })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [query, retry])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const problem = validateSearchQuery(input)
    setInputError(problem)
    if (problem === null) {
      setSearchParams({ q: input.trim() })
    }
  }

  return (
    <section className="page">
      <p className="page__step">W-01 ①</p>
      <h1 className="page__title">기업 검색</h1>
      <p className="page__lead">회사명이나 종목코드로 기업을 찾고, 같은 기업의 두 정기보고서를 비교합니다.</p>
      <ServiceNotice />

      <form className="search-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="company-query" className="search-form__label">
          회사명 또는 종목코드
        </label>
        <div className="search-form__row">
          <input
            id="company-query"
            className={`input${inputError ? ' input--error' : ''}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 삼성전자, 005930"
            autoComplete="off"
            aria-invalid={inputError !== null}
            aria-describedby={inputError ? 'company-query-error' : undefined}
          />
          <Button type="submit" variant="primary" size="lg">
            검색
          </Button>
        </div>
        {inputError && (
          <p id="company-query-error" className="field-error">
            {inputError}
          </p>
        )}
      </form>

      <SearchResult state={state} onRetry={() => setRetry((n) => n + 1)} />
    </section>
  )
}

function SearchResult({ state, onRetry }: { state: SearchState; onRetry: () => void }) {
  switch (state.kind) {
    case 'idle':
      return null
    case 'loading':
      return <LoadingState message="기업을 찾는 중입니다…" />
    case 'error':
      return <ErrorState error={state.error} onRetry={onRetry} messages={errorMessages} />
    case 'done':
      if (state.items.length === 0) {
        return (
          <EmptyState title={`'${state.query}'에 맞는 기업이 없습니다.`}>
            <p>회사명 일부나 종목코드 6자리로 다시 검색해 보세요. 띄어쓰기와 '(주)' 같은 표기는 빼고 입력합니다.</p>
          </EmptyState>
        )
      }
      return (
        <ul className="company-list" aria-label="검색 결과">
          {state.items.map((company) => (
            <li key={company.corpCode}>
              <Link to={`/companies/${company.corpCode}`} className="company-list__item">
                <span className="company-list__name">{company.corpName}</span>
                <span className="company-list__meta">
                  {company.listed ? `종목코드 ${company.stockCode}` : '비상장'} · 고유번호 <code>{company.corpCode}</code>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )
  }
}
