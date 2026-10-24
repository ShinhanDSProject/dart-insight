import { useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { Badge, Button, Input } from '@/shared/ui'
import { ServiceNotice } from '@/shared/ui/ServiceNotice'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { useRecentAnalyses } from '@/shared/hooks/useRecentAnalyses'
import { useCompanySearch, type SearchResult as SearchData } from './hooks/useCompanySearch'
import { useAutoSearch } from './hooks/useAutoSearch'
import { RecentAnalyses } from './components/RecentAnalyses'
import { useSearchForm } from './hooks/useSearchForm'
import { sameNameCounts } from './model/sameName'
import './company-search.css'

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/** W-01 ① 기업 검색. 검색어는 주소(?q=)에 남겨 뒤로 가기를 해도 결과가 유지된다. 입력을 멈추면 Enter 없이도 찾는다. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { input, inputError, setInput, submit } = useSearchForm(query)
  const { state, reload } = useCompanySearch(query)
  // 입력 중 자동 검색은 방문 기록을 쌓지 않는다(replace)
  const searchAsTyped = useCallback((next: string) => setSearchParams({ q: next }, { replace: true }), [setSearchParams])
  useAutoSearch(input, query, searchAsTyped)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = submit()
    if (next !== null) {
      setSearchParams({ q: next })
    }
  }

  return (
    <section className="page">
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

      {query === '' && <RecentAnalysesSection />}

      <SearchResult state={state} onRetry={reload} />
    </section>
  )
}

/** 검색어가 없을 때만 보이는 최근 본 분석(FS-7). 목록이 비면 아무것도 보이지 않는다 */
function RecentAnalysesSection() {
  const recent = useRecentAnalyses()
  return <RecentAnalyses items={recent.items} onRemove={recent.remove} onClear={recent.clear} />
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
    .with({ status: 'success' }, ({ data }) => <CompanyList items={data.items} />)
    .exhaustive()
}

/** 검색 결과. 상장 여부를 글자로 보이고, 이름이 같은 회사가 있으면 알려 준다 */
function CompanyList({ items }: { items: SearchData['items'] }) {
  const sameNames = sameNameCounts(items)
  return (
    <ul className="company-list" aria-label={`검색 결과 ${items.length}곳`}>
      {items.map((company) => {
        const sameCount = sameNames.get(company.corpName)
        return (
          <li key={company.corpCode}>
            <Link to={`/companies/${company.corpCode}`} className="company-list__item">
              <span className="company-list__head">
                <span className="company-list__name">{company.corpName}</span>
                <Badge tone={company.listed ? 'accent' : 'neutral'}>{company.listed ? '상장' : '비상장'}</Badge>
                {sameCount !== undefined && <span className="company-list__same">같은 이름 {sameCount}곳</span>}
              </span>
              <span className="company-list__meta">
                {company.listed && `종목코드 ${company.stockCode}`}
                <span className="company-list__code">
                  고유번호 <code>{company.corpCode}</code>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
