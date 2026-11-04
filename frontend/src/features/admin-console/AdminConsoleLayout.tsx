import { Link, NavLink, Outlet } from 'react-router'
import { match } from 'ts-pattern'
import { useAdminAccess } from '@/shared/hooks/useAdminAccess'
import { BrandLogo, ButtonLink, Icon, type IconName } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import './admin-console.css'

interface ConsoleNavItem {
  to: string
  label: string
  icon: IconName
  /** 콘솔 밖 화면(새로 열지 않고 그 화면으로 감) */
  external?: boolean
  /** /admin처럼 하위 경로에서는 켜지지 않아야 하는 메뉴 */
  end?: boolean
}

const NAV_GROUPS: { title: string; items: ConsoleNavItem[] }[] = [
  {
    title: '운영',
    items: [
      { to: '/admin', label: '개요', icon: 'layout-dashboard', end: true },
      { to: '/admin/analyses', label: '분석 작업', icon: 'list' },
      { to: '/admin/users', label: '회원', icon: 'users' },
    ],
  },
  {
    title: '품질·신뢰',
    items: [
      { to: '/admin/reports', label: '신고 처리', icon: 'flag' },
      { to: '/system/ai-usage', label: 'AI 사용 현황', icon: 'monitor', external: true },
    ],
  },
]

/**
 * 관리자 운영 콘솔(FS-72) 틀. 서비스 상단 바 대신 왼쪽 메뉴를 두고 본문에 개요·분석 작업·회원·신고 처리를 그린다.
 * 들어올 수 있는지는 화면이 GET /api/sessions/current의 admin으로 먼저 보고, 권한은 서버가 API마다 다시 확인한다(ADR-0040).
 * 좁은 화면(900px 이하)에서는 메뉴가 위쪽 가로 줄이 된다.
 */
export function AdminConsoleLayout() {
  const { access, reload } = useAdminAccess()

  return (
    <div className="console">
      <a className="skip-link" href="#console-main">
        본문으로 건너뛰기
      </a>
      <aside className="console__side" aria-label="운영 콘솔 메뉴">
        <Link to="/admin" className="console__brand" aria-label="운영 콘솔 개요">
          <BrandLogo />
          <span className="console__brand-sub">운영 콘솔</span>
        </Link>
        <nav className="console__nav" aria-label="운영 콘솔">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="console__group">
              <p className="console__group-title">{group.title}</p>
              <ul className="console__list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className="console__link">
                      <Icon name={item.icon} size={16} />
                      <span>{item.label}</span>
                      {item.external && (
                        <span className="console__external" aria-label="(콘솔 밖 화면)">
                          ↗
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Link to="/" className="console__back">
          <Icon name="arrow-left" size={16} />
          서비스로 돌아가기
        </Link>
      </aside>
      <main className="console__main" id="console-main" tabIndex={-1}>
        {match(access)
          .with({ status: 'loading' }, () => <LoadingState message="권한을 확인하는 중이에요…" />)
          .with({ status: 'anonymous' }, () => (
            <EmptyState title="로그인한 관리자만 볼 수 있어요">
              <ButtonLink variant="primary" to="/login">
                로그인하기
              </ButtonLink>
            </EmptyState>
          ))
          .with({ status: 'member' }, () => (
            <EmptyState title="관리자만 들어올 수 있어요">
              <p className="console-gate-text">관리자 권한은 운영자가 정한 이메일로 로그인한 계정에만 있어요.</p>
              <ButtonLink variant="secondary" to="/">
                서비스로 돌아가기
              </ButtonLink>
            </EmptyState>
          ))
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
          .with({ status: 'admin' }, () => <Outlet />)
          .exhaustive()}
      </main>
    </div>
  )
}
