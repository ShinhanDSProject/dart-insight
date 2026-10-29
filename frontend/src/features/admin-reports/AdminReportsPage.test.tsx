// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { AdminReport, AdminReportList } from '@/shared/api/community'
import type { AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { AdminReportsPage } from './AdminReportsPage'

const auth = vi.hoisted(() => ({ state: { status: 'authenticated', userId: 1 } as AuthState }))
vi.mock('@/shared/auth/authContext', () => ({
  useAuth: () => ({ state: auth.state, login: vi.fn(), logout: vi.fn() }),
}))
const api = vi.hoisted(() => ({ getAdminReports: vi.fn(), moderateReport: vi.fn() }))
vi.mock('@/shared/api/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/community')>()),
  ...api,
}))

function report(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    reportId: 8,
    status: 'OPEN',
    todo: 'PENDING',
    target: {
      type: 'POST',
      postId: 31,
      commentId: null,
      corpCode: '00126380',
      corpName: '삼성전자',
      author: { nickname: '반도체공부중' },
      body: '다음 달 합병한대요',
      state: 'VISIBLE',
    },
    reportCount: 3,
    reasonCounts: { DEFAMATION: 0, FALSE_RUMOR: 2, PAID_LEADING: 1, PERSONAL_INFO: 0 },
    lastReportedAt: '2026-10-27T11:00:00',
    blindUntil: null,
    repostRequest: null,
    moderations: [],
    ...overrides,
  }
}

const blinded = report({
  reportId: 9,
  status: 'BLINDED',
  todo: 'REPOST_REQUESTED',
  target: { ...report().target, postId: 32, type: 'COMMENT', commentId: 70, body: '가려진 댓글', state: 'BLINDED' },
  blindUntil: '2026-11-03T10:15:00',
  repostRequest: { message: '출처 기사를 붙였어요', createdAt: '2026-10-28T09:00:00' },
  moderations: [
    {
      decision: 'BLIND',
      reason: '확인되지 않은 합병설',
      blindDays: 7,
      blindUntil: '2026-11-03T10:15:00',
      admin: { nickname: '운영자' },
      createdAt: '2026-10-27T10:15:00',
    },
  ],
})
const expired = report({
  reportId: 10,
  status: 'BLINDED',
  todo: 'EXPIRED',
  target: { ...report().target, postId: 33, author: { nickname: '테스트독자' }, state: 'BLINDED' },
})

function page(items: AdminReport[], overrides: Partial<AdminReportList> = {}): AdminReportList {
  return { queue: 'todo', page: 0, size: 20, totalItems: items.length, items, ...overrides }
}

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { code, message: '서버 메시지', traceId: null, errors: [] })
}

function renderPage(state: AuthState = { status: 'authenticated', userId: 1 }, url = '/admin/reports') {
  auth.state = state
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AdminReportsPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
})

