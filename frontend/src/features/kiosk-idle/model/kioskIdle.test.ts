import { describe, expect, it } from 'vitest'
import { KIOSK_DEFAULT_SECONDS, kioskPhase, kioskRequest, kioskSeconds } from './kioskIdle'

describe('kioskRequest', () => {
  it('주소에 ?kiosk가 없으면 아무것도 바꾸지 않는다', () => {
    expect(kioskRequest('')).toEqual({ kind: 'none' })
    expect(kioskRequest('?q=삼성')).toEqual({ kind: 'none' })
  })

  it('?kiosk만 있으면 기본 시간으로 켠다', () => {
    expect(kioskRequest('?kiosk')).toEqual({ kind: 'on', seconds: KIOSK_DEFAULT_SECONDS })
    expect(kioskRequest('?kiosk=abc')).toEqual({ kind: 'on', seconds: KIOSK_DEFAULT_SECONDS })
  })

  it('?kiosk=60처럼 초를 주면 그 시간으로 켠다', () => {
    expect(kioskRequest('?q=삼성&kiosk=60')).toEqual({ kind: 'on', seconds: 60 })
  })

  it('?kiosk=off면 끈다', () => {
    expect(kioskRequest('?kiosk=off')).toEqual({ kind: 'off' })
  })
})

describe('kioskSeconds', () => {
  it('정수가 아니거나 비어 있으면 null이다', () => {
    expect(kioskSeconds(null)).toBeNull()
    expect(kioskSeconds('')).toBeNull()
    expect(kioskSeconds('1.5')).toBeNull()
    expect(kioskSeconds('on')).toBeNull()
  })

  it('30초보다 짧거나 1시간보다 길면 그 안으로 맞춘다', () => {
    expect(kioskSeconds('5')).toBe(30)
    expect(kioskSeconds('90')).toBe(90)
    expect(kioskSeconds('99999')).toBe(3600)
  })
})

describe('kioskPhase', () => {
  it('끝나기 15초 전까지는 그대로 쓴다', () => {
    expect(kioskPhase(0, 120)).toEqual({ status: 'active' })
    expect(kioskPhase(104_000, 120)).toEqual({ status: 'active' })
  })

  it('15초 전부터 남은 초를 올림해 센다', () => {
    expect(kioskPhase(105_000, 120)).toEqual({ status: 'warning', secondsLeft: 15 })
    expect(kioskPhase(110_500, 120)).toEqual({ status: 'warning', secondsLeft: 10 })
    expect(kioskPhase(119_900, 120)).toEqual({ status: 'warning', secondsLeft: 1 })
  })

  it('시간이 다 되면 대기 화면으로 돌아간다', () => {
    expect(kioskPhase(120_000, 120)).toEqual({ status: 'leave' })
    expect(kioskPhase(500_000, 120)).toEqual({ status: 'leave' })
  })
})
