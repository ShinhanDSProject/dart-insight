import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router'
import { match } from 'ts-pattern'
import { AppBackdrop } from '@/shared/ui/AppBackdrop'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { useRecentCompanies } from '@/shared/hooks/useCurrentCompany'
import { companyLink, type CurrentCompany } from '@/shared/lib/currentCompany'
import { OPEN_HEADER_SEARCH_EVENT } from '@/shared/lib/headerSearch'
import { useAuth } from '@/shared/auth/authContext'
import { useAdminAccess } from '@/shared/hooks/useAdminAccess'
import { NotificationMenu } from '@/features/notifications/components/NotificationMenu'
import { NotificationSignInLink } from '@/features/notifications/components/NotificationSignInLink'
import type { ShortcutPage } from '@/shared/lib/shortcuts'
import { HEADER_SEARCH_ID, HeaderSearch } from './HeaderSearch'
import { EasterEggDialog } from './EasterEggDialog'
import { ServiceNoticeDialog } from './ServiceNoticeDialog'
import { ShortcutHelp } from './ShortcutHelp'
import { ThemeMenu } from './ThemeMenu'
import { useEasterEgg } from './useEasterEgg'
import { useShortcuts } from './useShortcuts'
import { useLoginHref } from '@/shared/hooks/useLoginHref'
import { useDemoMode } from '@/features/demo-autopilot/hooks/useDemoMode'
import { lazyPage } from './lazyPage'

type Section = 'search' | 'notes' | 'companies'

/** 발표 시연 자동 진행(#967). 시연 모드일 때만 코드를 받는다 */
const DemoAutopilot = lazyPage(() => import('@/features/demo-autopilot/components/DemoAutopilot').then((m) => m.DemoAutopilot))

interface NavItem {
  section: Section
  label: string
  icon: IconName
  to: string
}

const MENU_ID = 'app-header-menu'

/**
 * 화면 골격(#548 심플 통일): 위 상단 바, 가운데 본문, 아래 하단 바. 왼쪽 메뉴는 없다.
 * - 상단 바: 로고(첫 화면), 둥근 기업 검색(첫 화면 밖, 기업·분석 화면에서는 그 기업 이름), 기업 나란히 보기·내 판단 노트, 화면 테마, 로그인/알림.
 *   로그인 전 버튼은 시안처럼 '로그인' 하나다(회원가입은 로그인 화면의 링크, FS-69).
 *   좁은 화면(900px 이하)에서는 로고 옆 메뉴 버튼으로 접는다. 화면을 옮기면 접힌다.
 * - '최근 본 기업' 줄(#502, #589, #652): 연 기업이 있으면 상단 바 아래에 최근 기업 3개까지 가장 최근 것부터 왼쪽에 둔다.
 *   각 기업은 이름(누르면 그 기업의 마지막 분석 결과, #572)과 종목코드다. 기업은 기업·분석 화면이 남긴 값으로 정한다(데이터를 따로 불러오지 않음). 기업 개요는 분석 결과 탭 줄에 있다.
 * - 하단 바: 출처·AI 안내와 이용 안내·단축키·AI 사용 현황.
 */
