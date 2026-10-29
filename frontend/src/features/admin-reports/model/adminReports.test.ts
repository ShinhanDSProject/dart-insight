import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { AdminReport, AdminReportList } from '@/shared/api/community'
import {
  canModerate,
  draftError,
  EMPTY_DRAFT,
  isForbidden,
  lastPage,
  moderationRequest,
  parsePage,
  parseQueue,
  reasonSummary,
  reportsReducer,
  targetLink,
} from './adminReports'

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
      body: '합병한대요',
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

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { code, message: code, traceId: null, errors: [] })
}

function list(items: AdminReport[], totalItems = items.length): AdminReportList {
  return { queue: 'todo', page: 0, size: 20, totalItems, items }
}

describe('주소 값', () => {
  it('큐는 all만 전체이고 나머지는 처리할 것이다', () => {
    expect(parseQueue('all')).toBe('all')
    expect(parseQueue(null)).toBe('todo')
    expect(parseQueue('done')).toBe('todo')
  })

  it('쪽은 주소에서 1부터, 서버에는 0부터다. 잘못된 값은 첫 쪽이다', () => {
    expect(parsePage('3')).toBe(2)
    expect(parsePage(null)).toBe(0)
    expect(parsePage('0')).toBe(0)
    expect(parsePage('1.5')).toBe(0)
  })

  it('마지막 쪽은 전체 수와 쪽 크기로 정하고, 비었으면 0이다', () => {
    expect(lastPage(list([], 0))).toBe(0)
    expect(lastPage(list([], 20))).toBe(0)
    expect(lastPage(list([], 21))).toBe(1)
  })
})

describe('신고 표시', () => {
  it('신고가 있는 사유만 사유 순서대로 보인다', () => {
    expect(reasonSummary(report().reasonCounts)).toEqual([
      { reason: 'FALSE_RUMOR', label: '허위 풍문', count: 2 },
      { reason: 'PAID_LEADING', label: '유료 리딩방·상담 유인', count: 1 },
    ])
  })

  it('대상은 그 기업 화면의 커뮤니티 탭으로 잇는다', () => {
    expect(targetLink(report())).toBe('/companies/00126380?view=community')
  })

  it('관리자가 아니라는 403만 접근 거부로 본다', () => {
    expect(isForbidden(apiError(403, 'AUTH_FORBIDDEN'))).toBe(true)
    expect(isForbidden(apiError(401, 'AUTH_UNAUTHORIZED'))).toBe(false)
    expect(isForbidden(new Error('x'))).toBe(false)
  })

  it('삭제한 신고만 더 처리할 수 없다', () => {
    expect(canModerate(report())).toBe(true)
    expect(canModerate(report({ status: 'BLINDED' }))).toBe(true)
    expect(canModerate(report({ status: 'DELETED' }))).toBe(false)
  })
})

describe('처리 폼', () => {
  it('결정을 고르고 사유를 적어야 보낸다', () => {
    expect(draftError(EMPTY_DRAFT, report())).toBe('처리 방법을 골라 주세요.')
    expect(draftError({ ...EMPTY_DRAFT, decision: 'KEEP', reason: '   ' }, report())).toBe('처리 사유를 적어 주세요.')
    expect(draftError({ ...EMPTY_DRAFT, decision: 'KEEP', reason: '가'.repeat(501) }, report())).toBe('500자까지 쓸 수 있어요.')
    expect(draftError({ ...EMPTY_DRAFT, decision: 'KEEP', reason: ' 문제없음 ' }, report())).toBeNull()
  })

  it('블라인드는 1~30일이고, 작성자가 지운 대상은 블라인드할 수 없다', () => {
    const blind = { ...EMPTY_DRAFT, decision: 'BLIND' as const, reason: '합병설' }
    expect(draftError({ ...blind, blindDays: 30 }, report())).toBeNull()
    expect(draftError({ ...blind, blindDays: 31 }, report())).toBe('블라인드 기간은 1~30일 중에서 골라 주세요.')
    expect(draftError({ ...blind, blindDays: 0 }, report())).toBe('블라인드 기간은 1~30일 중에서 골라 주세요.')
    const deleted = report({ target: { ...report().target, state: 'DELETED' } })
    expect(draftError(blind, deleted)).toContain('블라인드할 수 없어요')
    expect(draftError({ ...blind, decision: 'DELETE' }, deleted)).toBeNull()
  })

  it('사유는 앞뒤 공백을 지우고, 기간은 블라인드일 때만 보낸다', () => {
    const draft = { decision: 'BLIND' as const, reason: ' 합병설 ', blindDays: 7 }
    expect(moderationRequest('BLIND', draft)).toEqual({ decision: 'BLIND', reason: '합병설', blindDays: 7 })
    expect(moderationRequest('KEEP', draft)).toEqual({ decision: 'KEEP', reason: '합병설' })
  })
})

describe('신고 목록 상태', () => {
  it('처리한 항목은 그 자리에서 서버 답으로 바꾼다', () => {
    const state = reportsReducer({ status: 'loading' }, { type: 'resolve', data: list([report(), report({ reportId: 9 })]) })
    const next = reportsReducer(state, { type: 'replace-item', item: report({ status: 'KEPT', todo: null }) })
    expect(next.status === 'success' && next.data.items.map((r) => [r.reportId, r.status])).toEqual([
      [8, 'KEPT'],
      [9, 'OPEN'],
    ])
  })

  it('목록을 받기 전에는 바꾸지 않는다', () => {
    expect(reportsReducer({ status: 'loading' }, { type: 'replace-item', item: report() })).toEqual({ status: 'loading' })
  })
})
