import { Link, useNavigate, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, Card, Icon, Page, PageHeader, Tabs } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { FavoriteCompanies } from './components/FavoriteCompanies'
import { FavoriteDisclosureFeed } from './components/FavoriteDisclosureFeed'
import { FeaturedCompanies } from './components/FeaturedCompanies'
import { SeasonChanges } from './components/SeasonChanges'
import { useFeaturedCompanies } from './hooks/useFeaturedCompanies'
import { buildHomeTabs, resolveHomeTab, serializeHomeTab } from './model/homeLayout'
import './company-search.css'

/**
 * 둘러보기(FS-67 R4). 예전 첫 화면 아래에 있던 '자주 찾는 기업' 카드와 탭 보드(관심 기업 새 공시·이번 시즌 변화·대표 기업, #560)를
 * 그대로 옮겼다. 첫 화면은 검색창만 두고, 검색창 펼침 상자의 '둘러보기'로 여기에 온다. 최근 본 분석은 펼침 상자에 있다. 고른 탭은 주소(?tab=)에 남긴다.
 */
export function ExplorePage() {
  useDocumentTitle(pageTitle(['둘러보기']))
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const favorites = useFavoriteCompanies()
  const featured = useFeaturedCompanies()

  const hasFavorites = favorites.status === 'ready' && favorites.items.length > 0
  const tabs = buildHomeTabs({ hasFavorites })
  const activeTab = resolveHomeTab(searchParams.get('tab'), tabs)

  return (
    <Page className="explore-page">
      <PageHeader
        breadcrumb={
          <>
            <Link to="/">기업 검색</Link> / 둘러보기
          </>
        }
        title="둘러보기"
        lead="자주 찾는 기업과 관심 기업의 새 공시, 이번 시즌 변화가 큰 기업, 대표 기업을 모아 봤어요."
      />

      {match(favorites.status)
        .with('error', () => (
          <AlertState title="관심 기업을 불러오지 못했어요.">
            <Button variant="secondary" onClick={favorites.reload}>
              다시 시도
            </Button>
          </AlertState>
        ))
        .with('ready', () => (
          // '+ 기업 추가'는 첫 화면 검색창으로 간다. 기업 화면의 별로 더한다
          <FavoriteCompanies items={favorites.items} onRemove={favorites.remove} onAdd={() => navigate('/')} />
        ))
        .with('anonymous', () => <SignInPrompt />)
        .with('loading', () => null)
        .exhaustive()}

      <Card className="home-shelf">
        <Tabs
          label="둘러보기"
          items={tabs}
          value={activeTab}
          onChange={(next) => {
            if (next === activeTab) return
            const serialized = serializeHomeTab(next, tabs)
            setSearchParams(serialized === null ? {} : { tab: serialized }, { replace: true })
          }}
        />
        <div className="home-shelf__panel">
          {match(activeTab)
            .with('disclosures', () => (
              <FavoriteDisclosureFeed companies={favorites.items} waiting={favorites.status === 'loading'} />
            ))
            .with('season', () => <SeasonChanges />)
            .with('featured', () => <FeaturedCompanies state={featured.state} onRetry={featured.reload} />)
            .exhaustive()}
        </div>
      </Card>
    </Page>
  )
}

/** 로그인 전 '자주 찾는 기업' 자리의 한 줄(#549). 첫 화면 펼침 상자의 로그인 안내와 같은 모양이다 */
function SignInPrompt() {
  return (
    <Card className="explore-signin">
      <p className="search-drop__signin">
        <Icon name="star" size={16} />
        <span>관심 기업의 새 공시는 로그인하면 여기에 모여요</span>
        <Link to="/login">로그인</Link>
      </p>
    </Card>
  )
}
