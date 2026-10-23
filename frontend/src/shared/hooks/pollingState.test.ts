import { describe, expect, it } from 'vitest'
import { nextPollingDelay, POLLING_START, pollingReducer, type PollingOptions, type PollingState } from './pollingState'

const options: PollingOptions<string> = {
  shouldContinue: (data) => data !== 'done',
  isFatal: (error) => error === 'fatal',
  maxFailures: 3,
  delay: (failures) => 100 * (failures + 1),
}

const fail = (error: unknown = 'net') =>
  ({ type: 'fail', error, fatal: options.isFatal(error), maxFailures: options.maxFailures }) as const

describe('pollingReducer', () => {
  it('값을 받으면 성공이 되고 연속 실패 횟수를 0으로 되돌린다', () => {
    const retrying: PollingState<string> = { status: 'success', data: 'a', failures: 2 }
    expect(pollingReducer(retrying, { type: 'receive', data: 'b' })).toEqual({ status: 'success', data: 'b', failures: 0 })
  })

  it('실패하면 마지막 값을 두고 연속 실패 횟수만 늘린다', () => {
    const ok: PollingState<string> = { status: 'success', data: 'a', failures: 0 }
    expect(pollingReducer(ok, fail())).toEqual({ status: 'success', data: 'a', failures: 1 })
  })

  it('받은 값이 없을 때 실패하면 불러오는 중으로 남아 횟수만 센다', () => {
    expect(pollingReducer(POLLING_START, fail())).toEqual({ status: 'loading', failures: 1 })
  })

  it('연속 실패가 한도에 닿으면 마지막 값과 함께 멈춘다', () => {
    const ok: PollingState<string> = { status: 'success', data: 'a', failures: 2 }
    expect(pollingReducer(ok, fail('last'))).toEqual({ status: 'error', error: 'last', data: 'a' })
  })

  it('바로 멈출 오류면 횟수와 관계없이 멈춘다', () => {
    expect(pollingReducer(POLLING_START, fail('fatal'))).toEqual({ status: 'error', error: 'fatal', data: null })
  })

  it('멈춘 뒤에 온 응답·실패는 버린다', () => {
    const stopped: PollingState<string> = { status: 'error', error: 'x', data: null }
    expect(pollingReducer(stopped, { type: 'receive', data: 'a' })).toBe(stopped)
    expect(pollingReducer(stopped, fail())).toBe(stopped)
  })

  it('다시 시작하면 처음 상태로 돌아간다', () => {
    const stopped: PollingState<string> = { status: 'error', error: 'x', data: 'a' }
    expect(pollingReducer(stopped, { type: 'restart' })).toEqual(POLLING_START)
  })
})

describe('nextPollingDelay', () => {
  it('이어 갈 값을 받았으면 기본 간격 뒤에 다시 묻는다', () => {
    expect(nextPollingDelay({ status: 'success', data: 'a', failures: 0 }, options)).toBe(100)
  })

  it('끝난 값을 받았으면 더 묻지 않는다', () => {
    expect(nextPollingDelay({ status: 'success', data: 'done', failures: 0 }, options)).toBeNull()
  })

  it('실패 중이면 연속 실패 횟수에 맞춘 간격 뒤에 다시 묻는다', () => {
    expect(nextPollingDelay({ status: 'success', data: 'a', failures: 2 }, options)).toBe(300)
    expect(nextPollingDelay({ status: 'loading', failures: 1 }, options)).toBe(200)
  })

  it('멈췄으면 더 묻지 않는다', () => {
    expect(nextPollingDelay({ status: 'error', error: 'x', data: null }, options)).toBeNull()
  })
})
