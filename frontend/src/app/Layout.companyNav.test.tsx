// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import type { CurrentCompany } from '@/shared/lib/currentCompany'
import { axeViolations } from '@/test/axe'
import { Layout } from './Layout'

const currentCompany = vi.hoisted(() => ({ value: null as CurrentCompany | null }))

vi.mock('@/shared/hooks/useCurrentCompany', () => ({
  useCurrentCompany: () => currentCompany.value,
}))

const anonymousAuth: AuthContextValue = {
  state: { status: 'anonymous' },
  login: vi.fn(),
  logout: vi.fn(),
}

function renderLayout(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/companies/:corpCode', element: <p>기업 화면</p>, handle: { crumb: '보고서 선택' } },
          { path: '/analyses/:analysisId', element: <p>분석 결과</p>, handle: { crumb: '분석 결과' } },
          { path: '/notes', element: <p>내 판단 노트</p> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  )
  return render(
    <AuthContext.Provider value={anonymousAuth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

afterEach(cleanup)

describe("Layout '지금 보는 기업' 줄(#548, #589)", () => {
  it('기업 이름과 종목코드만 두고, 이름은 마지막으로 연 분석 결과로 간다', async () => {
    currentCompany.value = {
      corpCode: '00126380',
      corpName: '삼성전자',
      stockCode: '005930',
      analysisId: 14,
      view: 'analysis',
    }
    const { container } = renderLayout('/companies/00126380?view=overview')
    const group = screen.getByRole('navigation', { name: '지금 보는 기업' })
    expect(within(group).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['삼성전자', '/analyses/14'],
    ])
    expect(within(group).getByText('005930')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('기업을 연 적이 없으면 지금 보는 기업 줄을 두지 않는다', () => {
    currentCompany.value = null
    renderLayout('/analyses/14')
    expect(screen.queryByRole('navigation', { name: '지금 보는 기업' })).toBeNull()
  })
})

describe('Layout 상단 검색창과 로그인 버튼(FS-69)', () => {
  const samsung: CurrentCompany = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', analysisId: 14, view: 'analysis' }

  it('그 기업의 분석 결과·기업 화면에서는 검색창에 기업 이름을 넣어 둔다', () => {
    currentCompany.value = samsung
    renderLayout('/analyses/14')
    expect((screen.getByRole('searchbox', { name: '회사명 또는 종목코드' }) as HTMLInputElement).value).toBe('삼성전자')
    cleanup()
    renderLayout('/companies/00126380')
    expect((screen.getByRole('searchbox', { name: '회사명 또는 종목코드' }) as HTMLInputElement).value).toBe('삼성전자')
  })

  it('다른 분석이나 기업과 상관없는 화면에서는 검색창을 비워 둔다', () => {
    currentCompany.value = samsung
    renderLayout('/analyses/99')
    expect((screen.getByRole('searchbox', { name: '회사명 또는 종목코드' }) as HTMLInputElement).value).toBe('')
    cleanup()
    renderLayout('/notes')
    expect((screen.getByRole('searchbox', { name: '회사명 또는 종목코드' }) as HTMLInputElement).value).toBe('')
  })

  it('로그인 전 상단 바에는 회원가입 버튼 없이 로그인만 둔다', () => {
    currentCompany.value = null
    renderLayout('/notes')
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('link', { name: '회원가입' })).toBeNull()
  })
})
