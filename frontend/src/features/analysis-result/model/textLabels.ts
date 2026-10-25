import { match } from 'ts-pattern'
import type { ChangeType, PriorityLevel, TextChangeCounts, TextChangeItem, TextStatus } from '@/shared/api/textChanges'

/** 문장·내용 변화(W-03 ③) 화면 문구. 우선순위는 확인 순서이며 투자 판단이 아니다. */

export const changeTypeOptions: { value: ChangeType | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ADDED', label: '추가' },
  { value: 'DELETED', label: '삭제' },
  { value: 'MODIFIED', label: '수정' },
  { value: 'NUMERIC_UPDATE', label: '숫자만 바뀜' },
  { value: 'MOVED', label: '위치 이동' },
  { value: 'REVIEW_NEEDED', label: '검토 필요' },
]

/**
 * 유형 설명(3.3, #300). 문구는 docs/api-spec.md text-changes의 changeType 설명과 ADR-0021·ADR-0010의 기준에서만 가져온다.
 * Record라 유형이 늘면 정의를 쓰지 않은 채로는 빌드되지 않는다.
 */
export const changeTypeHelp: Record<ChangeType, string> = {
  ADDED: '이전 보고서에는 없고 현재 보고서에만 있는 글이에요.',
  DELETED: '이전 보고서에 있던 글이 현재 보고서에서 빠졌어요. 사업·계약이 끝났다는 뜻은 아니에요.',
  MODIFIED: '두 보고서에서 짝지은 글이 숫자 말고도 달라졌어요.',
  NUMERIC_UPDATE: '숫자를 가리면 같은 글이에요. 숫자만 바뀌었어요.',
  MOVED:
    '숫자를 가린 글이 같거나 띄어쓰기·문장부호만 다른 글이 다른 자리로 옮겨졌어요. 같은 섹션 안에서 순서만 바뀐 것도 여기에 들어가요.',
  REVIEW_NEEDED: '두 보고서의 항목을 짝짓지 못했어요. 빠진 것으로 숨기지 않고 보여 줘요.',
}

/** 유형 설명 목록. 거르기 칩과 같은 순서('전체' 제외) */
export function changeTypeHelpItems(): { type: ChangeType; label: string; help: string }[] {
  return changeTypeOptions.flatMap((o) => (o.value === null ? [] : [{ type: o.value, label: o.label, help: changeTypeHelp[o.value] }]))
}

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
    case 'NUMERIC_UPDATE':
      return counts.numericUpdate
    case 'MOVED':
      return counts.moved
    case 'REVIEW_NEEDED':
      return counts.reviewNeeded
  }
}

/**
 * 유형 이름 옆에 '숫자만 바뀜' 표시를 따로 붙일지. 옛 결과(m2-8까지)는 MODIFIED + numbersOnly로만 구분해서다.
 * NUMERIC_UPDATE는 유형 이름이 이미 '숫자만 바뀜'이라 붙이지 않는다.
 */
export function showsNumbersOnlyMark(item: Pick<TextChangeItem, 'changeType' | 'numbersOnly'>): boolean {
  return item.numbersOnly && item.changeType !== 'NUMERIC_UPDATE'
}

/** 위치 이동의 옮기기 전·후 섹션 경로. 위치 이동이 아니거나 이전 경로가 없으면 null */
export function movedPaths(
  item: Pick<TextChangeItem, 'changeType' | 'sectionPath' | 'previousSectionPath'>,
): { from: string; to: string; sameSection: boolean } | null {
  if (item.changeType !== 'MOVED' || item.previousSectionPath === null) return null
  return {
    from: item.previousSectionPath,
    to: item.sectionPath,
    sameSection: item.previousSectionPath === item.sectionPath,
  }
}

/** 두 쪽 글이 모두 있어 낱말 차이와 비슷한 정도를 보여 줄 유형 */
export function comparesWords(type: ChangeType): boolean {
  return match(type)
    .with('MODIFIED', 'NUMERIC_UPDATE', 'MOVED', () => true)
    .with('ADDED', 'DELETED', 'REVIEW_NEEDED', () => false)
    .exhaustive()
}

export const MOVED_NOTE = '내용은 그대로이고 자리만 옮겨졌어요. 숫자는 바뀌었을 수 있어요.'

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
