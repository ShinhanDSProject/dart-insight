import { apiDelete, apiGet, apiPut } from './client'
import { endpoints } from './endpoints'
import type { ComparisonBasis } from './reports'

/** docs/api-spec.md GET·PUT·DELETE /api/notifications (6.4). 로그인한 회원만 쓴다 */
export interface NotificationReport {
  rceptNo: string
  reportName: string
  periodEnd: string
}

export interface AnalysisNotification {
  notificationId: number
  analysisId: number
  corpCode: string
  corpName: string | null
  basis: ComparisonBasis
  previous: NotificationReport | null
  current: NotificationReport | null
  /** 한국 시간, yyyy-MM-ddTHH:mm:ss */
  createdAt: string
  /** 읽지 않았으면 null */
  readAt: string | null
}

export interface NotificationList {
  /** limit과 상관없이 읽지 않은 전체 수 */
  unreadCount: number
  items: AnalysisNotification[]
}

export function getNotifications(signal?: AbortSignal): Promise<NotificationList> {
  return apiGet(endpoints.notifications(), undefined, { signal })
}

export function markNotificationRead(notificationId: number): Promise<void> {
  return apiPut(endpoints.notificationRead(notificationId), undefined)
}

export function markNotificationUnread(notificationId: number): Promise<void> {
  return apiDelete(endpoints.notificationRead(notificationId))
}
