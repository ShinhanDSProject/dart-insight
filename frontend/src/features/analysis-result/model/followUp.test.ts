import { describe, expect, it } from 'vitest'
import type { QuestionAnswer, QuestionCitation, QuestionFact } from '@/shared/api/questions'
import { RISK_QUESTION } from './askQuestion'
import { accountFollowUp, followUpQuestions } from './followUp'

const citation = (sectionPath: string) => ({ no: 1, sectionPath }) as QuestionCitation
const fact = (accountName: string) => ({ ref: 'F1', accountName }) as QuestionFact

const answer = (over: Partial<QuestionAnswer> = {}) =>
  ({
    questionId: 1,
    question: '매출액은 왜 늘었나요?',
    status: 'ANSWERED',
    answer: '늘었어요[1][F1].',
    message: null,
    citations: [citation('II. 사업의 내용 > 1. 사업의 개요')],
    facts: [fact('영업이익')],
    ai: null,
    createdAt: '2026-10-24T10:12:00',
    ...over,
  }) as QuestionAnswer

const suggestions = ['매출액은 왜 늘었나요?', "'II. 사업의 내용'에서 무엇이 바뀌었나요?", RISK_QUESTION, '영업이익은 왜 줄었나요?']

describe('followUpQuestions', () => {
  it('답이면 첫 인용의 최상위 섹션과 첫 수치의 계정으로 질문 2개를 만든다', () => {
    expect(followUpQuestions(answer(), { suggestions: [], asked: [] })).toEqual([
      "'II. 사업의 내용'에서 무엇이 바뀌었나요?",
      '영업이익의 변화를 공시에서 어떻게 설명하나요?',
    ])
  })

  it('섹션 제목은 화면에 보이는 꼴로 바꾸고, 목차 밖 본문은 질문으로 만들지 않는다', () => {
    expect(followUpQuestions(answer({ citations: [citation('반 기 보 고 서 > 1. 개요')], facts: [] }), { suggestions: [], asked: [] })).toEqual([
      "'반기보고서'에서 무엇이 바뀌었나요?",
    ])
    expect(followUpQuestions(answer({ citations: [citation('(목차 밖 본문)')], facts: [] }), { suggestions: [], asked: [] })).toEqual([])
  })

  it('답에서 만든 질문이 모자라면 아직 묻지 않은 예시 질문으로 채운다', () => {
    expect(followUpQuestions(answer({ citations: [] }), { suggestions, asked: [] })).toEqual([
      '영업이익의 변화를 공시에서 어떻게 설명하나요?',
      "'II. 사업의 내용'에서 무엇이 바뀌었나요?",
    ])
  })

  it('이미 물은 질문은 앞뒤 공백을 빼고 견줘 빼고, 같은 질문은 한 번만 둔다', () => {
    const asked = ["  'II. 사업의 내용'에서 무엇이 바뀌었나요? "]
    expect(followUpQuestions(answer(), { suggestions: [...suggestions, RISK_QUESTION], asked })).toEqual([
      '영업이익의 변화를 공시에서 어떻게 설명하나요?',
      RISK_QUESTION,
    ])
  })

  it('찾지 못한 답이면 이 질문과 이미 물은 질문을 뺀 예시 질문 2개를 준다', () => {
    const notFound = answer({ status: 'NOT_FOUND', answer: null, citations: [], facts: [] })
    expect(followUpQuestions(notFound, { suggestions, asked: [RISK_QUESTION] })).toEqual([
      "'II. 사업의 내용'에서 무엇이 바뀌었나요?",
      '영업이익은 왜 줄었나요?',
    ])
  })

  it('답하지 않는 질문·검토 필요면 예시 질문 1개만 준다', () => {
    for (const status of ['OUT_OF_SCOPE', 'REVIEW_NEEDED'] as const) {
      expect(followUpQuestions(answer({ status, question: '주가가 오를까요?' }), { suggestions, asked: [] })).toEqual([
        '매출액은 왜 늘었나요?',
      ])
    }
  })

  it('남은 질문이 없으면 빈 목록이다', () => {
    const notFound = answer({ status: 'NOT_FOUND', citations: [], facts: [] })
    expect(followUpQuestions(notFound, { suggestions, asked: suggestions })).toEqual([])
  })

  it('보낼 수 없는 길이의 질문은 빼고 최대 2개만 준다', () => {
    const long = answer({ facts: [fact('가'.repeat(200))] })
    expect(followUpQuestions(long, { suggestions, asked: [] })).toEqual([
      "'II. 사업의 내용'에서 무엇이 바뀌었나요?",
      RISK_QUESTION,
    ])
  })
})

describe('accountFollowUp', () => {
  it('계정 이름 앞뒤 공백을 빼고 질문으로 만든다', () => {
    expect(accountFollowUp(' 매출원가 ')).toBe('매출원가의 변화를 공시에서 어떻게 설명하나요?')
  })
})
