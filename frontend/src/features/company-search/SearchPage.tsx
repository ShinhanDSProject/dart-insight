import { useCallback, useRef, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { Button, FieldHint, Input } from '@/shared/ui'
import { ServiceNotice } from '@/shared/ui/ServiceNotice'
import { AlertState, EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useOnboarding } from '@/shared/hooks/useOnboarding'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { useRecentAnalyses } from '@/shared/hooks/useRecentAnalyses'
import { isOnboardingVisible } from '@/shared/lib/onboarding'
import { pageTitle } from '@/shared/lib/pageTitle'
import { useCompanySearch, type SearchResult as SearchData } from './hooks/useCompanySearch'
import { useAutoSearch } from './hooks/useAutoSearch'
import { CompanyList, RESULT_LINK_SELECTOR } from './components/CompanyList'
import { FavoriteCompanies } from './components/FavoriteCompanies'
import { FavoriteDisclosureFeed } from './components/FavoriteDisclosureFeed'
import { OnboardingGuide } from './components/OnboardingGuide'
import { RecentAnalyses } from './components/RecentAnalyses'
import { useSearchForm } from './hooks/useSearchForm'
import { nextResultFocus } from './model/resultFocus'
import './company-search.css'

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/** W-01 ① 기업 검색. 검색어는 주소(?q=)에 남겨 뒤로 가기를 해도 결과가 유지된다. 입력을 멈추면 Enter 없이도 찾는다. */
export function SearchPage() {
  useDocumentTitle(pageTitle(['기업 검색']))
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { input, inputError, setInput, submit } = useSearchForm(query)
  const { state, reload } = useCompanySearch(query)
  // 입력 중 자동 검색은 방문 기록을 쌓지 않는다(replace)
  const searchAsTyped = useCallback((next: string) => setSearchParams({ q: next }, { replace: true }), [setSearchParams])
  useAutoSearch(input, query, searchAsTyped)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const focusInput = useCallback(() => inputRef.current?.focus(), [])

  /** 입력창에서 ↓를 누르면 첫 결과로 간다(FS-32). 한글 조합 중에는 IME에 맡긴다 */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    const links = listRef.current?.querySelectorAll<HTMLElement>(RESULT_LINK_SELECTOR) ?? []
    const next = nextResultFocus('input', event.key, links.length)
    if (next === null || next === 'input') return
    event.preventDefault()
    links[next]?.focus()
  }

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

      <OnboardingSection query={query} />

      <form className="search-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="company-query" className="search-form__label">
          회사명 또는 종목코드
        </label>
        <div className="search-form__row">
          <Input
            id="company-query"
            ref={inputRef}
            invalid={inputError !== null}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="예: 삼성전자, ㅅㅅㅈㅈ, 005930"
            autoComplete="off"
            aria-describedby={inputError ? 'company-query-hint company-query-error' : 'company-query-hint'}
          />
          <Button type="submit" variant="primary" size="lg">
            검색
          </Button>
        </div>
        <FieldHint id="company-query-hint" className="search-form__hint">
          초성으로도 찾을 수 있어요. 결과는 ↓ 키로 고르고 Enter로 열어요.
        </FieldHint>
        {inputError && (
          <p id="company-query-error" className="field-error">
            {inputError}
          </p>
        )}
      </form>

      {query === '' && <FavoriteCompaniesSection />}
      {query === '' && <RecentAnalysesSection />}

      <SearchResult state={state} onRetry={reload} listRef={listRef} onBackToInput={focusInput} />
    </section>
  )
}

/** 검색어가 없고 닫지 않았을 때만 보이는 처음 쓰는 사용자 안내(FS-10) */
function OnboardingSection({ query }: { query: string }) {
  const onboarding = useOnboarding()
  if (!isOnboardingVisible(query, !onboarding.visible)) return null
  return <OnboardingGuide onDismiss={onboarding.dismiss} />
}

/**
 * 검색어가 없을 때만 보이는 로그인한 회원의 관심 기업(#36)과 그 기업들의 새 공시(FS-52). 관심 기업 목록이 비거나
 * 로그인하지 않았으면 목록은 보이지 않고 새 공시 자리에 짧은 안내만 보인다.
 * 목록을 받지 못했으면 빈 목록처럼 숨기지 않고 다시 시도를 안내한다.
 */
function FavoriteCompaniesSection() {
  const favorites = useFavoriteCompanies()
  return match(favorites.status)
    .with('error', () => (
      <AlertState title="관심 기업을 불러오지 못했어요.">
        <Button variant="secondary" onClick={favorites.reload}>
          다시 시도
        </Button>
      </AlertState>
    ))
    .with('loading', () => null)
    .with('anonymous', 'ready', () => (
      <>
        <FavoriteCompanies items={favorites.items} onRemove={favorites.remove} />
        <FavoriteDisclosureFeed companies={favorites.items} signedOut={favorites.status === 'anonymous'} />
      </>
    ))
    .exhaustive()
}

/** 검색어가 없을 때만 보이는 최근 본 분석(FS-7). 목록이 비면 아무것도 보이지 않는다 */
function RecentAnalysesSection() {
  const recent = useRecentAnalyses()
  return <RecentAnalyses items={recent.items} onRemove={recent.remove} onClear={recent.clear} />
}

interface SearchResultProps {
  state: AsyncState<SearchData>
  onRetry: () => void
  listRef: Ref<HTMLUListElement>
  onBackToInput: () => void
}

function SearchResult({ state, onRetry, listRef, onBackToInput }: SearchResultProps) {
  return match(state)
    .with({ status: 'idle' }, () => null)
    .with({ status: 'loading' }, () => <LoadingState message="기업을 찾는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={onRetry} messages={errorMessages} />)
    .with({ status: 'success', data: { items: [] } }, ({ data }) => (
      <EmptyState title={`'${data.query}'에 맞는 기업이 없습니다.`}>
        <p>회사명 일부, 초성(예: ㅅㅅㅈㅈ), 종목코드 6자리로 다시 검색해 보세요. '(주)' 같은 표기는 빼고 입력해요.</p>
      </EmptyState>
    ))
    .with({ status: 'success' }, ({ data }) => (
      <CompanyList ref={listRef} items={data.items} query={data.query} onBackToInput={onBackToInput} />
    ))
    .exhaustive()
}
