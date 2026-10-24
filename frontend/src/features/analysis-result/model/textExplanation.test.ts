import { describe, expect, it } from 'vitest'
import type { TextExplanation, TextExplanationEvidence } from '@/shared/api/textChanges'
import {
  explanationOf,
  explanationReducer,
  explanationSideLabel,
  explanationTarget,
  initialExplanations,
  orderedEvidence,
  shouldRequest,
} from './textExplanation'

const evidence = (
  side: 'previous' | 'current',
  rceptNo: string,
  blockNo: number,
  sectionNo: number | null = 1,
): TextExplanationEvidence => ({
  side,
  rceptNo,
  sectionNo,
  blockNo,
  sectionPath: sectionNo === null ? null : 'II. 사업의 내용 > 7. 기타 참고사항',
  evidenceId: `${rceptNo}#B${blockNo}`,
})

const result = { changeId: 7, status: 'OK' } as TextExplanation

describe('explanationReducer', () => {
  it('처음 부르면 그 카드만 불러오는 중이 된다', () => {
    const state = explanationReducer(initialExplanations, { type: 'start', changeId: 7 })
    expect(explanationOf(state, 7)).toEqual({ status: 'loading' })
    expect(explanationOf(state, 8)).toEqual({ status: 'idle' })
  })

  it('응답이 오면 그 카드에 풀이를 남기고 다른 카드는 그대로 둔다', () => {
    const both = explanationReducer(explanationReducer(initialExplanations, { type: 'start', changeId: 7 }), {
      type: 'start',
      changeId: 8,
    })
    const state = explanationReducer(both, { type: 'resolve', changeId: 7, data: result })
    expect(explanationOf(state, 7)).toEqual({ status: 'success', data: result })
    expect(explanationOf(state, 8)).toEqual({ status: 'loading' })
  })

  it('받은 풀이는 다시 시작해도 바꾸지 않는다', () => {
    const loading = explanationReducer(initialExplanations, { type: 'start', changeId: 7 })
    const done = explanationReducer(loading, { type: 'resolve', changeId: 7, data: result })
    expect(explanationReducer(done, { type: 'start', changeId: 7 })).toBe(done)
  })

  it('실패하면 오류를 남기고, 다시 시도하면 불러오는 중이 된다', () => {
    const loading = explanationReducer(initialExplanations, { type: 'start', changeId: 7 })
    const failed = explanationReducer(loading, { type: 'reject', changeId: 7, error: 'x' })
    expect(explanationOf(failed, 7)).toEqual({ status: 'error', error: 'x' })
    expect(explanationOf(explanationReducer(failed, { type: 'start', changeId: 7 }), 7)).toEqual({ status: 'loading' })
  })

  it('불러오지 않은 카드에 늦게 온 응답은 버린다', () => {
    expect(explanationReducer(initialExplanations, { type: 'resolve', changeId: 7, data: result })).toBe(initialExplanations)
    expect(explanationReducer(initialExplanations, { type: 'reject', changeId: 7, error: 'x' })).toBe(initialExplanations)
  })

  it('초기화하면 모든 카드의 풀이를 지운다', () => {
    const loading = explanationReducer(initialExplanations, { type: 'start', changeId: 7 })
    expect(explanationReducer(loading, { type: 'reset' })).toEqual({})
  })
})

describe('shouldRequest', () => {
  it('처음이거나 실패했을 때만 새로 부른다', () => {
    expect(shouldRequest({ status: 'idle' })).toBe(true)
    expect(shouldRequest({ status: 'error', error: 'x' })).toBe(true)
    expect(shouldRequest({ status: 'loading' })).toBe(false)
    expect(shouldRequest({ status: 'success', data: result })).toBe(false)
  })
})

describe('explanationSideLabel', () => {
  it('근거 쪽을 이전·현재 원문으로 적는다', () => {
    expect(explanationSideLabel('previous')).toBe('이전 원문')
    expect(explanationSideLabel('current')).toBe('현재 원문')
  })
})

describe('orderedEvidence', () => {
  it('이전 원문을 먼저 두고 같은 근거 ID는 한 번만 둔다', () => {
    const cur = evidence('current', '20260814003699', 1840)
    const prev = evidence('previous', '20260314001111', 1700)
    expect(orderedEvidence([cur, prev, cur])).toEqual([prev, cur])
  })
})

describe('explanationTarget', () => {
  it('근거의 쪽·섹션 번호·블록 번호로 원문 확인 위치를 만든다', () => {
    expect(explanationTarget(evidence('current', '20260814003699', 1840, 212))).toEqual({
      side: 'current',
      section: 212,
      block: 1840,
    })
    expect(explanationTarget(evidence('previous', '20260314001111', 1700, 198))).toEqual({
      side: 'previous',
      section: 198,
      block: 1700,
    })
  })

  it('섹션 번호를 찾지 못한 근거는 열지 않는다', () => {
    expect(explanationTarget(evidence('current', '20260814003699', 1840, null))).toBeNull()
  })
})
