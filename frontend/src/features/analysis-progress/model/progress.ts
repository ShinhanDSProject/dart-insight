import { match } from 'ts-pattern'
import type { Analysis, AnalysisStatus, AnalysisStepView, StepState } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import type { PollingOptions } from '@/shared/hooks/pollingState'
import type { BadgeTone } from '@/shared/ui'

/** 상태 조회 주기(W-02): 1초. 조회가 실패하면 간격을 늘려 다시 시도하고, 5번 실패하면 멈춘다. */
export const POLL_INTERVAL_MS = 1000
export const MAX_POLL_FAILURES = 5

export function nextPollDelay(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return POLL_INTERVAL_MS
  return Math.min(POLL_INTERVAL_MS * 2 ** consecutiveFailures, 10_000)
}

/** 없는 분석·잘못된 주소(4xx)는 다시 물어도 같으므로 바로 멈춘다 */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}

/** 분석 상태 조회. 완료·실패하면 더 묻지 않는다 */
export const analysisPolling: PollingOptions<Analysis> = {
  shouldContinue: (analysis) => analysis.status !== 'COMPLETED' && analysis.status !== 'FAILED',
  isFatal: isClientError,
  maxFailures: MAX_POLL_FAILURES,
  delay: nextPollDelay,
}

const statusLabels: Record<AnalysisStatus, string> = {
  PENDING: '대기 중',
  RUNNING: '분석 중',
  COMPLETED: '완료',
  FAILED: '실패',
}

export function statusLabel(status: AnalysisStatus): string {
  return statusLabels[status]
}

/** 예: "완료: 요청 접수 · 진행 중: 보고서 비교 · 다음: 근거 확인" */
export function stepSummary(steps: AnalysisStepView[]): string {
  const done = steps.filter((s) => s.state === 'DONE').map((s) => s.label)
  const active = steps.find((s) => s.state === 'ACTIVE')
  const failed = steps.find((s) => s.state === 'FAILED')
  const next = steps.find((s) => s.state === 'PENDING')
  const parts: string[] = []
  if (done.length > 0) parts.push(`완료: ${done.join(', ')}`)
  if (active) parts.push(`진행 중: ${active.label}`)
  if (failed) parts.push(`실패: ${failed.label}`)
  if (next && !failed) parts.push(`다음: ${next.label}`)
  return parts.join(' · ')
}

/** 서버가 모르는 단계 상태를 보내도 화면이 멈추지 않게 그 밖의 값은 '대기'로 둔다 */
export function stepStateLabel(state: StepState): string {
  return match<string, string>(state)
    .with('DONE', () => '완료')
    .with('ACTIVE', () => '진행 중')
    .with('FAILED', () => '실패')
    .otherwise(() => '대기')
}

export function stepMarker(state: StepState): string {
  return match<string, string>(state)
    .with('DONE', () => '✓')
    .with('FAILED', () => '!')
    .otherwise(() => '')
}

/**
 * 진행 막대 비율(0~1, #549). 끝난 단계 수에 진행 중인 단계의 절반을 더해 단계 수로 나눈다.
 * 실패한 단계는 더하지 않아 막대가 그 앞에서 멈춘다. 단계가 없으면 0
 */
export function stepProgress(steps: AnalysisStepView[]): number {
  if (steps.length === 0) return 0
  const done = steps.filter((s) => s.state === 'DONE').length
  const active = steps.some((s) => s.state === 'ACTIVE') ? 0.5 : 0
  return Math.min(1, (done + active) / steps.length)
}

export interface ProgressHeader {
  title: string
  badge: { tone: BadgeTone; label: string }
}

/** 분석 진행 화면 머리(#549): 상태별 제목과 오른쪽 위 배지('분석 중' 보라, '분석 실패' 분홍) */
export function progressHeader(status: AnalysisStatus): ProgressHeader {
  return match(status)
    .with('PENDING', () => ({ title: '보고서의 변화를 분석하고 있어요', badge: { tone: 'accent' as const, label: '대기 중' } }))
    .with('RUNNING', () => ({ title: '보고서의 변화를 분석하고 있어요', badge: { tone: 'accent' as const, label: '분석 중' } }))
    .with('COMPLETED', () => ({ title: '분석을 마쳤어요', badge: { tone: 'neutral' as const, label: '완료' } }))
    .with('FAILED', () => ({ title: '분석을 완료하지 못했어요', badge: { tone: 'danger' as const, label: '분석 실패' } }))
    .exhaustive()
}
