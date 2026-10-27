import { describe, expect, it } from 'vitest'
import {
  filterPastAnswers,
  initialPastAnswersState,
  pastAnswersReducer,
  pastQuestionsLabel,
  showPastSearch,
  splitAnswers,
} from './pastAnswers'

const answers = (n: number) => Array.from({ length: n }, (_, i) => ({ questionId: n - i, question: `질문 ${n - i}` }))

describe('splitAnswers', () => {
  it('최신 순 답 21개면 가장 최근 1개만 펼치고 나머지 20개를 접는다', () => {
    const { recent, older } = splitAnswers(answers(21))
    expect(recent.map((a) => a.questionId)).toEqual([21])
    expect(older).toHaveLength(20)
    expect(older[0].questionId).toBe(20)
    expect(older.at(-1)?.questionId).toBe(1)
  })

  it('답이 1개 이하면 접을 답이 없다', () => {
    expect(splitAnswers(answers(1))).toEqual({ recent: answers(1), older: [] })
    expect(splitAnswers([])).toEqual({ recent: [], older: [] })
  })

  it('새 답이 맨 앞에 들어오면 펼친 답 중 가장 오래된 것이 목록 맨 위로 간다', () => {
    const before = splitAnswers(answers(4))
    const after = splitAnswers([{ questionId: 5, question: '새 질문' }, ...answers(4)])
    expect(after.recent[0].questionId).toBe(5)
    expect(after.older[0]).toEqual(before.recent.at(-1))
  })
})

describe('showPastSearch', () => {
  it('이전 질문이 6개 이상일 때만 질문 찾기를 둔다', () => {
    expect(showPastSearch(5)).toBe(false)
    expect(showPastSearch(6)).toBe(true)
    expect(showPastSearch(18)).toBe(true)
  })
})

describe('pastQuestionsLabel', () => {
  it('이전 질문 수를 적는다', () => {
    expect(pastQuestionsLabel(18)).toBe('이전 질문 18개')
  })
})

describe('filterPastAnswers', () => {
  const items = [
    { question: '매출액은 왜 늘었나요?' },
    { question: 'Risk 요인이 바뀌었나요?' },
    { question: '영업 이익은 얼마인가요?' },
  ]

  it('찾는 글이 비었거나 공백뿐이면 모두 둔다', () => {
    expect(filterPastAnswers(items, '')).toBe(items)
    expect(filterPastAnswers(items, '   ')).toBe(items)
  })

  it('공백과 대소문자를 무시하고 질문 문장 안에서 찾는다', () => {
    expect(filterPastAnswers(items, '매출 액')).toEqual([items[0]])
    expect(filterPastAnswers(items, '영업이익')).toEqual([items[2]])
    expect(filterPastAnswers(items, 'risk')).toEqual([items[1]])
  })

  it('맞는 질문이 없으면 빈 목록이다', () => {
    expect(filterPastAnswers(items, '배당')).toEqual([])
  })
})

describe('pastAnswersReducer', () => {
  it('누르면 펼치고 다시 누르면 접는다', () => {
    const opened = pastAnswersReducer(initialPastAnswersState, { type: 'toggle', questionId: 7 })
    expect(opened.openIds).toEqual([7])
    const both = pastAnswersReducer(opened, { type: 'toggle', questionId: 3 })
    expect(both.openIds).toEqual([7, 3])
    expect(pastAnswersReducer(both, { type: 'toggle', questionId: 7 }).openIds).toEqual([3])
  })

  it('찾는 글을 바꿔도 펼친 답은 그대로 둔다', () => {
    const opened = pastAnswersReducer(initialPastAnswersState, { type: 'toggle', questionId: 7 })
    expect(pastAnswersReducer(opened, { type: 'set-query', query: '매출' })).toEqual({ query: '매출', openIds: [7] })
  })
})
