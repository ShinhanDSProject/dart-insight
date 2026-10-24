import type { FeedbackReason, QuestionStatus } from '@/shared/api/questions'
import type { AiUsage, AiUsageDays, LlmCallOutcome } from '@/shared/api/system'
import type { TextExplanationStatus } from '@/shared/api/textChanges'
import { formatShare } from '@/shared/lib/compare'
import { FEEDBACK_REASONS } from '@/shared/lib/feedbackReasons'
import type { ShareSegment, ShareTone } from '@/shared/ui/ShareBar'

/** AI 사용 현황(FS-15). 고를 수 있는 기간과 화면에 보일 값을 만든다. 비율은 API가 계산한 값을 그대로 쓴다 */

export const DAYS_OPTIONS: readonly { value: `${AiUsageDays}`; label: string }[] = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
]

/** 주소의 ?days= 값. 7이 아니면 기본 30일 */
export function parseDays(value: string | null): AiUsageDays {
  return value === '7' ? 7 : 30
}

/** 질문·풀이·LLM 호출이 하나도 없으면 'empty'(0을 비율로 나누지 않고 '아직 기록이 없어요') */
export type UsageView = { kind: 'empty' } | { kind: 'data'; usage: AiUsage }

export function usageView(usage: AiUsage): UsageView {
  const total = usage.questions.total + usage.explanations.total + usage.llmCalls.total
  return total === 0 ? { kind: 'empty' } : { kind: 'data', usage }
}

const countFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 건수·토큰 표시: 1,234 */
export function formatCount(value: number): string {
  return countFormat.format(value)
}

/** 토큰 합. 제공자가 알려 주지 않았으면(null) '알 수 없음' */
export function formatTokens(value: number | null): string {
  return value === null ? '알 수 없음' : formatCount(value)
}

/** 비율(소수) → 75% / 66.7%. 분모가 0이라 비율이 없으면(null) '평가 없음' */
export function formatRate(rate: number | null): string {
  return rate === null ? '평가 없음' : formatShare(rate * 100)
}

/** 2026-09-26 ~ 2026-10-25 → "2026.09.26 ~ 2026.10.25" */
export function periodText(from: string, to: string): string {
  return `${from.replaceAll('-', '.')} ~ ${to.replaceAll('-', '.')}`
}

interface StatusSlot<K extends string> {
  key: K
  label: string
  tone: ShareTone
}

/**
 * 상태별 색. 좋고 나쁨이 없는 범주 색이고, 같은 뜻(검토 필요 등)은 막대가 달라도 같은 색을 쓴다.
 * 이 순서로 막대를 붙여 그린다.
 */
const QUESTION_SLOTS: readonly StatusSlot<QuestionStatus>[] = [
  { key: 'ANSWERED', label: '답함', tone: 'series-1' },
  { key: 'NOT_FOUND', label: '근거 못 찾음', tone: 'series-2' },
  { key: 'OUT_OF_SCOPE', label: '답하지 않는 질문', tone: 'series-3' },
  { key: 'REVIEW_NEEDED', label: '검토 필요', tone: 'series-4' },
]

const EXPLANATION_SLOTS: readonly StatusSlot<TextExplanationStatus>[] = [
  { key: 'OK', label: '근거 확인', tone: 'series-1' },
  { key: 'NO_SOURCE', label: '원문 없음', tone: 'series-2' },
  { key: 'REVIEW_NEEDED', label: '검토 필요', tone: 'series-4' },
]

const OUTCOME_SLOTS: readonly StatusSlot<LlmCallOutcome>[] = [
  { key: 'OK', label: '성공', tone: 'series-1' },
  { key: 'TRANSIENT_ERROR', label: '일시 오류', tone: 'series-2' },
  { key: 'ERROR', label: '오류', tone: 'series-3' },
  { key: 'INVALID_OUTPUT', label: '검증 실패로 다시 만듦', tone: 'series-4' },
]

function segments<K extends string>(slots: readonly StatusSlot<K>[], counts: Partial<Record<K, number>>): ShareSegment[] {
  return slots.map(({ key, label, tone }) => {
    const value = counts[key] ?? 0
    return { label, value, text: formatCount(value), tone }
  })
}

export function questionSegments(usage: AiUsage): ShareSegment[] {
  return segments(QUESTION_SLOTS, usage.questions.byStatus)
}

export function explanationSegments(usage: AiUsage): ShareSegment[] {
  return segments(EXPLANATION_SLOTS, usage.explanations.byStatus)
}

export function outcomeSegments(usage: AiUsage): ShareSegment[] {
  return segments(OUTCOME_SLOTS, usage.llmCalls.byOutcome)
}

/** 정해 둔 네 값 밖의 호출 결과(새 값이 기록된 경우). 막대에 넣지 않고 글자로만 보인다 */
export function otherOutcomes(usage: AiUsage): { outcome: string; count: number }[] {
  const known = new Set<string>(OUTCOME_SLOTS.map((s) => s.key))
  return Object.entries(usage.llmCalls.byOutcome)
    .filter(([outcome, count]) => !known.has(outcome) && count > 0)
    .map(([outcome, count]) => ({ outcome, count }))
}

/** 도움이 안 된 사유별 수. 화면 순서는 답 카드와 같다 */
export function reasonRows(usage: AiUsage): { reason: FeedbackReason; label: string; count: number }[] {
  return FEEDBACK_REASONS.map(({ reason, label }) => ({ reason, label, count: usage.feedback.reasons[reason] ?? 0 }))
}

const TASK_LABELS: Record<string, string> = {
  answer: '질문 답',
  summary: '요약·풀이',
}

/** 작업 이름. 모르는 작업은 기록된 이름 그대로 */
export function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task
}
