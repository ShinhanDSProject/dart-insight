import { describe, expect, it } from 'vitest'
import type { Analysis, AnalysisStepView, StepState } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import { analysisPolling, isClientError, nextPollDelay, statusLabel, stepMarker, stepStateLabel, stepSummary } from './progress'

const steps = (states: AnalysisStepView['state'][]): AnalysisStepView[] =>
  (['RECEIVED', 'COMPARING', 'VERIFYING', 'DONE'] as const).map((step, i) => ({
    step,
    label: ['요청 접수', '보고서 비교', '근거 확인', '완료'][i],
    state: states[i],
  }))

describe('progress', () => {
  it('평소에는 1초마다, 실패하면 간격을 늘려 다시 묻는다', () => {
    expect(nextPollDelay(0)).toBe(1000)
    expect(nextPollDelay(1)).toBe(2000)
    expect(nextPollDelay(3)).toBe(8000)
    expect(nextPollDelay(6)).toBe(10000)
  })

  it('상태 문구', () => {
    expect(statusLabel('RUNNING')).toBe('분석 중')
    expect(statusLabel('FAILED')).toBe('실패')
  })

  it('진행 단계 요약', () => {
    expect(stepSummary(steps(['DONE', 'ACTIVE', 'PENDING', 'PENDING']))).toBe(
      '완료: 요청 접수 · 진행 중: 보고서 비교 · 다음: 근거 확인',
    )
    expect(stepSummary(steps(['DONE', 'FAILED', 'PENDING', 'PENDING']))).toBe('완료: 요청 접수 · 실패: 보고서 비교')
  })
})

describe('분석 상태 조회', () => {
  const analysis = (status: Analysis['status']) => ({ status }) as Analysis
  const apiError = (status: number) => new ApiError(status, { code: 'X', message: 'x', traceId: null, errors: [] })

  it('대기·진행 중이면 계속 묻고 완료·실패하면 멈춘다', () => {
    expect(analysisPolling.shouldContinue(analysis('PENDING'))).toBe(true)
    expect(analysisPolling.shouldContinue(analysis('RUNNING'))).toBe(true)
    expect(analysisPolling.shouldContinue(analysis('COMPLETED'))).toBe(false)
    expect(analysisPolling.shouldContinue(analysis('FAILED'))).toBe(false)
  })

  it('4xx 오류만 바로 멈추고 5xx·연결 오류는 다시 묻는다', () => {
    expect(isClientError(apiError(404))).toBe(true)
    expect(isClientError(apiError(500))).toBe(false)
    expect(isClientError(apiError(0))).toBe(false)
    expect(isClientError(new Error('x'))).toBe(false)
  })

  it('단계 상태 문구와 표시. 모르는 값은 대기로 본다', () => {
    expect(stepStateLabel('DONE')).toBe('완료')
    expect(stepStateLabel('ACTIVE')).toBe('진행 중')
    expect(stepStateLabel('PENDING')).toBe('대기')
    expect(stepStateLabel('UNKNOWN' as StepState)).toBe('대기')
    expect(stepMarker('DONE')).toBe('✓')
    expect(stepMarker('FAILED')).toBe('!')
    expect(stepMarker('ACTIVE')).toBe('')
  })
})
