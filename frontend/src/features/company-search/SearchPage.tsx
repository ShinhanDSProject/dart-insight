import {
  useCallback,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useFavoriteCompanies, type FavoriteCompaniesStatus } from '@/shared/hooks/useFavoriteCompanies'
import { useRecentAnalyses } from '@/shared/hooks/useRecentAnalyses'
import { cx } from '@/shared/lib/cx'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'
import { pageTitle } from '@/shared/lib/pageTitle'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import { BrandLogo, Button, ButtonLink, Card, Dialog, FieldHint, Icon, Input, Notice, Page } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { CompanyList, RESULT_LINK_SELECTOR } from './components/CompanyList'
import { OnboardingStepsList } from './components/OnboardingGuide'
import { RecentAnalyses } from './components/RecentAnalyses'
import { useAutoSearch } from './hooks/useAutoSearch'
import { useCompanySearch, type SearchResult as SearchData } from './hooks/useCompanySearch'
import { useSearchForm } from './hooks/useSearchForm'
import { EXAMPLE_QUERIES, type HomeModal } from './model/homeLayout'
import { nextResultFocus } from './model/resultFocus'
import './company-search.css'

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/**
 * W-01 ① 기업 검색(#538, #560, FS-67).
 * 검색 전 첫 화면은 로고와 검색창만 둔다. 빈 검색창에 초점을 주면 아래로 펼침 상자(최근 본 분석·자주 찾는 기업·
 * 예시 검색어·둘러보기·사용법)가 열리고, 관심 기업 새 공시·이번 시즌 변화·대표 기업 탭은 둘러보기 화면(/explore)에 둔다.
 * 검색어는 주소(?q=)에 남겨 뒤로 가기를 해도 결과가 유지되며, 입력을 멈추면 Enter 없이도 찾는다.
 */
export function SearchPage() {
  useDocumentTitle(pageTitle(['기업 검색']))
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const rawTab = searchParams.get('tab')
  const isHome = query === ''
  const { input, inputError, setInput, submit } = useSearchForm(query)
  const { state, reload } = useCompanySearch(query)
  const recent = useRecentAnalyses()
  const favorites = useFavoriteCompanies()
  const [modal, setModal] = useState<HomeModal>('none')
  // 펼침 상자는 초점이 있으면 CSS로 보이고, Esc로 닫으면 다시 누르거나 입력할 때까지 그리지 않는다(FS-67 R3)
  const [drop, setDrop] = useState<'auto' | 'dismissed'>('auto')
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

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Escape' || drop === 'dismissed' || !isHome || input !== '') return
    setDrop('dismissed')
    // 상자 안 링크에서 눌렀으면 검색창으로 초점을 돌린다(검색창 onFocus는 상자 안에서 온 초점이면 다시 열지 않는다)
    focusInput()
  }

  /** 바깥에서 검색창으로 초점이 오면 상자를 다시 연다. 상자 안에서 돌아온 초점은 그대로 둔다 */
  function handleInputFocus(event: ReactFocusEvent<HTMLInputElement>) {
    const from = event.relatedTarget
    if (from instanceof Node && event.currentTarget.form?.contains(from)) return
    setDrop('auto')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = submit()
    if (next !== null) {
      setSearchParams({ q: next })
    }
  }

  function handleClear() {
    setInput('')
    if (query !== '') {
      setSearchParams({}, { replace: true })
    }
    focusInput()
  }

  // 예전 첫 화면 탭 주소(/?tab=)는 둘러보기 화면으로 보낸다(FS-67 R5)
  if (isHome && rawTab !== null) {
    return <Navigate to={{ pathname: '/explore', search: `?tab=${encodeURIComponent(rawTab)}` }} replace />
  }

  return (
    <Page className="search-page">
      <div className="search-page__shell">
        <div className={cx('search-hero', isHome && 'search-hero--home')}>
          {/* 로고가 화면 제목이다. 화면 읽기 도구에는 '기업 검색'을 함께 읽는다 */}
          <h1 className="search-hero__title">
            <BrandLogo size="lg" />
            <span className="visually-hidden"> 기업 검색</span>
          </h1>

          <form className="search-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
            {/* 보이는 제목 대신 입력창 안내 글을 쓰고, 화면 읽기 프로그램에는 이름을 그대로 준다(#486) */}
            <label htmlFor="company-query" className="visually-hidden">
              회사명 또는 종목코드
            </label>
            <div className={cx('search-bar', inputError !== null && 'search-bar--invalid')}>
              <span className="search-bar__icon" aria-hidden="true">
                <Icon name="search" size={18} />
              </span>
              <Input
                id="company-query"
                ref={inputRef}
                className="search-bar__input"
                invalid={inputError !== null}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setDrop('auto')
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={handleInputFocus}
                onClick={() => setDrop('auto')}
                placeholder="회사명·종목코드·초성 (예: 삼성전자, 005930, ㅅㅅㅈㅈ)"
                autoComplete="off"
                aria-describedby={inputError ? 'company-query-hint company-query-error' : 'company-query-hint'}
              />
              {input !== '' && (
                <Button variant="icon" className="search-bar__clear" aria-label="검색어 지우기" onClick={handleClear}>
                  <Icon name="x" size={16} />
                </Button>
              )}
              <Button type="submit" variant="primary" className="search-bar__submit">
                검색
              </Button>
            </div>
            {isHome && input === '' && drop === 'auto' && (
              <SearchDrop
                recent={recent}
                favoritesStatus={favorites.status}
                favorites={favorites.items}
                onOpenGuide={() => setModal('guide')}
              />
            )}
            <FieldHint id="company-query-hint" className="visually-hidden">
              초성으로도 찾을 수 있어요. 결과는 ↓ 키로 고르고 Enter로 열어요.
            </FieldHint>
            {inputError && (
              <p id="company-query-error" className="field-error">
                {inputError}
              </p>
            )}
          </form>
        </div>

        <SearchResult state={state} onRetry={reload} listRef={listRef} onBackToInput={focusInput} />
      </div>

      {modal === 'guide' && (
        <Dialog titleId="home-guide-title" title="처음이신가요? 이렇게 써 보세요" onClose={() => setModal('none')}>
          <div className="home-dialog">
            <OnboardingStepsList />
            <div className="onboarding__actions">
              <ButtonLink variant="primary" to={`/companies/${ONBOARDING_EXAMPLE_CORP_CODE}`}>
                삼성전자로 해보기
              </ButtonLink>
              <Button variant="secondary" onClick={() => setModal('none')}>
                닫기
              </Button>
            </div>
          </div>
        </Dialog>
      )}

    </Page>
  )
}

