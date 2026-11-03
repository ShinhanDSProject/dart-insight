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
