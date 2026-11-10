import { describe, expect, it } from 'vitest'
import { readResultTourSeen, RESULT_TOUR_SEEN_KEY, RESULT_TOUR_STEPS, resultTourSeen, saveResultTourSeen, type ResultTourStorage } from './resultTour'

function memoryStorage(): ResultTourStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {}
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

const broken: ResultTourStorage = {
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

describe('결과 화면 둘러보기 기억', () => {
  it('보면 1을 남기고 다시 보기면 지운다', () => {
    const storage = memoryStorage()
    expect(readResultTourSeen(storage)).toBe(false)
    saveResultTourSeen(storage, true)
    expect(storage.data[RESULT_TOUR_SEEN_KEY]).toBe('1')
    expect(readResultTourSeen(storage)).toBe(true)
    saveResultTourSeen(storage, false)
    expect(readResultTourSeen(storage)).toBe(false)
  })

  it('저장소가 없거나 막혀 있으면 모른다(null)고 읽고, 저장 실패는 조용히 넘어간다', () => {
    expect(readResultTourSeen(null)).toBeNull()
    expect(readResultTourSeen(broken)).toBeNull()
    expect(() => saveResultTourSeen(broken, true)).not.toThrow()
  })

  it('이번 방문에 정한 값을 저장된 값보다 먼저 쓴다(쓰기만 실패해 저장값이 그대로여도 닫고 연다)', () => {
    expect(resultTourSeen(true, false)).toBe(true)
    expect(resultTourSeen(false, true)).toBe(false)
    expect(resultTourSeen(null, true)).toBe(true)
    expect(resultTourSeen(null, null)).toBe(false)
  })

  it('요약 → 문장 변화 → AI 에이전트 순서다', () => {
    expect(RESULT_TOUR_STEPS.map((step) => step.tab)).toEqual(['summary', 'activity', null])
  })
})
