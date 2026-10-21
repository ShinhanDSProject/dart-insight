import { Link, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__inner">
          <Link to="/" className="layout__brand">
            Dart Insight
          </Link>
          <span className="layout__tagline">정기보고서 비교</span>
        </div>
      </header>
      <main className="layout__main">
        <div className="layout__inner">
          <Outlet />
        </div>
      </main>
      <footer className="layout__footer">
        <div className="layout__inner">
          출처: 금융감독원 전자공시시스템(DART). 투자 판단을 돕는 정보가 아니며, 매수·매도를 권하지 않습니다.
        </div>
      </footer>
    </div>
  )
}
