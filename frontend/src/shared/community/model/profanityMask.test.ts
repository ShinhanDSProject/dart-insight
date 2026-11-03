import { describe, expect, it } from 'vitest'
import {
  maskProfanity,
  PROFANITY_MASK_KEY,
  readProfanityMask,
  saveProfanityMask,
  shownBody,
  type ProfanityMaskStorage,
} from './profanityMask'

function memoryStorage(initial: Record<string, string> = {}): ProfanityMaskStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const broken: ProfanityMaskStorage = {
  getItem: () => {
    throw new Error('막힘')
  },
  setItem: () => {
    throw new Error('막힘')
  },
  removeItem: () => {
    throw new Error('막힘')
  },
}

describe('욕설 가리기', () => {
  it('욕설 단어를 **로 바꾸고 나머지 글은 그대로 둔다', () => {
    expect(maskProfanity('실적 보고 씨발 진짜 화난다')).toBe('실적 보고 ** 진짜 화난다')
    expect(maskProfanity('병신 같은 공시, 지랄이네')).toBe('** 같은 공시, **이네')
  })

  it('초성 줄임말과 영어 욕설도 가린다. 영어는 대소문자를 가리지 않는다', () => {
    expect(maskProfanity('ㅅㅂ 이게 뭐야')).toBe('** 이게 뭐야')
    expect(maskProfanity('What the FUCK')).toBe('What the **')
  })

  it('글자 사이에 점·숫자·기호를 끼워도 가린다', () => {
    expect(maskProfanity('씨.발 시1발 병*신')).toBe('** ** **')
  })

  it('긴 욕설은 통째로 가린다', () => {
    expect(maskProfanity('미친새끼')).toBe('**')
  })

  it('띄어 쓴 글자나 멀쩡한 낱말은 가리지 않는다', () => {
    const clean = '회의 시 발언, 시발점과 시발역, 등신대, 5개년 계획, 새끼손가락'
    expect(maskProfanity(clean)).toBe(clean)
  })

  it('끄면 본문을 그대로 보이고, 켜면 가린 본문을 보인다', () => {
    expect(shownBody('씨발', false)).toBe('씨발')
    expect(shownBody('씨발', true)).toBe('**')
  })

  it('켬은 브라우저에 1로 남기고, 끄면 지운다', () => {
    const storage = memoryStorage()

    saveProfanityMask(storage, true)
    expect(storage.data[PROFANITY_MASK_KEY]).toBe('1')
    expect(readProfanityMask(storage)).toBe(true)

    saveProfanityMask(storage, false)
    expect(storage.data[PROFANITY_MASK_KEY]).toBeUndefined()
    expect(readProfanityMask(storage)).toBe(false)
  })

  it('저장소가 없거나 막혀 있으면 꺼짐으로 읽고, 저장 실패는 조용히 넘어간다', () => {
    expect(readProfanityMask(null)).toBe(false)
    expect(readProfanityMask(broken)).toBe(false)
    expect(readProfanityMask(memoryStorage({ [PROFANITY_MASK_KEY]: 'yes' }))).toBe(false)
    expect(() => saveProfanityMask(broken, true)).not.toThrow()
    expect(() => saveProfanityMask(null, true)).not.toThrow()
  })
})
