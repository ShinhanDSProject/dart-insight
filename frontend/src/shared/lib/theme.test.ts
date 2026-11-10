import { describe, expect, it } from 'vitest'
import {
  THEME_KEY,
  applyThemeChoice,
  parseThemeChoice,
  readThemeChoice,
  resolveThemeChoice,
  saveThemeChoice,
  type ThemeStorage,
} from './theme'

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
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

const brokenStorage: ThemeStorage = {
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

describe('parseThemeChoice', () => {
  it('밝게·어둡게는 그대로 읽는다', () => {
    expect(parseThemeChoice('light')).toBe('light')
    expect(parseThemeChoice('dark')).toBe('dark')
  })

  it('값이 없거나 예전 시스템·모르는 값이면 밝게(#856)', () => {
    expect(parseThemeChoice(null)).toBe('light')
    expect(parseThemeChoice('system')).toBe('light')
    expect(parseThemeChoice('DARK')).toBe('light')
  })
})

describe('readThemeChoice', () => {
  it('처음 온 사용자는 저장된 값이 없어 밝게로 읽는다', () => {
    expect(readThemeChoice(memoryStorage())).toBe('light')
  })

  it('저장된 어둡게를 읽는다', () => {
    expect(readThemeChoice(memoryStorage({ [THEME_KEY]: 'dark' }))).toBe('dark')
  })

  it('저장소가 없거나 읽다가 예외가 나면 null을 돌려준다', () => {
    expect(readThemeChoice(null)).toBeNull()
    expect(readThemeChoice(brokenStorage)).toBeNull()
  })
})

describe('saveThemeChoice', () => {
  it('밝게·어둡게는 저장한다', () => {
    const storage = memoryStorage()
    expect(saveThemeChoice(storage, 'dark')).toBe(true)
    expect(storage.data[THEME_KEY]).toBe('dark')
    saveThemeChoice(storage, 'light')
    expect(storage.data[THEME_KEY]).toBe('light')
  })

  it('저장소가 없거나 저장에 실패하면 false를 돌려준다', () => {
    expect(saveThemeChoice(null, 'dark')).toBe(false)
    expect(saveThemeChoice(brokenStorage, 'dark')).toBe(false)
  })
})

describe('resolveThemeChoice', () => {
  it('이번 방문에 고른 값을 저장값보다 먼저 쓰고, 둘 다 없으면 밝게', () => {
    expect(resolveThemeChoice('dark', 'light')).toBe('dark')
    expect(resolveThemeChoice(null, 'dark')).toBe('dark')
    expect(resolveThemeChoice(null, null)).toBe('light')
  })
})

describe('applyThemeChoice', () => {
  it('어둡게를 고르면 data-theme을 dark로 둔다', () => {
    const root = { dataset: {} as DOMStringMap }
    applyThemeChoice(root, 'dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('밝게를 고르면 data-theme을 light로 둔다(운영체제 설정을 따르지 않게 늘 붙인다)', () => {
    const root = { dataset: { theme: 'dark' } as DOMStringMap }
    applyThemeChoice(root, 'light')
    expect(root.dataset.theme).toBe('light')
  })
})