/** 시안의 '이렇게 찾아보세요'(#560). 검색어를 넣은 검색 결과로 간다. FS-67부터 펼침 상자 안에 둔다 */
function ExampleQueries() {
  return (
    <nav className="example-queries" aria-label="검색 예시">
      <span className="example-queries__label">이렇게 찾아보세요</span>
      <ul className="example-queries__list">
        {EXAMPLE_QUERIES.map((name) => (
          <li key={name}>
            <Link to={`/?q=${encodeURIComponent(name)}`} className="example-queries__chip">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface SearchDropProps {
  recent: ReturnType<typeof useRecentAnalyses>
  favoritesStatus: FavoriteCompaniesStatus
  favorites: FavoriteCompany[]
  onOpenGuide: () => void
}

// 누를 때 입력창의 초점을 지켜야 펼침 상자가 닫히지 않는다(Safari는 버튼을 눌러도 초점을 옮기지 않는다)
function keepInputFocus(event: MouseEvent) {
  event.preventDefault()
}

/**
 * 빈 검색창에 초점을 주면 아래로 펼치는 상자(#560, FS-67): 최근 본 분석, 자주 찾는 기업(로그인 전엔 로그인 안내),
 * 예시 검색어, 맨 아래 둘러보기·사용법 보기. 보이고 숨기는 것은 CSS(.search-form:focus-within)가 정한다.
 */
function SearchDrop({ recent, favoritesStatus, favorites, onOpenGuide }: SearchDropProps) {
  return (
    <div className="search-drop" onMouseDown={keepInputFocus}>
      <RecentAnalyses items={recent.items} onRemove={recent.remove} onClear={recent.clear} />
      {favoritesStatus === 'ready' && favorites.length > 0 && (
        <section className="search-drop__favorites" aria-labelledby="search-drop-favorites-title">
          <h2 className="search-drop__title" id="search-drop-favorites-title">
            자주 찾는 기업
          </h2>
          <ul className="search-drop__chips">
            {favorites.map((item) => (
              <li key={item.corpCode}>
                <Link to={`/companies/${encodeURIComponent(item.corpCode)}`} className="example-queries__chip">
                  <Icon name="star-filled" size={14} />
                  {item.corpName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {favoritesStatus === 'anonymous' && (
        <p className="search-drop__signin">
          <Icon name="star" size={16} />
          <span>관심 기업의 새 공시는 로그인하면 여기에 모여요</span>
          <Link to="/login">로그인</Link>
        </p>
      )}
      <ExampleQueries />
      <div className="search-drop__foot">
        <Link to="/explore" className="search-drop__explore">
          둘러보기 · 새 공시·시즌 변화·대표 기업 <span aria-hidden="true">→</span>
        </Link>
        <Button variant="link" className="search-drop__guide" onClick={onOpenGuide}>
          처음이신가요? 사용법 보기
        </Button>
      </div>
    </div>
  )
}

interface SearchResultProps {
  state: AsyncState<SearchData>
  onRetry: () => void
  listRef: Ref<HTMLUListElement>
  onBackToInput: () => void
}

/**
 * 검색 결과(#549): '검색 결과 N곳' 카드 안에 결과 목록(없으면 다시 찾는 방법), 아래에 다음 단계 안내 상자.
 * 불러오는 중·오류는 카드 없이 상태만 보인다.
 */
function SearchResult({ state, onRetry, listRef, onBackToInput }: SearchResultProps) {
  return match(state)
    .with({ status: 'idle' }, () => null)
    .with({ status: 'loading' }, () => <LoadingState message="기업을 찾는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={onRetry} messages={errorMessages} />)
    .with({ status: 'success' }, ({ data }) => (
      <>
        <Card as="section" className="search-results" aria-labelledby="search-results-title">
          <div className="search-results__head">
            <h2 className="search-results__title" id="search-results-title">
              검색 결과 {data.items.length}곳
            </h2>
          </div>
          {data.items.length === 0 ? (
            <EmptyState title={`'${data.query}'에 맞는 기업이 없습니다.`}>
              <p>회사명 일부, 초성(예: ㅅㅅㅈㅈ), 종목코드 6자리로 다시 검색해 보세요. '(주)' 같은 표기는 빼고 입력해요.</p>
            </EmptyState>
          ) : (
            <CompanyList
              key={data.query}
              ref={listRef}
              items={data.items}
              query={data.query}
              onBackToInput={onBackToInput}
            />
          )}
        </Card>
        <Notice className="search-results__notice">
          기업을 선택하면 정기보고서 목록에서 이전 보고서와 현재 보고서를 지정할 수 있어요.
        </Notice>
      </>
    ))
    .exhaustive()
}
