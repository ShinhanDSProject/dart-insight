import type { AnalysisNotification } from '@/shared/api/notifications'
import { basisLabel } from '@/shared/lib/comparisonBasis'
import { formatDate } from '@/shared/lib/reportLabels'

/** 알림 한 줄의 문구(6.4). 보고서 이름이 없으면(저장된 보고서가 지워진 경우) 접수번호 대신 '보고서'라고만 적는다 */
export function notificationTitle(item: AnalysisNotification): string {
  const company = item.corpName ?? item.corpCode
  return `${company} ${item.current?.reportName ?? '새 보고서'} 비교 분석이 끝났어요.`
}

export function notificationDetail(item: AnalysisNotification): string {
  return `${basisLabel(item.basis)} ${item.previous?.reportName ?? '이전 보고서'}와 비교했어요.`
}

/** 2026-11-14T15:20:31 → 2026.11.14 15:20 */
export function notificationTime(createdAt: string): string {
  return `${formatDate(createdAt.slice(0, 10))} ${createdAt.slice(11, 16)}`
}

/** 헤더 버튼 이름. 읽지 않은 알림이 많으면 99+로 줄인다 */
export function unreadLabel(count: number): string {
  return count === 0 ? '알림' : `알림 ${count > 99 ? '99+' : count}`
}
