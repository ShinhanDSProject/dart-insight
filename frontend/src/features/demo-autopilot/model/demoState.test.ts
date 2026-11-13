import { describe, expect, it } from 'vitest'
import { createDemoReducer, demoProgress, initialDemoState, type DemoState } from './demoState'

const reduce = createDemoReducer(3)

describe('createDemoReducer', () => {
  it('시작 전에 Space를 누르면 첫 단계를 실행한다', () => {
    expect(reduce(initialDemoState(), { type: 'next' })).toEqual({ status: 'running', step: 0 })
  })

  it('이어서 시작할 단계를 정하면 그 단계부터 실행한다', () => {
    expect(reduce(initialDemoState(2), { type: 'next' })).toEqual({ status: 'running', step: 2 })
  })

  it('단계를 마치면 다음 Space를 기다린다', () => {
    expect(reduce({ status: 'running', step: 0 }, { type: 'step-done' })).toEqual({ status: 'done', step: 0 })
  })

  it('마친 뒤 Space를 누르면 다음 단계를 실행한다', () => {
    expect(reduce({ status: 'done', step: 0 }, { type: 'next' })).toEqual({ status: 'running', step: 1 })
  })

  it('실행 중에 누른 Space는 무시해 단계가 겹치지 않는다', () => {
    const running: DemoState = { status: 'running', step: 1 }
    expect(reduce(running, { type: 'next' })).toBe(running)
  })

  it('단계를 끝내지 못해도 Space로 다음 단계로 넘어간다', () => {
    const failed = reduce({ status: 'running', step: 1 }, { type: 'step-failed', reason: '화면을 찾지 못했어요' })
    expect(failed).toEqual({ status: 'failed', step: 1, reason: '화면을 찾지 못했어요' })
    expect(reduce(failed, { type: 'next' })).toEqual({ status: 'running', step: 2 })
  })

  it('마지막 단계를 마친 뒤 Space를 누르면 시연을 마친다', () => {
    expect(reduce({ status: 'done', step: 2 }, { type: 'next' })).toEqual({ status: 'finished' })
  })

  it('단계가 없으면 바로 마친다', () => {
    expect(createDemoReducer(0)(initialDemoState(), { type: 'next' })).toEqual({ status: 'finished' })
  })
})

describe('demoProgress', () => {
  it('진행 중이면 지금 단계와 전체 단계 수를 보인다', () => {
    expect(demoProgress({ status: 'done', step: 1 }, 3)).toBe('2 / 3')
  })

  it('시작 전과 끝난 뒤에는 보이지 않는다', () => {
    expect(demoProgress({ status: 'idle', next: 0 }, 3)).toBeNull()
    expect(demoProgress({ status: 'finished' }, 3)).toBeNull()
  })
})