export function Layout() {
  const loginHref = useLoginHref()
  const { pathname, search } = useLocation()
  const { corpCode, analysisId } = useParams()
  const auth = useAuth()
  // 관리자에게만 상단 바에 '운영 콘솔'을 보인다(FS-72). 권한은 서버가 다시 확인한다
  const { access: adminAccess } = useAdminAccess()
  const recent = useRecentCompanies()
  const current = recent[0] ?? null
  const [noticeOpen, setNoticeOpen] = useState(false)
  // 메뉴를 연 주소. 주소가 바뀌면(화면 이동) 따로 닫지 않아도 접힌다
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt === pathname + search
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const onResult = analysisId !== undefined && !pathname.endsWith('/progress')
  // 상단 검색창에 넣어 둘 기업 이름(FS-69). 그 기업의 화면·분석 결과에 있을 때만
  const searchCompany = current !== null && (corpCode === current.corpCode || (onResult && Number(analysisId) === current.analysisId))
    ? current.corpName
    : null
  const active = activeSection(pathname)
  const shortcutPage = shortcutPageOf(pathname, onResult)
  const shortcuts = useShortcuts(shortcutPage)
  const easterEgg = useEasterEgg()
  const demo = useDemoMode()

  const items: NavItem[] = [
    {
      section: 'companies',
      label: '기업 나란히 보기',
      icon: 'table-2',
      to: corpCode !== undefined ? `/compare/companies?corps=${encodeURIComponent(corpCode)}` : '/compare/companies',
    },
    { section: 'notes', label: '내 판단 노트', icon: 'bookmark', to: '/notes' },
  ]

  // 화면 안의 '기업 변경'(#655): 좁은 화면이면 접힌 메뉴를 열고, 그려진 뒤 검색창에 초점을 옮긴다(글자 전체가 선택됨)
  useEffect(() => {
    const onOpen = () => {
      if (menuButtonRef.current?.offsetParent) setMenuOpenAt(pathname + search)
      requestAnimationFrame(() => document.getElementById(HEADER_SEARCH_ID)?.focus())
    }
    window.addEventListener(OPEN_HEADER_SEARCH_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_HEADER_SEARCH_EVENT, onOpen)
  }, [pathname, search])

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpenAt(null)
      menuButtonRef.current?.focus()
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header" onKeyDown={onMenuKeyDown}>
        <Link to="/" className="app-brand" aria-label="DART Insight 첫 화면" aria-current={active === 'search' ? 'page' : undefined}>
          <BrandLogo />
        </Link>

        <Button
          ref={menuButtonRef}
          variant="icon"
          className="app-header__menu-button"
          aria-label="메뉴"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setMenuOpenAt(menuOpen ? null : pathname + search)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} />
        </Button>

        <div id={MENU_ID} className="app-header__menu" data-open={menuOpen}>
          {pathname !== '/' && <HeaderSearch key={searchCompany ?? ''} companyName={searchCompany} />}
          <nav className="app-nav" aria-label="주 메뉴">
            <ul className="app-nav__list">
              {items.map((item) => (
                <li key={item.section}>
                  <NavLink item={item} active={active} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="app-header__tools">
            <ThemeMenu />
            {match(auth.state.status)
              .with('authenticated', () => (
                <>
                  {adminAccess.status === 'admin' && (
                    <ButtonLink to="/admin" variant="secondary">
                      운영 콘솔
                    </ButtonLink>
                  )}
                  <NotificationMenu refreshKey={pathname} />
                  <Button variant="secondary" onClick={() => void auth.logout()}>로그아웃</Button>
                </>
              ))
              .with('loading', 'anonymous', () => (
                <>
                  <NotificationSignInLink />
                  <ButtonLink to={loginHref} variant="primary" aria-current={pathname === '/login' ? 'page' : undefined}>로그인</ButtonLink>
                </>
              ))
              .exhaustive()}
          </div>
        </div>
      </header>

      <div className="app-workspace">
        <AppBackdrop key={`backdrop:${pathname}`} />
        {recent.length > 0 && (
          <CompanyNav companies={recent} />
        )}
        <main className="app-main" id="main" tabIndex={-1} key={pathname}>
          <Outlet />
        </main>

        <footer className="app-footer">
          <p className="app-footer__source">
            출처: 금융감독원 전자공시시스템(DART) · AI가 만든 문장에는 ‘AI 생성’이 붙고, 투자 조언이 아니에요.
          </p>
          <ul className="app-footer__links">
            <li>
              <Button variant="link" className="app-footer__link" aria-haspopup="dialog" onClick={() => setNoticeOpen(true)}>
                이용 안내
              </Button>
            </li>
            <li className="app-footer__shortcuts">
              <Button variant="link" className="app-footer__link" aria-haspopup="dialog" aria-keyshortcuts="?" onClick={shortcuts.openHelp}>
                단축키
              </Button>
            </li>
            <li>
              <Link to="/pricing" className="app-footer__link">
                요금제
              </Link>
            </li>
            <li>
              <Link to="/system/ai-usage" className="app-footer__link">
                AI 사용 현황
              </Link>
            </li>
          </ul>
        </footer>
      </div>
      {shortcuts.helpOpen && <ShortcutHelp page={shortcutPage} onClose={shortcuts.closeHelp} />}
      {noticeOpen && <ServiceNoticeDialog onClose={() => setNoticeOpen(false)} />}
      {easterEgg.found && <EasterEggDialog onClose={easterEgg.close} />}
      {demo.active && (
        <Suspense fallback={null}>
          <DemoAutopilot key={demo.startStep} startStep={demo.startStep} onExit={demo.exit} />
        </Suspense>
      )}
    </div>
  )
}

function NavLink({ item, active }: { item: NavItem; active: Section | null }) {
  return (
    <Link to={item.to} className="app-nav__item" aria-current={active === item.section ? 'page' : undefined}>
      <Icon name={item.icon} size={16} />
      {item.label}
    </Link>
  )
}

/** '최근 본 기업' 줄(#502, #548, #589, #652). 맨 앞(가장 최근, 지금 보는 기업)을 진하게, 나머지는 흐리게 둔다 */
function CompanyNav({ companies }: { companies: CurrentCompany[] }) {
  return (
    <nav className="app-context" aria-labelledby="app-context-title">
      <div className="app-context__inner">
        <p className="app-context__title" id="app-context-title">
          최근 본 기업
        </p>
        <ul className="app-context__list">
          {companies.map((company, index) => (
            <li key={company.corpCode} className={index === 0 ? 'app-context__company app-context__company--current' : 'app-context__company'}>
              <Link to={companyLink(company)} className="app-context__name">
                {company.corpName}
              </Link>
              {company.stockCode && <span className="app-context__code">{company.stockCode}</span>}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

/** 지금 주소에 해당하는 상단 바 메뉴 */
function activeSection(pathname: string): Section | null {
  if (pathname === '/') return 'search'
  if (pathname === '/notes') return 'notes'
  if (pathname === '/compare/companies') return 'companies'
  return null
}

function shortcutPageOf(pathname: string, onResult: boolean): ShortcutPage {
  if (pathname === '/') return 'search'
  if (onResult) return 'result'
  return 'other'
}
