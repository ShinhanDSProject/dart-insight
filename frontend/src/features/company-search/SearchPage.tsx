import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { Button, Input } from '@/shared/ui'
import { ServiceNotice } from '@/shared/ui/ServiceNotice'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { useCompanySearch, type SearchResult as SearchData } from './hooks/useCompanySearch'
import { useSearchForm } from './hooks/useSearchForm'
import './company-search.css'

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/** W-01 ① 기업 검색. 검색어는 주소(?q=)에 남겨 뒤로 가기를 해도 결과가 유지된다. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { input, inputError, setInput, submit } = useSearchForm(query)
  const { state, reload } = useCompanySearch(query)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = submit()
    if (next !== null) {
      setSearchParams({ q: next })
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
          <Input
            id="company-query"
            invalid={inputError !== null}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 삼성전자, 005930"
            autoComplete="off"
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

      <SearchResult state={state} onRetry={reload} />
    </section>
  )
}

function SearchResult({ state, onRetry }: { state: AsyncState<SearchData>; onRetry: () => void }) {
  return match(state)
    .with({ status: 'idle' }, () => null)
    .with({ status: 'loading' }, () => <LoadingState message="기업을 찾는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={onRetry} messages={errorMessages} />)
    .with({ status: 'success', data: { items: [] } }, ({ data }) => (
      <EmptyState title={`'${data.query}'에 맞는 기업이 없습니다.`}>
        <p>회사명 일부나 종목코드 6자리로 다시 검색해 보세요. 띄어쓰기와 '(주)' 같은 표기는 빼고 입력합니다.</p>
      </EmptyState>
    ))
    .with({ status: 'success' }, ({ data }) => (
      <ul className="company-list" aria-label="검색 결과">
        {data.items.map((company) => (
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
    ))
    .exhaustive()
}
