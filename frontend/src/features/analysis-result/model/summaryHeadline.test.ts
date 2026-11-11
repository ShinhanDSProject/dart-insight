import { describe, expect, it } from 'vitest'
import type { SummaryItem } from '@/shared/api/summary'
import type { GlossaryTerm } from '@/shared/api/glossaryTerms'
import { glossaryForAccount, headlineItems, headlineTitle } from './summaryHeadline'

const CARDS: GlossaryTerm[] = [
  {
    key: 'operatingMargin',
    level: 'CORE',
    term: '영업이익률',
    aliases: [],
    definition: '매출 중 본업으로 남긴 돈의 비율이에요.',
    example: null,
    whereToCheck: null,
    noJudgment: null,
    related: [],
    sources: [{ title: '공식 자료', url: 'https://example.test' }],
    reviewedAt: '2026-11-10',
  },
]

function financial(itemNo: number, factSentence: string | null, aiText: string | null = null): SummaryItem {
  return {
    itemNo,
    kind: 'FINANCIAL',
    target: { type: 'FINANCIAL', changeId: itemNo * 10, sjDiv: 'IS', changeType: null },
    lens: 'PROFITABILITY',
    lensLabel: '수익성',
    factSentence,
    aiText,
    aiGenerated: aiText !== null,
    explanationStatus: aiText === null ? 'NOT_FOUND' : 'FOUND',
    explanationGrade: null,
    quote: null,
    quoteEvidence: null,
    gradeReason: null,
    evidence: [],
    ai: null,
  }
}

function text(itemNo: number, aiText: string | null): SummaryItem {
  return {
    itemNo,
    kind: 'TEXT',
    target: { type: 'TEXT', changeId: itemNo * 10, sjDiv: null, changeType: null },
    lens: 'OTHER',
    lensLabel: '기타',
    factSentence: null,
    aiText,
    aiGenerated: aiText !== null,
    explanationStatus: null,
    explanationGrade: null,
    quote: null,
    quoteEvidence: null,
    gradeReason: null,
    evidence: [],
    ai: null,
  }
}

describe('headlineItems', () => {
  it('재무 사실 문장 상위 2개와 문장 변화 AI 요약 1개를 이 순서로 고른다', () => {
    const lines = headlineItems({
      items: [
        text(1, '새 공장 투자 계획이 추가됐어요.'),
        financial(2, '매출액이 10.0% 늘었어요.'),
        financial(3, '영업이익이 5.0% 줄었어요.'),
        financial(4, '자산총계가 늘었어요.'),
        text(5, '위험 요인 문단이 바뀌었어요.'),
      ],
    })
    expect(lines.map((l) => [l.kind, l.itemNo, l.text])).toEqual([
      ['FINANCIAL', 2, '매출액이 10.0% 늘었어요.'],
      ['FINANCIAL', 3, '영업이익이 5.0% 줄었어요.'],
      ['TEXT', 1, '새 공장 투자 계획이 추가됐어요.'],
    ])
  })

  it("재무 줄은 AI 설명이 있어도 사실 문장을 쓰고 'AI 생성'으로 표시하지 않는다", () => {
    const [line] = headlineItems({ items: [financial(1, '매출액이 10.0% 늘었어요.', '반도체 판매가 늘었어요.')] })
    expect(line.text).toBe('매출액이 10.0% 늘었어요.')
    expect(line.aiGenerated).toBe(false)
    expect(line.target).toEqual({ type: 'FINANCIAL', changeId: 10, sjDiv: 'IS', changeType: null })
  })

  it("문장 줄은 AI 요약을 쓰고 'AI 생성'으로 표시하며 그 변경을 가리킨다", () => {
    const [line] = headlineItems({ items: [text(1, '새 공장 투자 계획이 추가됐어요.')] })
    expect(line.text).toBe('새 공장 투자 계획이 추가됐어요.')
    expect(line.aiGenerated).toBe(true)
    expect(line.target).toEqual({ type: 'TEXT', changeId: 10, sjDiv: null, changeType: null })
  })

  it('항목이 부족하면 있는 만큼만 고른다', () => {
    expect(headlineItems({ items: [financial(1, '매출액이 늘었어요.')] }).map((l) => l.itemNo)).toEqual([1])
    expect(headlineItems({ items: [text(1, '문장이 바뀌었어요.'), text(2, '다른 문장도 바뀌었어요.')] }).map((l) => l.itemNo)).toEqual([1])
  })

  it('사실 문장이나 AI 요약이 비어 있는 항목은 건너뛰고 다음 항목을 고른다', () => {
    const lines = headlineItems({
      items: [financial(1, null), financial(2, '  '), financial(3, '매출액이 늘었어요.'), text(4, null), text(5, '문장이 바뀌었어요.')],
    })
    expect(lines.map((l) => l.itemNo)).toEqual([3, 5])
  })

  it('요약 항목이 없으면(검토 필요만 있어도) 빈 목록이다', () => {
    expect(headlineItems({ items: [] })).toEqual([])
  })
})

describe('핵심 카드 제목과 용어 풀이', () => {
  it('제목에 고른 줄 수를 쓴다', () => {
    expect(headlineTitle(3)).toBe('이번 비교에서 크게 바뀐 것 3가지')
  })

  it('이름·별칭이 같은 용어 카드만 찾고(공백 무시), 없거나 카드를 못 받았으면 지어내지 않고 null', () => {
    expect(glossaryForAccount(CARDS, '영업 이익률')?.term).toBe('영업이익률')
    expect(glossaryForAccount(CARDS, '당기손익-공정가치 측정 금융자산관련순손익')).toBeNull()
    expect(glossaryForAccount(null, '영업이익률')).toBeNull()
  })
})
