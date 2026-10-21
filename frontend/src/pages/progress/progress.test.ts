import { describe, expect, it } from 'vitest'
import type { AnalysisStepView } from '../../api/analyses'
import { nextPollDelay, statusLabel, stepSummary } from './progress'

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
