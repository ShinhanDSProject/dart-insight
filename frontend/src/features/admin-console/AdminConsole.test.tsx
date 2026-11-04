// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminAnalysisItem, AdminOverview, AdminUserItem, PageOf } from '@/shared/api/admin'
import type { AdminAccess } from '@/shared/hooks/useAdminAccess'
import { axeViolations } from '@/test/axe'
import { AdminAnalysesPage } from './AdminAnalysesPage'
import { AdminConsoleLayout } from './AdminConsoleLayout'
import { AdminOverviewPage } from './AdminOverviewPage'
import { AdminUsersPage } from './AdminUsersPage'

const access = vi.hoisted(() => ({ value: { status: 'admin' } as AdminAccess }))
const api = vi.hoisted(() => ({ overview: vi.fn(), analyses: vi.fn(), users: vi.fn() }))

vi.mock('@/shared/hooks/useAdminAccess', () => ({ useAdminAccess: () => ({ access: access.value, reload: vi.fn() }) }))
vi.mock('@/shared/api/admin', () => ({
  getAdminOverview: api.overview,
  getAdminAnalyses: api.analyses,
  getAdminUsers: api.users,
}))

const overview: AdminOverview = {
  days: 7,
  from: '2026-10-29',
  to: '2026-11-04',
  analyses: {
    requested: 42,
    completed: 37,
    failed: 3,
    inProgress: 2,
    completionRate: 0.925,
    p50Seconds: 48,
    p90Seconds: 131,
    outdated: 5,
    daily: [
      { date: '2026-11-03', requested: 9, completed: 8, failed: 1 },
      { date: '2026-11-04', requested: 0, completed: 0, failed: 0 },
    ],
    topFailures: [{ errorCode: 'ANALYSIS_SUMMARY_FAILED', count: 2, lastAt: '2026-11-03T14:02:11' }],
    topCompanies: [{ corpCode: '00126380', corpName: '삼성전자', count: 9 }],
  },
  users: { total: 128, newInPeriod: 14, admins: 2, byProvider: { LOCAL: 80, GOOGLE: 30, KAKAO: 12, NAVER: 6 }, daily: [] },
  watch: { favorites: 310, companies: 96, topWatched: [{ corpCode: '00126380', corpName: '삼성전자', count: 41 }] },
  community: { openReports: 3, postsInPeriod: 27 },
  ai: { calls: 220, failedCalls: 4, estimatedCostUsd: null, unpricedCalls: 220 },
  planInterests: { total: 19, signedIn: 7, byPlan: { FREE: 2, PRO: 9, TEAM: 6, EMBED: 2 }, daily: [] },
}

const failed: AdminAnalysisItem = {
  analysisId: 14,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  current: { rceptNo: '20260814003699', reportName: '반기보고서 (2026.06)' },
  previous: { rceptNo: '20250814003156', reportName: '반기보고서 (2025.06)' },
  status: 'FAILED',
  step: 'COMPARING',
  errorCode: 'ANALYSIS_SUMMARY_FAILED',
  errorMessage: '요약을 만들지 못했어요.',
  traceId: 'trace-abc',
  analysisVersion: 'm2-13',
  outdated: true,
  createdAt: '2026-11-03T14:01:02',
  startedAt: '2026-11-03T14:01:03',
  completedAt: null,
  durationSeconds: 69,
}

const user: AdminUserItem = {
  userId: 7,
  nickname: null,
  maskedEmail: 'tj***@g***.com',
  providers: ['LOCAL', 'GOOGLE'],
  role: 'ADMIN',
  createdAt: '2026-10-21T09:12:44',
  favoriteCount: 5,
  postCount: 2,
}

function page<T>(items: T[]): PageOf<T> {
  return { page: 0, size: 20, totalItems: items.length, items }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: <AdminConsoleLayout />,
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'analyses', element: <AdminAnalysesPage /> },
          { path: 'users', element: <AdminUsersPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}

afterEach(() => {
  cleanup()
  access.value = { status: 'admin' }
  api.overview.mockReset()
  api.analyses.mockReset()
  api.users.mockReset()
})

