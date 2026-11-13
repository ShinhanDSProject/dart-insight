import { describe, expect, it } from 'vitest'
import { demoStartStep, isDemoRequested } from './demoActivation'

describe('isDemoRequested', () => {
  it('주소에 ?demo가 있으면 시연 모드를 켠다', () => {
    expect(isDemoRequested('?demo', null)).toBe(true)
    expect(isDemoRequested('?q=삼성&demo=1', null)).toBe(true)
  })

  it('이 탭에서 이미 켰으면 화면을 옮겨도 유지한다', () => {
    expect(isDemoRequested('', 'on')).toBe(true)
  })

  it('그 밖에는 켜지 않는다', () => {
    expect(isDemoRequested('?q=삼성', null)).toBe(false)
  })
})

describe('demoStartStep', () => {
  it('?demo=5면 다섯째 단계(0부터 4)부터 시작한다', () => {
    expect(demoStartStep('?demo=5', '2', 8)).toBe(4)
  })

  it('번호가 없으면 화면이 새로 불리기 전에 남긴 다음 단계부터 이어 간다', () => {
    expect(demoStartStep('', '3', 8)).toBe(3)
  })

  it('번호도 남긴 단계도 없거나 범위를 벗어나면 처음부터 시작한다', () => {
    expect(demoStartStep('?demo', null, 8)).toBe(0)
    expect(demoStartStep('?demo=0', null, 8)).toBe(0)
    expect(demoStartStep('?demo=9', null, 8)).toBe(0)
    expect(demoStartStep('?demo=abc', null, 8)).toBe(0)
    expect(demoStartStep('', '8', 8)).toBe(0)
    expect(demoStartStep('', '', 8)).toBe(0)
  })
})
