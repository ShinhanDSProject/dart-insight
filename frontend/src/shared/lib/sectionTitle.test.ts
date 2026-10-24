import { describe, expect, it } from 'vitest'
import { displaySectionPath, displaySectionTitle } from './sectionTitle'

describe('displaySectionTitle', () => {
  it('한 글자씩 띄운 한글 제목을 붙인다', () => {
    expect(displaySectionTitle('반 기 보 고 서')).toBe('반기보고서')
  })

  it('목차 밖 본문은 사용자 말로 보인다', () => {
    expect(displaySectionTitle('(목차 밖 본문)')).toBe('표지·목차 앞 내용')
  })

  it('보통 제목은 그대로 둔다', () => {
    expect(displaySectionTitle('II. 사업의 내용')).toBe('II. 사업의 내용')
    expect(displaySectionTitle('1. 회사의 개요')).toBe('1. 회사의 개요')
  })

  it('경로는 단계마다 바꾼다', () => {
    expect(displaySectionPath('반 기 보 고 서 > 【 대표이사 등의 확인 】')).toBe('반기보고서 > 【 대표이사 등의 확인 】')
  })
})
