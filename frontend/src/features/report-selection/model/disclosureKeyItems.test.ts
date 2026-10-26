import { describe, expect, it } from 'vitest'
import { keyItemText } from './disclosureKeyItems'

describe('핵심 수치 표시 글', () => {
  it('원문 값에 단위를 붙이고 값은 바꾸지 않는다', () => {
    expect(keyItemText({ value: '10,492,048,000', unit: '원' })).toBe('10,492,048,000 원')
    expect(keyItemText({ value: '2,696', unit: '원/주' })).toBe('2,696 원/주')
    expect(keyItemText({ value: '65,168', unit: '주' })).toBe('65,168 주')
  })

  it('%는 값에 바로 붙인다', () => {
    expect(keyItemText({ value: '10.46', unit: '%' })).toBe('10.46%')
  })

  it('단위가 없으면 값만 보여 준다', () => {
    expect(keyItemText({ value: '2025년 10월 22일', unit: null })).toBe('2025년 10월 22일')
  })
})
