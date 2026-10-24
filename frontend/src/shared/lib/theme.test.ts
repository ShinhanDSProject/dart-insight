import { describe, expect, it } from 'vitest'
import {
  THEME_KEY,
  applyThemeChoice,
  parseThemeChoice,
  readThemeChoice,
  saveThemeChoice,
  themeAttribute,
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

  it('값이 없거나 모르는 값이면 시스템 설정을 따른다', () => {
    expect(parseThemeChoice(null)).toBe('system')
    expect(parseThemeChoice('system')).toBe('system')
    expect(parseThemeChoice('DARK')).toBe('system')
  })
})

describe('readThemeChoice', () => {
  it('처음 온 사용자는 저장된 값이 없어 시스템으로 읽는다', () => {
    expect(readThemeChoice(memoryStorage())).toBe('system')
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

  it('시스템을 고르면 저장된 값을 지운다', () => {
    const storage = memoryStorage({ [THEME_KEY]: 'dark' })
    expect(saveThemeChoice(storage, 'system')).toBe(true)
    expect(THEME_KEY in storage.data).toBe(false)
  })

  it('저장소가 없거나 저장에 실패하면 false를 돌려준다', () => {
    expect(saveThemeChoice(null, 'dark')).toBe(false)
    expect(saveThemeChoice(brokenStorage, 'dark')).toBe(false)
    expect(saveThemeChoice(brokenStorage, 'system')).toBe(false)
  })
})

describe('themeAttribute', () => {
  it('시스템이면 속성을 두지 않고, 밝게·어둡게는 그 값을 둔다', () => {
    expect(themeAttribute('system')).toBeNull()
    expect(themeAttribute('light')).toBe('light')
    expect(themeAttribute('dark')).toBe('dark')
  })
})

describe('applyThemeChoice', () => {
  it('어둡게를 고르면 data-theme을 dark로 둔다', () => {
    const root = { dataset: {} as DOMStringMap }
    applyThemeChoice(root, 'dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('시스템으로 바꾸면 data-theme을 지운다', () => {
    const root = { dataset: { theme: 'dark' } as DOMStringMap }
    applyThemeChoice(root, 'system')
    expect('theme' in root.dataset).toBe(false)
  })
})
