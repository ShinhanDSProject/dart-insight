import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_DISMISSED_KEY,
  isOnboardingVisible,
  onboardingDismissed,
  readOnboardingDismissed,
  saveOnboardingDismissed,
  type OnboardingStorage,
} from './onboarding'

function memoryStorage(initial: Record<string, string> = {}): OnboardingStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const brokenStorage: OnboardingStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('readOnboardingDismissed', () => {
  it('처음 온 사용자는 저장된 값이 없어 닫지 않은 것으로 읽는다', () => {
    expect(readOnboardingDismissed(memoryStorage())).toBe(false)
  })

  it("저장된 값이 '1'이면 닫은 것으로 읽는다", () => {
    expect(readOnboardingDismissed(memoryStorage({ [ONBOARDING_DISMISSED_KEY]: '1' }))).toBe(true)
  })

  it("'1'이 아닌 값은 닫지 않은 것으로 읽는다", () => {
    expect(readOnboardingDismissed(memoryStorage({ [ONBOARDING_DISMISSED_KEY]: 'true' }))).toBe(false)
  })

  it('저장소가 없거나 읽다가 예외가 나면 모른다는 뜻으로 null을 돌린다', () => {
    expect(readOnboardingDismissed(null)).toBeNull()
    expect(readOnboardingDismissed(brokenStorage)).toBeNull()
  })
})

describe('saveOnboardingDismissed', () => {
  it("닫으면 '1'을 남긴다", () => {
    const storage = memoryStorage()
    expect(saveOnboardingDismissed(storage, true)).toBe(true)
    expect(storage.data[ONBOARDING_DISMISSED_KEY]).toBe('1')
  })

  it('다시 보기를 누르면 저장된 값을 지워 다시 보이게 한다', () => {
    const storage = memoryStorage({ [ONBOARDING_DISMISSED_KEY]: '1' })
    expect(saveOnboardingDismissed(storage, false)).toBe(true)
    expect(ONBOARDING_DISMISSED_KEY in storage.data).toBe(false)
    expect(readOnboardingDismissed(storage)).toBe(false)
  })

  it('저장소가 없거나 저장하다 예외가 나면 false를 돌리고 예외를 내지 않는다', () => {
    expect(saveOnboardingDismissed(null, true)).toBe(false)
    expect(saveOnboardingDismissed(brokenStorage, true)).toBe(false)
    expect(saveOnboardingDismissed(brokenStorage, false)).toBe(false)
  })
})

describe('onboardingDismissed', () => {
  it('저장된 값을 읽을 수 있으면 이번 방문의 값보다 저장된 값을 따른다', () => {
    expect(onboardingDismissed(true, false)).toBe(true)
    expect(onboardingDismissed(false, true)).toBe(false)
  })

  it('저장소를 쓸 수 없으면 이번 방문 동안 닫았는지를 따른다', () => {
    expect(onboardingDismissed(null, true)).toBe(true)
    expect(onboardingDismissed(null, false)).toBe(false)
  })
})

describe('isOnboardingVisible', () => {
  it('검색어가 없고 닫지 않았으면 보인다', () => {
    expect(isOnboardingVisible('', false)).toBe(true)
  })

  it('닫았으면 보이지 않는다', () => {
    expect(isOnboardingVisible('', true)).toBe(false)
  })

  it('검색어가 있으면 닫지 않았어도 보이지 않는다', () => {
    expect(isOnboardingVisible('삼성', false)).toBe(false)
  })
})
