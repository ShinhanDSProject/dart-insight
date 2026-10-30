// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { Layout } from './Layout'

vi.mock('@/shared/hooks/useCurrentCompany', () => ({ useCurrentCompany: () => null }))

const anonymousAuth: AuthContextValue = {
  state: { status: 'anonymous' },
  login: vi.fn(),
  logout: vi.fn(),
}

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderLayout(initialEntry: string) {
  const router = createMemoryRouter(
    [{ element: <Layout />, children: [{ path: '*', element: <Where /> }] }],
    { initialEntries: [initialEntry] },
  )
  return render(
    <AuthContext.Provider value={anonymousAuth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('Layout 상단 바·하단 바(#548)', () => {
  it('왼쪽 메뉴 없이 상단 바에 로고·기업 검색·주 메뉴·화면 테마·로그인을 두고, 접근성 위반이 없다', async () => {
    const view = renderLayout('/notes')
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'DART Insight 첫 화면' }).getAttribute('href')).toBe('/')
    expect(within(banner).getByRole('search', { name: '기업 검색' })).toBeTruthy()
    const nav = within(banner).getByRole('navigation', { name: '주 메뉴' })
    expect(within(nav).getByRole('link', { name: '기업 나란히 보기' }).getAttribute('href')).toBe('/compare/companies')
    expect(within(nav).getByRole('link', { name: '내 판단 노트' }).getAttribute('aria-current')).toBe('page')
    expect(within(banner).getByRole('button', { name: /화면 테마/ })).toBeTruthy()
    expect(within(banner).getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/login')
    expect(document.querySelector('aside.app-sidebar')).toBeNull()
    expect(await axeViolations(view.container)).toBe('')
  })

  it('첫 화면에서는 상단 바 검색을 두지 않는다(본문에 큰 검색창이 있다)', () => {
    renderLayout('/')
    expect(screen.queryByRole('search', { name: '기업 검색' })).toBeNull()
    expect(screen.getByRole('link', { name: 'DART Insight 첫 화면' }).getAttribute('aria-current')).toBe('page')
  })

  it('상단 바 검색어를 보내면 첫 화면 검색 결과로 간다', () => {
    renderLayout('/notes')
    const input = screen.getByRole('searchbox', { name: '회사명 또는 종목코드' })
    fireEvent.change(input, { target: { value: ' 삼성 전자 ' } })
    fireEvent.submit(screen.getByRole('search', { name: '기업 검색' }))
    expect(screen.getByTestId('where').textContent).toBe('/?q=%EC%82%BC%EC%84%B1%20%EC%A0%84%EC%9E%90')
  })

  it('하단 바에 출처·AI 안내와 이용 안내·단축키·AI 사용 현황을 두고, 이용 안내와 단축키는 대화상자로 연다', () => {
    renderLayout('/notes')
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toContain('출처: 금융감독원 전자공시시스템(DART)')
    expect(within(footer).getByRole('link', { name: 'AI 사용 현황' }).getAttribute('href')).toBe('/system/ai-usage')

    fireEvent.click(within(footer).getByRole('button', { name: '이용 안내' }))
    const notice = screen.getByRole('dialog', { name: '이용 안내' })
    expect(notice.textContent).toContain('투자 조언이 아니며')
    fireEvent.keyDown(notice, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '이용 안내' })).toBeNull()

    fireEvent.click(within(footer).getByRole('button', { name: '단축키' }))
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeTruthy()
  })

  it('? 키로 단축키 도움말을 연다', () => {
    renderLayout('/notes')
    act(() => {
      fireEvent.keyDown(document.body, { key: '?' })
    })
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeTruthy()
  })

  it('화면 테마 버튼으로 어둡게를 고르면 html에 적용하고 상자를 닫는다', () => {
    renderLayout('/notes')
    const button = screen.getByRole('button', { name: '화면 테마: 시스템' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(screen.getByRole('group', { name: '화면 테마' })).getByRole('button', { name: '어둡게' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.queryByRole('group', { name: '화면 테마' })).toBeNull()
    expect(screen.getByRole('button', { name: '화면 테마: 어둡게' })).toBe(document.activeElement)
  })

  it('좁은 화면 메뉴 버튼은 펼침 상태를 알리고, Esc나 화면 이동으로 접힌다', () => {
    renderLayout('/notes')
    const menuButton = screen.getByRole('button', { name: '메뉴' })
    const menu = document.getElementById(menuButton.getAttribute('aria-controls') ?? '')
    expect(menu?.dataset.open).toBe('false')
    fireEvent.click(menuButton)
    expect(menuButton.getAttribute('aria-expanded')).toBe('true')
    expect(menu?.dataset.open).toBe('true')
    fireEvent.keyDown(menuButton, { key: 'Escape' })
    expect(menuButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(menuButton)
    fireEvent.click(screen.getByRole('link', { name: '기업 나란히 보기' }))
    expect(screen.getByTestId('where').textContent).toBe('/compare/companies')
    expect(menuButton.getAttribute('aria-expanded')).toBe('false')
  })
})
