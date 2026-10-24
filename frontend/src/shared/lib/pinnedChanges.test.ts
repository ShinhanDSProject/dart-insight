import { describe, expect, it } from 'vitest'
import {
  PINNED_CHANGES_LIMIT,
  isPinnedChange,
  loadPinnedChanges,
  parsePinnedChanges,
  pinnedChangesKey,
  readPinnedChangesRaw,
  removePinnedChanges,
  savePinnedChanges,
  togglePinnedChange,
  type PinnedStorage,
} from './pinnedChanges'

function memoryStorage(initial: Record<string, string> = {}): PinnedStorage & { data: Record<string, string> } {
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

const brokenStorage: PinnedStorage = {
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

describe('togglePinnedChange', () => {
  it('고정하지 않은 변경은 맨 앞에 더한다', () => {
    expect(togglePinnedChange([3, 1], 7)).toEqual([7, 3, 1])
  })

  it('이미 고정한 변경은 풀고 나머지 순서는 그대로 둔다', () => {
    expect(togglePinnedChange([7, 3, 1], 3)).toEqual([7, 1])
  })

  it('50개를 넘게 고정하면 가장 먼저 고정한 것을 버린다', () => {
    let list: number[] = []
    for (let id = 1; id <= PINNED_CHANGES_LIMIT + 1; id += 1) list = togglePinnedChange(list, id)
    expect(list).toHaveLength(PINNED_CHANGES_LIMIT)
    expect(list[0]).toBe(PINNED_CHANGES_LIMIT + 1)
    expect(isPinnedChange(list, 1)).toBe(false)
  })
})

describe('removePinnedChanges', () => {
  it('고른 변경들만 빼고 순서는 그대로 둔다', () => {
    expect(removePinnedChanges([5, 4, 3, 2], [4, 2, 9])).toEqual([5, 3])
  })
})

describe('parsePinnedChanges', () => {
  it('저장된 값이 없으면 빈 목록이다', () => {
    expect(parsePinnedChanges(null)).toEqual([])
  })

  it('JSON이 깨졌거나 배열이 아니면 빈 목록으로 본다', () => {
    expect(parsePinnedChanges('[1,')).toEqual([])
    expect(parsePinnedChanges('{"changeId":1}')).toEqual([])
    expect(parsePinnedChanges('null')).toEqual([])
  })

  it('양의 정수가 아닌 값과 중복은 버리고 나머지는 살린다', () => {
    expect(parsePinnedChanges(JSON.stringify([3, '4', 0, -1, 2.5, 3, null, 8]))).toEqual([3, 8])
  })

  it('50개보다 많이 저장돼 있으면 앞의 50개만 읽는다', () => {
    const raw = JSON.stringify(Array.from({ length: 60 }, (_, i) => i + 1))
    expect(parsePinnedChanges(raw)).toHaveLength(PINNED_CHANGES_LIMIT)
  })
})

describe('loadPinnedChanges·savePinnedChanges', () => {
  it('저장한 목록을 그 분석의 키로 다시 읽는다', () => {
    const storage = memoryStorage()
    savePinnedChanges(storage, 12, [7, 3])
    expect(Object.keys(storage.data)).toEqual([pinnedChangesKey(12)])
    expect(loadPinnedChanges(storage, 12)).toEqual([7, 3])
  })

  it('다른 분석의 고정은 섞이지 않는다', () => {
    const storage = memoryStorage()
    savePinnedChanges(storage, 12, [7, 3])
    savePinnedChanges(storage, 13, [9])
    expect(loadPinnedChanges(storage, 12)).toEqual([7, 3])
    expect(loadPinnedChanges(storage, 13)).toEqual([9])
    expect(loadPinnedChanges(storage, 14)).toEqual([])
  })

  it('빈 목록을 저장하면 그 분석의 키만 지운다', () => {
    const storage = memoryStorage({ [pinnedChangesKey(12)]: '[7]', [pinnedChangesKey(13)]: '[9]' })
    savePinnedChanges(storage, 12, [])
    expect(storage.data).toEqual({ [pinnedChangesKey(13)]: '[9]' })
  })

  it('저장소를 쓸 수 없거나 예외가 나면 빈 목록으로 지내고 예외를 밖으로 내지 않는다', () => {
    expect(readPinnedChangesRaw(null, 12)).toBeNull()
    expect(readPinnedChangesRaw(brokenStorage, 12)).toBeNull()
    expect(loadPinnedChanges(null, 12)).toEqual([])
    expect(loadPinnedChanges(brokenStorage, 12)).toEqual([])
    expect(() => savePinnedChanges(brokenStorage, 12, [7])).not.toThrow()
    expect(() => savePinnedChanges(brokenStorage, 12, [])).not.toThrow()
    expect(() => savePinnedChanges(null, 12, [7])).not.toThrow()
  })

  it('저장된 값이 깨져 있으면 빈 목록으로 읽는다', () => {
    expect(loadPinnedChanges(memoryStorage({ [pinnedChangesKey(12)]: '[{' }), 12)).toEqual([])
  })
})
