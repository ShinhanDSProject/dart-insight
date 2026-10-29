import type { ReportReason } from '@/shared/api/community'
import { formatDate } from './reportLabels'

/** 신고 사유(FS-58). 신고 대화상자와 관리자 신고 목록이 같이 쓴다 */
export const reportReasonOptions: readonly { value: ReportReason; label: string }[] = [
  { value: 'DEFAMATION', label: '특정인 모욕·명예훼손' },
  { value: 'FALSE_RUMOR', label: '허위 풍문' },
  { value: 'PAID_LEADING', label: '유료 리딩방·상담 유인' },
  { value: 'PERSONAL_INFO', label: '개인정보 노출' },
]

/** 한국 시간 시각 표시: 2026-11-03T10:15:00 → 2026.11.03 10:15 */
export function dateTimeLabel(kstDateTime: string): string {
  return `${formatDate(kstDateTime.slice(0, 10))} ${kstDateTime.slice(11, 16)}`
}
