import { match } from 'ts-pattern'
import type { BadgeTone } from '@/shared/ui'
import type { TextHistoryEntry } from '@/shared/api/textChanges'
import { changeTypeLabel } from './textLabels'

/** 문장 변경 이력(3.8) 한 줄의 표식과 설명. 알 수 없는 기간은 '변경 없음'처럼 보이지 않게 따로 적는다(ADR-0028). */
export interface HistoryView {
  label: string
  tone: BadgeTone
  /** 글이 없을 때 대신 보여 줄 설명. 글이 있으면 null */
  note: string | null
}

export function historyView(entry: TextHistoryEntry): HistoryView {
  const changed = entry.change === null ? null : changeTypeLabel(entry.change.changeType)
  return match(entry.status)
    .with('PRESENT', () => ({ label: changed ?? '그대로', tone: changed ? 'accent' : 'neutral', note: null }) as const)
    .with('ABSENT', () => ({
      label: changed ?? '없음',
      tone: changed ? 'accent' : 'neutral',
      note: '이 보고서에는 이 글이 없어요.',
    }) as const)
    .with('NOT_ANALYZED', () => ({
      label: '분석 안 됨',
      tone: 'attention',
      note: '이 기간은 비교 분석을 하지 않아 바뀌었는지 알 수 없어요.',
    }) as const)
    .with('REVIEW_NEEDED', () => ({
      label: '검토 필요',
      tone: 'attention',
      note: '비교는 했지만 이 글을 원문에서 찾지 못했어요. 원문에서 직접 확인해 주세요.',
    }) as const)
    .exhaustive()
}
