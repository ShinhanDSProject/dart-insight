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

describe("Layout '지금 보는 기업' 줄(#525, #548)", () => {
  it('분석 결과를 보는 중에도 기업 개요 바로 가기를 보이고, 기업 개요 주소에서는 현재 화면으로 표시한다', async () => {
    currentCompany.value = {
      corpCode: '00126380',
      corpName: '삼성전자',
      stockCode: '005930',
      analysisId: 14,
      view: 'analysis',
    }
    const first = renderLayout('/analyses/14')
    const group = screen.getByRole('navigation', { name: '지금 보는 기업' })
    const overview = within(group).getByRole('link', { name: '기업 개요' })
    const compare = within(group).getByRole('link', { name: '공시 비교' })
    expect(within(group).getByRole('link', { name: '원문 확인' })).toBeTruthy()
    expect(overview.getAttribute('href')).toBe('/companies/00126380?view=overview')
    expect(overview.getAttribute('aria-current')).toBeNull()
    expect(compare.getAttribute('aria-current')).toBe('page')
    expect(await axeViolations(first.container)).toBe('')

    cleanup()
    renderLayout('/companies/00126380?view=overview')
    const nextGroup = screen.getByRole('navigation', { name: '지금 보는 기업' })
    expect(within(nextGroup).getByRole('link', { name: '기업 개요' }).getAttribute('aria-current')).toBe('page')
    expect(within(nextGroup).getByRole('link', { name: '공시 비교' }).getAttribute('aria-current')).toBeNull()
  })

  it('기업을 연 적이 없으면 지금 보는 기업 줄을 두지 않는다', () => {
    currentCompany.value = null
    renderLayout('/analyses/14')
    expect(screen.queryByRole('navigation', { name: '지금 보는 기업' })).toBeNull()
  })
})
