import { describe, expect, it } from 'vitest'
import { softenProfanity } from './profanityMask'

describe('욕설 순화', () => {
  it('두 글자 이하 욕설은 좋아로, 세 글자 이상은 사랑해로 바꾸고 나머지 글은 그대로 둔다', () => {
    expect(softenProfanity('실적 보고 씨발 진짜 화난다')).toBe('실적 보고 좋아 진짜 화난다')
    expect(softenProfanity('개새끼')).toBe('사랑해')
    expect(softenProfanity('병신 같은 공시, 지랄이네')).toBe('좋아 같은 공시, 좋아이네')
    expect(softenProfanity('썅')).toBe('좋아')
  })

  it('초성 줄임말과 영어 욕설도 바꾼다. 영어는 대소문자를 가리지 않는다', () => {
    expect(softenProfanity('ㅅㅂ 이게 뭐야')).toBe('좋아 이게 뭐야')
    expect(softenProfanity('What the FUCK')).toBe('What the 사랑해')
  })

  it('글자 사이에 점·숫자·기호를 끼워도 바꾸고, 끼운 것은 글자 수에 세지 않는다', () => {
    expect(softenProfanity('씨.발 시1발 병*신')).toBe('좋아 좋아 좋아')
    expect(softenProfanity('개.새.끼')).toBe('사랑해')
  })

  it('긴 욕설은 통째로 바꾼다', () => {
    expect(softenProfanity('미친새끼')).toBe('사랑해')
  })

  it('띄어 쓴 글자나 멀쩡한 낱말은 바꾸지 않는다', () => {
    const clean = '회의 시 발언, 시발점과 시발역, 등신대, 5개년 계획, 새끼손가락'
    expect(softenProfanity(clean)).toBe(clean)
  })
})
