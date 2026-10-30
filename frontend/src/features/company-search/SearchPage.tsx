import { useCallback, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { Link, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import type { AsyncState } from '@/shared/hooks/asyncState'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { useRecentAnalyses } from '@/shared/hooks/useRecentAnalyses'
import { cx } from '@/shared/lib/cx'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'
import { pageTitle } from '@/shared/lib/pageTitle'
import { formatDate } from '@/shared/lib/reportLabels'
import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'
import { BrandLogo, Button, ButtonLink, Card, Dialog, FieldHint, Icon, Input, Notice, Page, Tabs } from '@/shared/ui'
import { AlertState, EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { CompanyList, RESULT_LINK_SELECTOR } from './components/CompanyList'
import { FavoriteCompanies } from './components/FavoriteCompanies'
import { FavoriteDisclosureFeed } from './components/FavoriteDisclosureFeed'
import { FeaturedCompanies } from './components/FeaturedCompanies'
import { OnboardingStepsList } from './components/OnboardingGuide'
import { RecentAnalyses } from './components/RecentAnalyses'
import { SeasonChanges } from './components/SeasonChanges'
import { useAutoSearch } from './hooks/useAutoSearch'
import { useCompanySearch, type SearchResult as SearchData } from './hooks/useCompanySearch'
import { useFeaturedCompanies } from './hooks/useFeaturedCompanies'
import { useSearchForm } from './hooks/useSearchForm'
import {
  buildHomeTabs,
  pickQuickFeatured,
  resolveHomeTab,
  serializeHomeTab,
  type HomeModal,
  type QuickFeatured,
} from './model/homeLayout'
import { nextResultFocus } from './model/resultFocus'
import './company-search.css'

const errorMessages: Record<string, string> = {
  COMPANY_LIST_NOT_LOADED: '기업 목록이 아직 준비되지 않았어요. 관리자에게 기업 목록 갱신을 요청해 주세요.',
}

/**
 * W-01 ① 기업 검색(#538).
 * 검색 전 첫 화면은 중앙 집중 검색창과 핵심 바로가기 칩만 첫 시야에 두고,
 * 보조 탐색 목록(최근 본 분석·관심 기업 새 공시·이번 시즌 변화·대표 기업)은 아래 단일 탭 보드로 정돈한다.
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
  const [modal, setModal] = useState<HomeModal>('none')
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

  function handleClear() {
    setInput('')
    if (query !== '') {
      setSearchParams({}, { replace: true })
    }
    focusInput()
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

          <form className="search-form" onSubmit={handleSubmit} noValidate>
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
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
            <FieldHint id="company-query-hint" className="search-form__hint">
              초성으로도 찾을 수 있어요. 결과는 ↓ 키로 고르고 Enter로 열어요.
            </FieldHint>
            {inputError && (
              <p id="company-query-error" className="field-error">
                {inputError}
              </p>
            )}
          </form>
          <p className="search-hero__lead">회사를 찾고, 보고서 두 개를 고르면, 바뀐 수치와 문장을 원문 근거와 함께 보여 드려요.</p>
        </div>

        {isHome && (
          <HomeBody
            rawTab={rawTab}
            onChangeTab={(serialized) =>
              setSearchParams(serialized === null ? {} : { tab: serialized }, { replace: true })
            }
            onOpenModal={setModal}
            onAddFavorite={focusInput}
          />
        )}

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

      {modal === 'notice' && (
        <Dialog titleId="home-notice-title" title="이용 안내" onClose={() => setModal('none')}>
          <div className="home-dialog">
            <ul className="home-dialog__list">
              {SERVICE_NOTICE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="onboarding__actions">
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

interface HomeBodyProps {
  rawTab: string | null
  onChangeTab: (serialized: string | null) => void
  onOpenModal: (modal: Exclude<HomeModal, 'none'>) => void
  /** 자주 찾는 기업 카드의 '+ 기업 추가'(검색창으로 초점) */
  onAddFavorite: () => void
}

/**
 * 검색 전 첫 화면 본문(#538, #549). 검색창 아래 '자주 찾는 기업 (즐겨찾기)' 카드(로그인 전엔 로그인 안내 한 줄),
 * 관심 기업이 없으면 대표 기업 바로가기 칩, 서비스 안내 한 줄, 그 아래 탭 카드(최근 본 분석·관심 기업 새 공시·이번 시즌 변화·대표 기업).
 */
function HomeBody({ rawTab, onChangeTab, onOpenModal, onAddFavorite }: HomeBodyProps) {
  const favorites = useFavoriteCompanies()
  const featured = useFeaturedCompanies()
  const recent = useRecentAnalyses()

  const hasRecent = recent.items.length > 0
  const hasFavorites = favorites.status === 'ready' && favorites.items.length > 0
  const tabs = buildHomeTabs({ hasRecent, hasFavorites })
  const activeTab = resolveHomeTab(rawTab, tabs)
  const quickFeatured =
    !hasFavorites && featured.state.status === 'success' ? pickQuickFeatured(featured.state.data) : null

  return (
    <>
      <div className="home-shortcuts">
        {match(favorites.status)
          .with('error', () => (
            <AlertState title="관심 기업을 불러오지 못했어요.">
              <Button variant="secondary" onClick={favorites.reload}>
                다시 시도
              </Button>
            </AlertState>
          ))
          .with('ready', () => (
            <FavoriteCompanies items={favorites.items} onRemove={favorites.remove} onAdd={onAddFavorite} />
          ))
          .with('anonymous', () => <SignInPrompt />)
          .with('loading', () => null)
          .exhaustive()}
        <QuickFeaturedChips data={quickFeatured} />
      </div>

      <div className="home-meta" role="group" aria-label="서비스 안내 바로가기">
        <Button variant="link" className="home-meta__button" onClick={() => onOpenModal('guide')}>
          처음이신가요? 사용법 보기
        </Button>
        <span className="home-meta__dot" aria-hidden="true">
          ·
        </span>
        <span className="home-meta__text">AI 생성 표시 · 투자 조언 아님</span>
        <span className="home-meta__dot" aria-hidden="true">
          ·
        </span>
        <Button variant="link" className="home-meta__button" onClick={() => onOpenModal('notice')}>
          이용 안내
        </Button>
      </div>

      <Card className="home-shelf">
        <Tabs
          label="첫 화면 둘러보기"
          items={tabs}
          value={activeTab}
          onChange={(next) => {
            if (next !== activeTab) onChangeTab(serializeHomeTab(next, tabs))
          }}
        />
        <div className="home-shelf__panel">
          {match(activeTab)
            .with('recent', () => (
              <RecentAnalyses items={recent.items} onRemove={recent.remove} onClear={recent.clear} />
            ))
            .with('disclosures', () => (
              <FavoriteDisclosureFeed companies={favorites.items} waiting={favorites.status === 'loading'} />
            ))
            .with('season', () => <SeasonChanges />)
            .with('featured', () => <FeaturedCompanies state={featured.state} onRetry={featured.reload} />)
            .exhaustive()}
        </div>
      </Card>
    </>
  )
}

/** 로그인 전 '자주 찾는 기업' 자리의 한 줄(#549). 로그인하면 관심 기업 칩과 새 공시 탭이 여기에 생긴다 */
function SignInPrompt() {
  return (
    <Card className="home-signin">
      <span className="home-signin__icon" aria-hidden="true">
        <Icon name="star" size={16} />
      </span>
      <p className="home-signin__text">관심 기업의 새 공시는 로그인하면 여기에 모여요</p>
      <Link to="/login" className="home-signin__link">
        로그인
      </Link>
    </Card>
  )
}

function QuickFeaturedChips({ data }: { data: QuickFeatured | null }) {
  if (data === null) return null
  return (
    <nav className="quick-featured" aria-label="대표 기업 바로가기">
      <ul className="quick-featured__list">
        {data.items.map((item, index) => (
          <li key={item.corpCode} className="favorite-chip" style={{ '--row': index } as CSSProperties}>
            <Link
              to={`/companies/${encodeURIComponent(item.corpCode)}`}
              className="favorite-chip__link featured-chip__link"
            >
              <span className="favorite-chip__name">{item.corpName}</span>
              {item.stockCode && <span className="favorite-chip__meta">{item.stockCode}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <p className="quick-featured__note">
        유가증권시장 시가총액 상위 · {formatDate(data.baseDate)} 기준 · 출처: {data.source}
      </p>
    </nav>
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
