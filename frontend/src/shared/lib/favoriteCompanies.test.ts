import { describe, expect, it } from 'vitest'
import type { Company } from '@/shared/api/companies'
import {
  FAVORITE_COMPANIES_KEY,
  addFavoriteCompany,
  isFavoriteCompany,
  loadFavoriteCompanies,
  parseFavoriteCompanies,
  readFavoriteCompaniesRaw,
  removeFavoriteCompany,
  saveFavoriteCompanies,
  toFavoriteCompany,
  toggleFavoriteCompany,
  type FavoriteCompany,
  type FavoriteStorage,
} from './favoriteCompanies'

const samsung: Company = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }
const unlisted: Company = { corpCode: '00999999', corpName: '한빛물산', stockCode: null, listed: false }

function entry(n: number, addedAt = '2026-10-25T03:00:00.000Z'): FavoriteCompany {
  return {
    corpCode: String(n).padStart(8, '0'),
    corpName: `회사${n}`,
    stockCode: null,
    listed: false,
    addedAt,
  }
}

function codes(list: FavoriteCompany[]): string[] {
  return list.map((item) => item.corpCode)
}

function memoryStorage(initial: Record<string, string> = {}): FavoriteStorage & { data: Record<string, string> } {
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

const brokenStorage: FavoriteStorage = {
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

describe('toFavoriteCompany', () => {
  it('고유번호·회사명·종목코드·상장 여부와 추가한 시각을 남긴다', () => {
    expect(toFavoriteCompany(samsung, new Date('2026-10-25T03:00:00.000Z'))).toEqual({
      corpCode: '00126380',
      corpName: '삼성전자',
      stockCode: '005930',
      listed: true,
      addedAt: '2026-10-25T03:00:00.000Z',
    })
  })

  it('비상장사는 종목코드를 null로 둔다', () => {
    expect(toFavoriteCompany(unlisted, new Date('2026-10-25T03:00:00.000Z')).stockCode).toBeNull()
  })
})

describe('addFavoriteCompany', () => {
  it('새로 고정한 기업을 맨 앞에 더한다', () => {
    expect(codes(addFavoriteCompany([entry(1), entry(2)], entry(3)))).toEqual(['00000003', '00000001', '00000002'])
  })

  it('이미 있는 기업을 다시 더하면 하나만 남기고 맨 앞으로 옮긴다', () => {
    const again = entry(2, '2026-10-25T05:00:00.000Z')
    const list = addFavoriteCompany([entry(1), entry(2), entry(3)], again)
    expect(codes(list)).toEqual(['00000002', '00000001', '00000003'])
    expect(list[0].addedAt).toBe(again.addedAt)
  })

  it('13개를 차례로 더하면 가장 먼저 더한 하나를 버리고 최신 12개만 남긴다', () => {
    let list: FavoriteCompany[] = []
    for (let n = 1; n <= 13; n += 1) list = addFavoriteCompany(list, entry(n))
    expect(list).toHaveLength(12)
    expect(list[0].corpCode).toBe('00000013')
    expect(isFavoriteCompany(list, '00000001')).toBe(false)
  })
})

describe('removeFavoriteCompany·isFavoriteCompany', () => {
  it('고른 기업만 빼고 순서는 그대로 둔다', () => {
    expect(codes(removeFavoriteCompany([entry(1), entry(2), entry(3)], '00000002'))).toEqual(['00000001', '00000003'])
  })

  it('없는 기업을 빼려 하면 목록이 그대로다', () => {
    expect(removeFavoriteCompany([entry(1)], '00000009')).toEqual([entry(1)])
  })

  it('고유번호로 관심 기업인지 안다', () => {
    expect(isFavoriteCompany([entry(1)], '00000001')).toBe(true)
    expect(isFavoriteCompany([entry(1)], '00126380')).toBe(false)
  })
})

describe('toggleFavoriteCompany', () => {
  const now = new Date('2026-10-25T03:00:00.000Z')

  it('관심 기업이 아니면 맨 앞에 더한다', () => {
    const list = toggleFavoriteCompany([entry(1)], samsung, now)
    expect(codes(list)).toEqual(['00126380', '00000001'])
    expect(list[0].corpName).toBe('삼성전자')
  })

  it('이미 관심 기업이면 뺀다', () => {
    const list = toggleFavoriteCompany([toFavoriteCompany(samsung, now), entry(1)], samsung, now)
    expect(codes(list)).toEqual(['00000001'])
  })
})

describe('parseFavoriteCompanies', () => {
  it('저장된 값이 없으면 빈 목록이다', () => {
    expect(parseFavoriteCompanies(null)).toEqual([])
  })

  it('JSON이 깨졌거나 배열이 아니면 빈 목록으로 본다', () => {
    expect(parseFavoriteCompanies('{not json')).toEqual([])
    expect(parseFavoriteCompanies('{"corpCode":"00126380"}')).toEqual([])
    expect(parseFavoriteCompanies('null')).toEqual([])
  })

  it('모양이 틀린 항목과 중복은 버리고 나머지는 살린다', () => {
    const raw = JSON.stringify([
      entry(1),
      { ...entry(2), listed: 'Y' },
      entry(1),
      { ...entry(3), addedAt: '어제' },
      { ...entry(4), stockCode: 5930 },
      { ...entry(5), corpCode: '' },
      entry(6),
    ])
    expect(codes(parseFavoriteCompanies(raw))).toEqual(['00000001', '00000006'])
  })

  it('저장된 항목에 다른 필드가 붙어 있으면 버리고 정한 필드만 읽는다', () => {
    const raw = JSON.stringify([{ ...entry(1), memo: '메모' }])
    expect(parseFavoriteCompanies(raw)).toEqual([entry(1)])
  })

  it('12개보다 많이 저장돼 있으면 앞의 12개만 읽는다', () => {
    const raw = JSON.stringify(Array.from({ length: 15 }, (_, i) => entry(i + 1)))
    expect(parseFavoriteCompanies(raw)).toHaveLength(12)
  })
})

describe('loadFavoriteCompanies·saveFavoriteCompanies', () => {
  it('저장한 목록을 같은 키로 다시 읽는다', () => {
    const storage = memoryStorage()
    saveFavoriteCompanies(storage, [entry(1), entry(2)])
    expect(Object.keys(storage.data)).toEqual([FAVORITE_COMPANIES_KEY])
    expect(loadFavoriteCompanies(storage)).toEqual([entry(1), entry(2)])
  })

  it('빈 목록을 저장하면 키를 지운다', () => {
    const storage = memoryStorage({ [FAVORITE_COMPANIES_KEY]: JSON.stringify([entry(1)]) })
    saveFavoriteCompanies(storage, [])
    expect(storage.data).toEqual({})
  })

  it('저장소를 쓸 수 없거나 예외가 나면 빈 목록으로 지내고 예외를 밖으로 내지 않는다', () => {
    expect(readFavoriteCompaniesRaw(null)).toBeNull()
    expect(readFavoriteCompaniesRaw(brokenStorage)).toBeNull()
    expect(loadFavoriteCompanies(null)).toEqual([])
    expect(loadFavoriteCompanies(brokenStorage)).toEqual([])
    expect(() => saveFavoriteCompanies(brokenStorage, [entry(1)])).not.toThrow()
    expect(() => saveFavoriteCompanies(brokenStorage, [])).not.toThrow()
    expect(() => saveFavoriteCompanies(null, [entry(1)])).not.toThrow()
  })

  it('저장된 값이 깨져 있으면 빈 목록으로 읽는다', () => {
    expect(loadFavoriteCompanies(memoryStorage({ [FAVORITE_COMPANIES_KEY]: '[{' }))).toEqual([])
  })
})
