import { describe, expect, it } from 'vitest'
import { accountLabel, componentName } from './accountLabel'

describe('자본변동표 계정 이름(#401)', () => {
  it('계정 상세의 마지막 구성요소 이름을 꼬리표 없이 꺼낸다', () => {
    expect(componentName('자본 [구성요소]|지배기업의 소유주에게 귀속되는 지분 [구성요소]|이익잉여금 [구성요소]')).toBe('이익잉여금')
    expect(componentName('자본의 구성요소 [도메인]|비지배지분')).toBe('비지배지분')
    expect(componentName('연결재무제표 [member]')).toBe('연결재무제표')
    expect(componentName(null)).toBeNull()
    expect(componentName(' [member]')).toBeNull()
  })

  it('구성요소가 있으면 계정명 뒤에 붙이고, 없으면 계정명 그대로 둔다', () => {
    expect(accountLabel({ accountName: '기초자본', accountDetail: '자본 [구성요소]|비지배지분 [구성요소]' })).toBe('기초자본 · 비지배지분')
    expect(accountLabel({ accountName: '매출액', accountDetail: null })).toBe('매출액')
  })
})
