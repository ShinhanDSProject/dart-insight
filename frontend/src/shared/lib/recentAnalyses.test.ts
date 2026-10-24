import { describe, expect, it } from 'vitest'
import {
  RECENT_ANALYSES_KEY,
  addRecentAnalysis,
  loadRecentAnalyses,
  parseRecentAnalyses,
  removeRecentAnalysis,
  saveRecentAnalyses,
  toRecentAnalysis,
  viewedAtLabel,
  type RecentAnalysis,
  type RecentStorage,
} from './recentAnalyses'

function entry(analysisId: number, viewedAt = '2026-10-25T03:00:00.000Z'): RecentAnalysis {
  return {
    analysisId,
    corpName: `회사${analysisId}`,
    previousReportName: '반기보고서 (2025.06)',
    currentReportName: '반기보고서 (2026.06)',
    basisLabel: '전년 동기',
    viewedAt,
  }
}

function memoryStorage(initial: Record<string, string> = {}): RecentStorage & { data: Record<string, string> } {
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

const brokenStorage: RecentStorage = {
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

describe('addRecentAnalysis', () => {
  it('새로 본 분석을 맨 앞에 더한다', () => {
    const list = addRecentAnalysis([entry(1), entry(2)], entry(3))
    expect(list.map((e) => e.analysisId)).toEqual([3, 1, 2])
  })

  it('이미 있는 분석을 다시 보면 하나만 남기고 맨 앞으로 옮긴다', () => {
    const again = entry(2, '2026-10-25T05:00:00.000Z')
    const list = addRecentAnalysis([entry(1), entry(2), entry(3)], again)
    expect(list.map((e) => e.analysisId)).toEqual([2, 1, 3])
    expect(list[0].viewedAt).toBe(again.viewedAt)
  })

  it('9개를 차례로 보면 가장 오래된 하나를 버리고 최신 8개만 남긴다', () => {
    let list: RecentAnalysis[] = []
    for (let id = 1; id <= 9; id += 1) list = addRecentAnalysis(list, entry(id))
    expect(list.map((e) => e.analysisId)).toEqual([9, 8, 7, 6, 5, 4, 3, 2])
  })
})

describe('removeRecentAnalysis', () => {
  it('고른 분석만 빼고 순서는 그대로 둔다', () => {
    expect(removeRecentAnalysis([entry(1), entry(2), entry(3)], 2).map((e) => e.analysisId)).toEqual([1, 3])
  })

  it('없는 분석을 빼려 하면 목록이 그대로다', () => {
    expect(removeRecentAnalysis([entry(1)], 9)).toEqual([entry(1)])
  })
})

describe('parseRecentAnalyses', () => {
  it('저장된 값이 없으면 빈 목록이다', () => {
    expect(parseRecentAnalyses(null)).toEqual([])
  })

  it('JSON이 깨졌거나 배열이 아니면 빈 목록으로 본다', () => {
    expect(parseRecentAnalyses('{not json')).toEqual([])
    expect(parseRecentAnalyses('{"analysisId":1}')).toEqual([])
    expect(parseRecentAnalyses('null')).toEqual([])
  })

  it('모양이 틀린 항목과 중복은 버리고 나머지는 살린다', () => {
    const raw = JSON.stringify([entry(1), { analysisId: '2' }, entry(1), { ...entry(3), viewedAt: 'yesterday' }, entry(4)])
    expect(parseRecentAnalyses(raw).map((e) => e.analysisId)).toEqual([1, 4])
  })

  it('8개보다 많이 저장돼 있으면 앞의 8개만 읽는다', () => {
    const raw = JSON.stringify(Array.from({ length: 10 }, (_, i) => entry(i + 1)))
    expect(parseRecentAnalyses(raw)).toHaveLength(8)
  })
})

describe('loadRecentAnalyses·saveRecentAnalyses', () => {
  it('저장한 목록을 같은 키로 다시 읽는다', () => {
    const storage = memoryStorage()
    saveRecentAnalyses(storage, [entry(1), entry(2)])
    expect(Object.keys(storage.data)).toEqual([RECENT_ANALYSES_KEY])
    expect(loadRecentAnalyses(storage)).toEqual([entry(1), entry(2)])
  })

  it('빈 목록을 저장하면 키를 지운다', () => {
    const storage = memoryStorage({ [RECENT_ANALYSES_KEY]: JSON.stringify([entry(1)]) })
    saveRecentAnalyses(storage, [])
    expect(storage.data).toEqual({})
  })

  it('저장소를 쓸 수 없거나 예외가 나면 빈 목록으로 지내고 예외를 밖으로 내지 않는다', () => {
    expect(loadRecentAnalyses(null)).toEqual([])
    expect(loadRecentAnalyses(brokenStorage)).toEqual([])
    expect(() => saveRecentAnalyses(brokenStorage, [entry(1)])).not.toThrow()
    expect(() => saveRecentAnalyses(brokenStorage, [])).not.toThrow()
    expect(() => saveRecentAnalyses(null, [entry(1)])).not.toThrow()
  })
})

describe('toRecentAnalysis', () => {
  it('회사·두 보고서 이름·비교 기준 이름·본 시각을 남긴다', () => {
    const recent = toRecentAnalysis(
      {
        analysisId: 7,
        corpName: '삼성전자',
        basis: 'PREV',
        previous: { reportName: '1분기보고서 (2026.03)' },
        current: { reportName: '반기보고서 (2026.06)' },
      },
      new Date('2026-10-25T03:00:00.000Z'),
    )
    expect(recent).toEqual({
      analysisId: 7,
      corpName: '삼성전자',
      previousReportName: '1분기보고서 (2026.03)',
      currentReportName: '반기보고서 (2026.06)',
      basisLabel: '직전 기간',
      viewedAt: '2026-10-25T03:00:00.000Z',
    })
  })
})

describe('viewedAtLabel', () => {
  const now = new Date('2026-10-25T12:00:00.000Z')

  it('1분 안이면 방금 전, 1시간 안이면 분, 하루 안이면 시간, 7일 안이면 일로 보인다', () => {
    expect(viewedAtLabel('2026-10-25T11:59:30.000Z', now)).toBe('방금 전')
    expect(viewedAtLabel('2026-10-25T11:15:00.000Z', now)).toBe('45분 전')
    expect(viewedAtLabel('2026-10-25T09:00:00.000Z', now)).toBe('3시간 전')
    expect(viewedAtLabel('2026-10-22T12:00:00.000Z', now)).toBe('3일 전')
  })

  it('7일이 지났거나 미래 시각이면 한국 시간 날짜로 보인다', () => {
    expect(viewedAtLabel('2026-10-01T16:00:00.000Z', now)).toBe('2026.10.02')
    expect(viewedAtLabel('2026-10-26T12:00:00.000Z', now)).toBe('2026.10.26')
  })

  it('시각을 읽을 수 없으면 빈 글자다', () => {
    expect(viewedAtLabel('어제', now)).toBe('')
  })
})
