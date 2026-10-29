import { Link, Outlet, useLocation, useMatches, useParams } from 'react-router'
import { match } from 'ts-pattern'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { useCurrentCompany } from '@/shared/hooks/useCurrentCompany'
import { compareLink, isCurrentRoute, sourceLink, type CurrentCompany } from '@/shared/lib/currentCompany'
import { useAuth } from '@/shared/auth/authContext'
import { NotificationMenu } from '@/features/notifications/components/NotificationMenu'
import { NotificationSignInLink } from '@/features/notifications/components/NotificationSignInLink'
import { Kbd } from '@/shared/ui/Dialog'
import type { ShortcutPage } from '@/shared/lib/shortcuts'
import { ShortcutHelp } from './ShortcutHelp'
import { useShortcuts } from './useShortcuts'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { useTheme } from '@/shared/hooks/useTheme'
import { THEME_OPTIONS, type ThemeChoice } from '@/shared/lib/theme'
import type { SegmentOption } from '@/shared/ui/SegmentedControl'

type Section = 'search' | 'compare' | 'source' | 'notes' | 'companies'

const THEME_ICONS: Record<ThemeChoice, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' }
const THEME_SEGMENTS: SegmentOption<ThemeChoice>[] = THEME_OPTIONS.map((option) => ({
  ...option,
  icon: THEME_ICONS[option.value],
}))

interface NavItem {
  section: Section
  label: string
  icon: IconName
  to: string
}

/**
 * 화면 골격: 왼쪽 메뉴, 상단 헤더(경로 표시), 본문, 하단 출처·안내 줄.
 * 왼쪽 메뉴는 어디서나 쓰는 공통 메뉴와, 마지막으로 연 기업에 딸린 '지금 보는 기업' 묶음으로 나눈다(#502).
 * 선택 상태는 주소로, 기업 묶음은 기업·분석 화면이 남긴 값으로 정한다(데이터를 따로 불러오지 않음).
 */
export function Layout() {
  const { pathname, search } = useLocation()
  const { corpCode, analysisId } = useParams()
  const crumb = useCrumb()
  const auth = useAuth()
  const theme = useTheme()
  const current = useCurrentCompany()

  const onResult = analysisId !== undefined && !pathname.endsWith('/progress')
  const tab = new URLSearchParams(search).get('tab')
  const active = activeSection(pathname, onResult && tab === 'source', corpCode !== undefined || analysisId !== undefined)
  const shortcutPage = shortcutPageOf(pathname, onResult)
  const shortcuts = useShortcuts(shortcutPage)

  const items: NavItem[] = [
    { section: 'search', label: '기업 찾기', icon: 'search', to: '/' },
    {
      section: 'companies',
      label: '기업 나란히 보기',
      icon: 'table-2',
      to: corpCode !== undefined ? `/compare/companies?corps=${encodeURIComponent(corpCode)}` : '/compare/companies',
    },
    { section: 'notes', label: '내 판단 노트', icon: 'bookmark', to: '/notes' },
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
                <NavLink item={item} active={active} />
              </li>
            ))}
          </ul>
          <CompanyNav company={current} active={current !== null && isCurrentRoute(current, { corpCode, analysisId }) ? active : null} />
        </nav>
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
              variant="icon"
              options={THEME_SEGMENTS}
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
              {match(auth.state.status)
                .with('authenticated', () => (
                  <>
                    <NotificationMenu refreshKey={pathname} />
                    <Button variant="secondary" onClick={() => void auth.logout()}>로그아웃</Button>
                  </>
                ))
                .with('loading', 'anonymous', () => (
                  <>
                    <NotificationSignInLink />
                    <ButtonLink to="/login" variant="secondary" aria-current={pathname === '/login' ? 'page' : undefined}>로그인</ButtonLink>
                    <ButtonLink to="/signup" variant="secondary" aria-current={pathname === '/signup' ? 'page' : undefined}>회원가입</ButtonLink>
                  </>
                ))
                .exhaustive()}
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

function NavLink({ item, active }: { item: NavItem; active: Section | null }) {
  return (
    <Link to={item.to} className="app-nav__item" aria-current={active === item.section ? 'page' : undefined}>
      <Icon name={item.icon} />
      {item.label}
    </Link>
  )
}

/** '지금 보는 기업' 묶음(#502). 기업을 연 적이 없으면 안내 글만, 분석이 없으면 '원문 확인' 없이 보인다 */
function CompanyNav({ company, active }: { company: CurrentCompany | null; active: Section | null }) {
  if (company === null) {
    return <p className="app-nav__placeholder">기업을 열면 여기에 공시 비교·원문 확인이 생겨요.</p>
  }
  const source = sourceLink(company)
  const items: NavItem[] = [
    { section: 'compare', label: '공시 비교', icon: 'columns-2', to: compareLink(company) },
    ...(source === null ? [] : [{ section: 'source' as const, label: '원문 확인', icon: 'file-search' as const, to: source }]),
  ]
  return (
    <div className="app-nav__group" role="group" aria-labelledby="app-nav-company-title">
      <p className="app-nav__title" id="app-nav-company-title">
        지금 보는 기업
      </p>
      <p className="app-nav__company">
        {company.corpName}
        {company.stockCode && <span className="app-nav__company-code">{company.stockCode}</span>}
      </p>
      <ul className="app-nav__list app-nav__list--sub">
        {items.map((item) => (
          <li key={item.section}>
            <NavLink item={item} active={active} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 지금 주소에 해당하는 메뉴. 분석 결과의 원문 탭은 '원문 확인', 그 밖의 기업·분석 화면은 '공시 비교' */
function activeSection(pathname: string, onSourceTab: boolean, onCompare: boolean): Section | null {
  if (pathname === '/') return 'search'
  if (pathname === '/notes') return 'notes'
  if (pathname === '/compare/companies') return 'companies'
  if (onSourceTab) return 'source'
  if (onCompare) return 'compare'
  return null
}

function shortcutPageOf(pathname: string, onResult: boolean): ShortcutPage {
  if (pathname === '/') return 'search'
  if (onResult) return 'result'
  return 'other'
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
