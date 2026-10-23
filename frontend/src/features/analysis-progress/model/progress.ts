import { match } from 'ts-pattern'
import type { Analysis, AnalysisStatus, AnalysisStepView, StepState } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import type { PollingOptions } from '@/shared/hooks/pollingState'

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
