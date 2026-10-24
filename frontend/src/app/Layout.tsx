import { Link, Outlet, useLocation, useMatches, useNavigate, useParams } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { useOnboarding } from '@/shared/hooks/useOnboarding'
import { useAuth } from '@/shared/auth/authContext'
import { Kbd } from '@/shared/ui/Dialog'
import type { ShortcutPage } from '@/shared/lib/shortcuts'
import { ShortcutHelp } from './ShortcutHelp'
import { useShortcuts } from './useShortcuts'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { useTheme } from '@/shared/hooks/useTheme'
import { THEME_OPTIONS } from '@/shared/lib/theme'

type Section = 'search' | 'compare' | 'source'

interface NavItem {
  section: Section
  label: string
  icon: IconName
  /** 지금 화면에서 갈 곳이 없으면 null(누를 수 없게 보여 줌) */
  to: string | null
  hint?: string
}

/**
 * 화면 골격: 왼쪽 메뉴, 상단 헤더(경로 표시), 본문, 하단 출처·안내 줄.
 * 메뉴의 선택 상태와 이동할 곳은 주소만 보고 정한다(데이터를 따로 불러오지 않음).
 */
export function Layout() {
  const { pathname, search } = useLocation()
  const { corpCode, analysisId } = useParams()
  const crumb = useCrumb()
  const auth = useAuth()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const theme = useTheme()

  /** 사용법 안내(FS-10)를 다시 열고, 안내가 보이는 검색 첫 화면(검색어 없음)으로 간다 */
  function showGuideAgain() {
    onboarding.reopen()
    navigate('/')
  }

  const onResult = analysisId !== undefined && !pathname.endsWith('/progress')
  const tab = new URLSearchParams(search).get('tab')
  const active: Section | null =
    pathname === '/'
      ? 'search'
      : onResult && tab === 'source'
        ? 'source'
        : corpCode !== undefined || analysisId !== undefined
          ? 'compare'
          : null
  const shortcutPage: ShortcutPage = pathname === '/' ? 'search' : onResult ? 'result' : 'other'
  const shortcuts = useShortcuts(shortcutPage)

  const items: NavItem[] = [
    { section: 'search', label: '기업 찾기', icon: 'search', to: '/' },
    {
      section: 'compare',
      label: '공시 비교',
      icon: 'columns-2',
      to:
        corpCode !== undefined
          ? `/companies/${encodeURIComponent(corpCode)}`
          : analysisId !== undefined
            ? `/analyses/${encodeURIComponent(analysisId)}`
            : '/',
    },
    {
      section: 'source',
      label: '원문 확인',
      icon: 'file-search',
      to: analysisId !== undefined ? `/analyses/${encodeURIComponent(analysisId)}?tab=source` : null,
      hint: '분석 결과에서 열 수 있어요',
    },
  ]

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <aside className="app-sidebar">
        <Link to="/" className="app-brand" aria-label="DART Insight 첫 화면">
          <span className="app-brand__mark" aria-hidden="true">
            <span className="app-brand__sheet" />
            <span className="app-brand__sheet app-brand__sheet--tall" />
          </span>
          <span className="app-brand__words">
            <span className="app-brand__name">DART Insight</span>
            <span className="app-brand__tagline">공시의 변화를 읽다</span>
          </span>
        </Link>

        <nav className="app-nav" aria-labelledby="app-nav-title">
          <p className="app-nav__title" id="app-nav-title">
            WORKSPACE
          </p>
          <ul className="app-nav__list">
            {items.map((item) => (
              <li key={item.section}>
                {item.to === null ? (
                  <span className="app-nav__item app-nav__item--disabled" aria-disabled="true" title={item.hint}>
                    <Icon name={item.icon} />
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    className="app-nav__item"
                    aria-current={active === item.section ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="app-guide">
          <Icon name="book-open" />
          <p className="app-guide__title">변화는 비교하고, 근거는 직접 확인하세요.</p>
          <p className="app-guide__text">공시 기재 내용에 한정해 숫자와 문장을 연결합니다.</p>
          <Button variant="link" className="app-guide__action" onClick={showGuideAgain}>
            사용법 다시 보기
          </Button>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <p className="app-header__path">
            <Icon name="panels-top-left" size={18} />
            <span>정기공시 비교</span>
            {crumb && (
              <>
                <Icon name="chevron-right" size={14} />
                <strong className="app-header__current">{crumb}</strong>
              </>
            )}
          </p>
          <div className="app-header__tools">
            <SegmentedControl
              options={THEME_OPTIONS}
              value={theme.choice}
              onChange={theme.setChoice}
              aria-label="화면 테마"
            />
            <Button
              className="app-header__shortcuts"
              aria-haspopup="dialog"
              aria-keyshortcuts="?"
              onClick={shortcuts.openHelp}
            >
              단축키 <Kbd>?</Kbd>
            </Button>
            <div className="app-header__auth">
              {auth.state.status === 'authenticated' ? (
                <button type="button" className="button button--secondary" onClick={() => void auth.logout()}>로그아웃</button>
              ) : (
                <>
                  <Link to="/login" className="button button--secondary" aria-current={pathname === '/login' ? 'page' : undefined}>로그인</Link>
                  <Link to="/signup" className="button button--secondary" aria-current={pathname === '/signup' ? 'page' : undefined}>회원가입</Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="app-main" id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <Icon name="shield-alert" size={16} />
          <p>출처: 금융감독원 전자공시시스템(DART). 투자 판단을 돕는 정보가 아니며, 매수·매도를 권하지 않습니다.</p>
          <Link to="/system/ai-usage" className="app-footer__link">
            시스템 · AI 사용 현황
          </Link>
        </footer>
      </div>
      {shortcuts.helpOpen && <ShortcutHelp page={shortcutPage} onClose={shortcuts.closeHelp} />}
    </div>
  )
}

/** 가장 안쪽 경로의 handle.crumb(router.tsx) */
function useCrumb(): string | null {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle as { crumb?: string } | undefined
    if (handle?.crumb) return handle.crumb
  }
  return null
}