describe('AdminReportsPage(FS-58, #463)', () => {
  it('로그인하지 않았으면 서버를 부르지 않고 로그인 안내를 보인다', () => {
    renderPage({ status: 'anonymous' })
    expect(screen.getByText('로그인한 관리자만 볼 수 있어요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
    expect(api.getAdminReports).not.toHaveBeenCalled()
  })

  it('관리자가 아니면(403) 들어올 수 없다는 안내만 보이고 목록 범위는 감춘다', async () => {
    api.getAdminReports.mockRejectedValue(apiError(403, 'AUTH_FORBIDDEN'))
    renderPage()
    expect(await screen.findByText('관리자만 들어올 수 있어요')).toBeTruthy()
    expect(screen.queryByRole('group', { name: '신고 목록 범위' })).toBeNull()
  })

  it('불러오는 동안 로딩, 실패하면 다시 시도, 비었으면 빈 안내를 보인다', async () => {
    api.getAdminReports.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page([]))
    renderPage()
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('처리할 신고가 없어요')).toBeTruthy()
  })

  it('대기·재게시 청구·기한 지남 신고를 상태·사유별 건수·청구 내용·처리 기록과 함께 보인다', async () => {
    api.getAdminReports.mockResolvedValue(page([report(), blinded, expired]))
    const { container } = renderPage()

    const pending = await screen.findByRole('region', { name: /삼성전자 글 · 반도체공부중/ })
    expect(within(pending).getByText('새 신고')).toBeTruthy()
    expect(within(pending).getByText('대기')).toBeTruthy()
    expect(within(pending).getByText('다음 달 합병한대요')).toBeTruthy()
    expect(within(pending).getByText('신고 3건')).toBeTruthy()
    expect(within(pending).getByText('허위 풍문 2')).toBeTruthy()
    expect(within(pending).getByText('유료 리딩방·상담 유인 1')).toBeTruthy()
    expect(within(pending).queryByText(/개인정보 노출/)).toBeNull()
    expect(within(pending).getByRole('link', { name: '삼성전자 커뮤니티에서 보기' }).getAttribute('href')).toBe(
      '/companies/00126380?view=community',
    )

    const repost = screen.getByRole('region', { name: /삼성전자 댓글/ })
    expect(within(repost).getByText('재게시 청구')).toBeTruthy()
    expect(within(repost).getByText('2026.11.03 10:15까지')).toBeTruthy()
    expect(within(repost).getByText('출처 기사를 붙였어요')).toBeTruthy()
    expect(within(repost).getByText('처리 기록 1건')).toBeTruthy()
    expect(within(repost).getByText('확인되지 않은 합병설')).toBeTruthy()

    expect(screen.getByText('블라인드 기한 지남')).toBeTruthy()
    expect(api.getAdminReports).toHaveBeenCalledWith('todo', 0, expect.anything())
    expect(await axeViolations(container)).toBe('')
  })

  it('블라인드는 기간을 1~30일 중 고르고 사유를 적어야 처리된다', async () => {
    api.getAdminReports.mockResolvedValue(page([report()]))
    api.moderateReport.mockResolvedValue(report({ status: 'BLINDED', todo: null, blindUntil: '2026-11-10T11:00:00' }))
    renderPage()
    const form = await screen.findByRole('form', { name: '신고 8 처리' })

    fireEvent.click(within(form).getByRole('button', { name: '처리하기' }))
    expect(within(form).getByRole('alert').textContent).toBe('처리 방법을 골라 주세요.')

    fireEvent.click(within(form).getByRole('radio', { name: /블라인드/ }))
    const days = within(form).getByRole('combobox', { name: '블라인드 기간' })
    expect(within(days).getAllByRole('option').map((o) => o.textContent)).toHaveLength(30)
    fireEvent.change(days, { target: { value: '14' } })
    fireEvent.click(within(form).getByRole('button', { name: '처리하기' }))
    expect(within(form).getByRole('alert').textContent).toBe('처리 사유를 적어 주세요.')
    expect(api.moderateReport).not.toHaveBeenCalled()

    fireEvent.change(within(form).getByRole('textbox', { name: '처리 사유' }), { target: { value: ' 확인되지 않은 합병설 ' } })
    fireEvent.click(within(form).getByRole('button', { name: '처리하기' }))

    expect(await screen.findByText('2026.11.10 11:00까지')).toBeTruthy()
    expect(api.moderateReport).toHaveBeenCalledWith(8, { decision: 'BLIND', reason: '확인되지 않은 합병설', blindDays: 14 })
  })

  it('유지·삭제는 기간 없이 보내고, 서버가 거절하면 사유를 보인다', async () => {
    api.getAdminReports.mockResolvedValue(page([report()]))
    api.moderateReport.mockRejectedValue(apiError(409, 'COMMUNITY_REPORT_CLOSED'))
    renderPage()
    const form = await screen.findByRole('form', { name: '신고 8 처리' })

    fireEvent.click(within(form).getByRole('radio', { name: /삭제/ }))
    expect(within(form).queryByRole('combobox')).toBeNull()
    fireEvent.change(within(form).getByRole('textbox', { name: '처리 사유' }), { target: { value: '개인정보' } })
    fireEvent.click(within(form).getByRole('button', { name: '처리하기' }))

    expect(await within(form).findByText('삭제한 신고는 다시 처리할 수 없어요.')).toBeTruthy()
    expect(api.moderateReport).toHaveBeenCalledWith(8, { decision: 'DELETE', reason: '개인정보' })
  })

  it('삭제한 신고에는 처리 폼 대신 안내를 보인다', async () => {
    api.getAdminReports.mockResolvedValue(page([report({ status: 'DELETED', todo: null })], { queue: 'all' }))
    renderPage(undefined, '/admin/reports?queue=all')
    expect(await screen.findByText('삭제한 신고라 더 처리할 수 없어요.')).toBeTruthy()
    expect(screen.queryByRole('form')).toBeNull()
    expect(api.getAdminReports).toHaveBeenCalledWith('all', 0, expect.anything())
  })

  it('전체로 바꾸면 전체 목록을, 다음 쪽을 누르면 다음 쪽을 부른다', async () => {
    api.getAdminReports.mockResolvedValue(page([report()], { totalItems: 41 }))
    renderPage()
    await screen.findByText('1 / 3쪽')

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await vi.waitFor(() => expect(api.getAdminReports).toHaveBeenLastCalledWith('todo', 1, expect.anything()))

    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    await vi.waitFor(() => expect(api.getAdminReports).toHaveBeenLastCalledWith('all', 0, expect.anything()))
  })
})
