import type { ChangeType, PriorityLevel, TextChangeCounts, TextStatus } from '@/shared/api/textChanges'

/** 문장·내용 변화(W-03 ③) 화면 문구. 우선순위는 확인 순서이며 투자 판단이 아니다. */

export const changeTypeOptions: { value: ChangeType | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ADDED', label: '추가' },
  { value: 'DELETED', label: '삭제' },
  { value: 'MODIFIED', label: '수정' },
  { value: 'REVIEW_NEEDED', label: '검토 필요' },
]

export function changeTypeLabel(type: ChangeType): string {
  return changeTypeOptions.find((o) => o.value === type)?.label ?? type
}

export function countFor(counts: TextChangeCounts, type: ChangeType | null): number {
  switch (type) {
    case null:
      return counts.all
    case 'ADDED':
      return counts.added
    case 'DELETED':
      return counts.deleted
    case 'MODIFIED':
      return counts.modified
    case 'REVIEW_NEEDED':
      return counts.reviewNeeded
  }
}

export function priorityLabel(level: PriorityLevel): string {
  switch (level) {
    case 'HIGH':
      return '우선순위 높음'
    case 'MEDIUM':
      return '우선순위 중간'
    case 'LOW':
      return '우선순위 낮음'
    case 'UNRANKED':
      return '판단 유보'
  }
}

/** 한쪽 보고서에 없는 글을 무엇으로 보여 줄지. 삭제는 문서에서 빠졌다는 뜻일 뿐이다. */
export function missingSideLabel(type: ChangeType, side: 'previous' | 'current'): string {
  if (type === 'ADDED' && side === 'previous') return '이전 보고서에 없던 내용'
  if (type === 'DELETED' && side === 'current') return '현재 보고서에서 확인되지 않음'
  return '짝을 정하지 못해 보여 주지 않아요'
}

export const DELETED_NOTE = '문서에서 빠졌다는 뜻이에요. 실제 사업·계약이 끝났다고 단정하지 않아요.'
export const PRIORITY_NOTE = '우선순위는 먼저 확인할 순서를 정한 잠정 규칙이며, 투자 판단이 아니에요.'

/** 문장 비교 상태 안내. 문제가 없으면 null */
export function textStatusNotice(status: TextStatus | null, message: string | null): string | null {
  if (status === null) return '이 분석은 문장을 비교하지 않았어요. 분석을 다시 요청하면 문장 변화를 함께 비교해요.'
  if (status === 'FAILED') return `문장을 비교하지 못했어요. ${message ?? ''}`.trim()
  if (status === 'PARTIAL') return `문장 비교 결과가 완전하지 않을 수 있어요. ${message ?? ''}`.trim()
  return null
}
