import { match } from 'ts-pattern'
import { ApiError } from '@/shared/api/client'
import {
  BLIND_DAYS_MAX,
  MODERATION_REASON_MAX,
  type AdminReport,
  type AdminReportList,
  type ContentState,
  type ModerationDecision,
  type ModerationRequest,
  type ReportQueue,
  type ReportReason,
  type ReportStatus,
  type ReportTodo,
} from '@/shared/api/community'
import { reportReasonOptions } from '@/shared/lib/communityLabels'
import { formatInteger } from '@/shared/lib/numberFormat'
import type { SegmentOption } from '@/shared/ui'

export const queueOptions: readonly SegmentOption<ReportQueue>[] = [
  { value: 'todo', label: '처리할 것' },
  { value: 'all', label: '전체' },
]

export const statusLabels: Record<ReportStatus, string> = {
  OPEN: '대기',
  KEPT: '유지',
  BLINDED: '블라인드',
  DELETED: '삭제',
}

export const todoLabels: Record<ReportTodo, string> = {
  PENDING: '새 신고',
  REPOST_REQUESTED: '재게시 청구',
  EXPIRED: '블라인드 기한 지남',
}

export const decisionOptions: readonly { value: ModerationDecision; label: string; hint: string }[] = [
  { value: 'KEEP', label: '유지', hint: '그대로 보이게 둬요(가려져 있었으면 풀어요).' },
  { value: 'BLIND', label: '블라인드', hint: '정한 기간 동안 가려요. 사유는 작성자에게 보여요.' },
  { value: 'DELETE', label: '삭제', hint: '지워요. 다시 처리할 수 없어요.' },
]

export const decisionLabels: Record<ModerationDecision, string> = { KEEP: '유지', BLIND: '블라인드', DELETE: '삭제' }

export const targetStateLabels: Record<ContentState, string> = {
  VISIBLE: '보이는 중',
  BLINDED: '가려짐',
  DELETED: '지워짐',
}

/** 블라인드 기간 선택지 1~30일 */
export const blindDayOptions: readonly number[] = Array.from({ length: BLIND_DAYS_MAX }, (_, i) => i + 1)
export const DEFAULT_BLIND_DAYS = 7

/** 서버 에러 코드별 안내(API-3). 없는 코드는 서버 message를 그대로 쓴다 */
export const adminErrorMessages: Record<string, string> = {
  AUTH_UNAUTHORIZED: '로그인이 끝났어요. 다시 로그인해 주세요.',
  AUTH_FORBIDDEN: '관리자만 신고를 처리할 수 있어요.',
  COMMUNITY_REPORT_NOT_FOUND: '없는 신고예요. 목록을 다시 불러와 주세요.',
  COMMUNITY_REPORT_CLOSED: '삭제한 신고는 다시 처리할 수 없어요.',
  COMMUNITY_TARGET_UNAVAILABLE: '작성자가 지운 글·댓글이라 블라인드할 수 없어요. 유지나 삭제로 닫아 주세요.',
}

/** 주소의 ?queue=. 모르는 값이면 처리할 것 */
export function parseQueue(value: string | null): ReportQueue {
  return value === 'all' ? 'all' : 'todo'
}

/** 주소의 ?page=(1부터). 서버에는 0부터 보낸다 */
export function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page - 1 : 0
}

/** 403 AUTH_FORBIDDEN: 로그인했지만 관리자가 아니다 */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AUTH_FORBIDDEN'
}

/** 신고가 있는 사유만 사유 순서대로 */
export function reasonSummary(reasonCounts: Record<ReportReason, number>): { reason: ReportReason; label: string; count: number }[] {
  return reportReasonOptions
    .filter((option) => reasonCounts[option.value] > 0)
    .map((option) => ({ reason: option.value, label: option.label, count: reasonCounts[option.value] }))
}

export function reportCountLabel(count: number): string {
  return `신고 ${formatInteger(count)}건`
}

/** 대상이 있는 기업 화면의 커뮤니티 탭 */
export function targetLink(report: AdminReport): string {
  return `/companies/${encodeURIComponent(report.target.corpCode)}?view=community`
}

/** 이 목록의 마지막 쪽(0부터). 비었으면 0 */
export function lastPage(list: AdminReportList): number {
  return Math.max(0, Math.ceil(list.totalItems / list.size) - 1)
}

/** 처리 폼에 적은 값. 결정은 관리자가 직접 고른다(미리 고르지 않음) */
export interface ModerationDraft {
  decision: ModerationDecision | null
  reason: string
  blindDays: number
}

export const EMPTY_DRAFT: ModerationDraft = { decision: null, reason: '', blindDays: DEFAULT_BLIND_DAYS }

/** 삭제한 신고는 다시 처리할 수 없다(서버 COMMUNITY_REPORT_CLOSED) */
export function canModerate(report: AdminReport): boolean {
  return report.status !== 'DELETED'
}

/** 보낼 수 없는 이유. 보낼 수 있으면 null */
export function draftError(draft: ModerationDraft, report: AdminReport): string | null {
  if (draft.decision === null) return '처리 방법을 골라 주세요.'
  if (draft.decision === 'BLIND') {
    if (report.target.state === 'DELETED') return adminErrorMessages.COMMUNITY_TARGET_UNAVAILABLE
    if (!blindDayOptions.includes(draft.blindDays)) return '블라인드 기간은 1~30일 중에서 골라 주세요.'
  }
  const reason = draft.reason.trim()
  if (reason.length === 0) return '처리 사유를 적어 주세요.'
  if (reason.length > MODERATION_REASON_MAX) return `${formatInteger(MODERATION_REASON_MAX)}자까지 쓸 수 있어요.`
  return null
}

/** 서버에 보낼 본문. blindDays는 블라인드일 때만 넣는다 */
export function moderationRequest(decision: ModerationDecision, draft: ModerationDraft): ModerationRequest {
  const reason = draft.reason.trim()
  return decision === 'BLIND' ? { decision, reason, blindDays: draft.blindDays } : { decision, reason }
}

export type ReportsState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'success'; data: AdminReportList }
  | { status: 'error'; error: unknown }

export type ReportsAction =
  | { type: 'start' }
  | { type: 'set-anonymous' }
  | { type: 'resolve'; data: AdminReportList }
  | { type: 'reject'; error: unknown }
  | { type: 'replace-item'; item: AdminReport }

/**
 * 신고 목록 상태. 처리한 항목은 서버가 돌려준 값으로 그 자리에서 바꾼다
 * ('처리할 것'에서도 바로 빼지 않아 방금 무엇을 했는지 보인다. 다시 불러오면 빠진다).
 */
export function reportsReducer(state: ReportsState, action: ReportsAction): ReportsState {
  return match<ReportsAction, ReportsState>(action)
    .with({ type: 'start' }, () => ({ status: 'loading' }))
    .with({ type: 'set-anonymous' }, () => ({ status: 'anonymous' }))
    .with({ type: 'resolve' }, ({ data }) => ({ status: 'success', data }))
    .with({ type: 'reject' }, ({ error }) => ({ status: 'error', error }))
    .with({ type: 'replace-item' }, ({ item }) =>
      state.status === 'success'
        ? {
            status: 'success',
            data: { ...state.data, items: state.data.items.map((it) => (it.reportId === item.reportId ? item : it)) },
          }
        : state,
    )
    .exhaustive()
}
