import { describe, expect, it } from 'vitest'
import { asyncReducer, type AsyncState } from './asyncState'

const idle: AsyncState<number> = { status: 'idle' }
const loading: AsyncState<number> = { status: 'loading' }
const success: AsyncState<number> = { status: 'success', data: 1 }
const failed: AsyncState<number> = { status: 'error', error: new Error('x') }

describe('asyncReducer', () => {
  it('시작하면 어떤 상태에서든 불러오는 중이 된다', () => {
    expect(asyncReducer(idle, { type: 'start' })).toEqual(loading)
    expect(asyncReducer(success, { type: 'start' })).toEqual(loading)
    expect(asyncReducer(failed, { type: 'start' })).toEqual(loading)
  })

  it('이미 불러오는 중이면 시작해도 같은 객체를 돌려줘 다시 그리지 않는다', () => {
    expect(asyncReducer(loading, { type: 'start' })).toBe(loading)
  })

  it('불러오는 중에 응답이 오면 성공이 된다', () => {
    expect(asyncReducer(loading, { type: 'resolve', data: 2 })).toEqual({ status: 'success', data: 2 })
  })

  it('불러오는 중에 실패하면 오류를 담는다', () => {
    const error = new Error('boom')
    expect(asyncReducer(loading, { type: 'reject', error })).toEqual({ status: 'error', error })
  })

  it('불러오는 중이 아닐 때 늦게 온 응답·오류는 버린다', () => {
    expect(asyncReducer(idle, { type: 'resolve', data: 2 })).toBe(idle)
    expect(asyncReducer(success, { type: 'resolve', data: 2 })).toBe(success)
    expect(asyncReducer(success, { type: 'reject', error: new Error('late') })).toBe(success)
  })

  it('오류 뒤 다시 시도하면 불러오는 중을 거쳐 성공할 수 있다', () => {
    const retried = asyncReducer(failed, { type: 'start' })
    expect(asyncReducer(retried, { type: 'resolve', data: 3 })).toEqual({ status: 'success', data: 3 })
  })

  it('초기화하면 idle이 되고 그 뒤 온 응답은 버린다', () => {
    const reset = asyncReducer(loading, { type: 'reset' })
    expect(reset).toEqual(idle)
    expect(asyncReducer(reset, { type: 'resolve', data: 4 })).toEqual(idle)
  })
})