describe('운영 콘솔 틀(FS-72)', () => {
  it('로그인 전이면 로그인 안내만 보이고 API를 부르지 않는다', () => {
    access.value = { status: 'anonymous' }
    renderAt('/admin')
    expect(screen.getByText('로그인한 관리자만 볼 수 있어요')).toBeTruthy()
    expect(api.overview).not.toHaveBeenCalled()
  })

  it('관리자가 아닌 회원은 권한 안내를 본다', () => {
    access.value = { status: 'member' }
    renderAt('/admin')
    expect(screen.getByText('관리자만 들어올 수 있어요')).toBeTruthy()
  })

  it('관리자는 왼쪽 메뉴에서 지금 화면이 표시되고 AI 사용 현황은 콘솔 밖 화면으로 간다', async () => {
    api.overview.mockResolvedValue(overview)
    renderAt('/admin')
    const nav = screen.getByRole('navigation', { name: '운영 콘솔' })
    expect(within(nav).getByRole('link', { name: '개요' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: /AI 사용 현황/ }).getAttribute('href')).toBe('/system/ai-usage')
    await screen.findByText('92.5%')
  })
})

describe('개요(FS-72 R1·R4)', () => {
  it('핵심 지표·실패 사유·상위 기업·요금제 관심을 보이고 모르는 비용은 —와 제외 건수로 알린다', async () => {
    api.overview.mockResolvedValue(overview)
    const { container } = renderAt('/admin')
    await screen.findByText('92.5%')
    expect(api.overview).toHaveBeenCalledWith(7, expect.anything())
    expect(screen.getByText('48초')).toBeTruthy()
    expect(screen.getByText('중앙값 · 90% 2분 11초')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('가격 없는 호출 220건 제외')).toBeTruthy()
    expect(screen.getByText('ANALYSIS_SUMMARY_FAILED')).toBeTruthy()
    expect(screen.getByRole('link', { name: /처리할 신고/ }).getAttribute('href')).toBe('/admin/reports')
    expect(within(screen.getByRole('list', { name: '요금제별 관심' })).getAllByRole('listitem')).toHaveLength(4)
    // signedIn(7)이 아니라 회원·요금제 쌍(signedInMembers 5)을 보인다
    expect(within(screen.getByRole('region', { name: '요금제 관심' })).getByText(/로그인 회원·요금제 5쌍/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('30일을 고르면 주소에 남기고 30일로 다시 부른다', async () => {
    api.overview.mockResolvedValue(overview)
    const { router } = renderAt('/admin')
    await screen.findByText('92.5%')
    fireEvent.click(screen.getByRole('button', { name: '30일' }))
    await waitFor(() => expect(api.overview).toHaveBeenLastCalledWith(30, expect.anything()))
    expect(router.state.location.search).toBe('?days=30')
  })
})

describe('분석 작업(FS-72 R2)', () => {
  it('실패한 분석은 사유·추적 ID·진행 화면 링크를 보이고 옛 버전을 표시한다', async () => {
    api.analyses.mockResolvedValue(page([failed]))
    const { container } = renderAt('/admin/analyses?status=FAILED&days=7')
    await screen.findByText('요약을 만들지 못했어요.')
    expect(api.analyses).toHaveBeenCalledWith({ status: 'FAILED', days: 7, q: null, page: 0 }, expect.anything())
    expect(screen.getByText('trace-abc')).toBeTruthy()
    expect(screen.getByText('옛 버전')).toBeTruthy()
    expect(screen.getByText('1분 9초')).toBeTruthy()
    expect(screen.getByRole('link', { name: '분석 14 진행 화면' }).getAttribute('href')).toBe('/analyses/14/progress')
    expect(await axeViolations(container)).toBe('')
  })

  it('검색어를 넣고 찾으면 주소의 q로 다시 부르고, 결과가 없으면 빈 안내를 보인다', async () => {
    api.analyses.mockResolvedValue(page([]))
    const { router } = renderAt('/admin/analyses')
    await screen.findByText('조건에 맞는 분석이 없어요')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  trace-abc ' } })
    fireEvent.click(screen.getByRole('button', { name: '찾기' }))
    await waitFor(() => expect(api.analyses).toHaveBeenLastCalledWith({ status: null, days: null, q: 'trace-abc', page: 0 }, expect.anything()))
    expect(router.state.location.search).toBe('?q=trace-abc')
  })
})

describe('회원(FS-72 R3)', () => {
  it('가린 이메일·가입 방식·역할을 보이고 닉네임이 없으면 —로 보인다', async () => {
    api.users.mockResolvedValue(page([user]))
    api.overview.mockResolvedValue(overview)
    const { container } = renderAt('/admin/users')
    await screen.findByText('tj***@g***.com')
    const row = screen.getByText('tj***@g***.com').closest('tr')!
    expect(within(row).getByText('이메일')).toBeTruthy()
    expect(within(row).getByText('구글')).toBeTruthy()
    expect(within(row).getByText('관리자')).toBeTruthy()
    expect(within(row).getByText('—')).toBeTruthy()
    expect(await screen.findByText('이메일 80')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})
