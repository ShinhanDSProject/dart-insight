import { describe, expect, it } from 'vitest'
import { SEARCH_MAX_LENGTH } from './textFilter'
import {
  accountQuestion,
  askedAtLabel,
  askSuggestions,
  citationSideLabel,
  draftMessage,
  QUESTION_TOO_LONG,
  QUESTION_TOO_SHORT,
  quoteLabel,
  parseQuestion,
  questionCountLabel,
  RISK_QUESTION,
  searchWordOf,
  textSearchLabel,
  sectionAskQuestion,
  sectionQuestion,
  topicParticle,
  topSectionOf,
} from './askQuestion'

describe('parseQuestion', () => {
  it('앞뒤 공백을 빼고 2~200자만 보낼 수 있다', () => {
    expect(parseQuestion('   ')).toEqual({ kind: 'empty' })
    expect(parseQuestion(' 매 ')).toEqual({ kind: 'too-short' })
    expect(parseQuestion(' 매출 ')).toEqual({ kind: 'ready', question: '매출' })
    expect(parseQuestion('가'.repeat(200))).toEqual({ kind: 'ready', question: '가'.repeat(200) })
    expect(parseQuestion('가'.repeat(201))).toEqual({ kind: 'too-long' })
  })

  it('글자 수는 앞뒤 공백을 빼고 센다', () => {
    expect(questionCountLabel('  매출액  ')).toBe('3/200')
  })
})

describe('topicParticle', () => {
  it('받침에 따라 은·는을 고른다', () => {
    expect(topicParticle('매출액')).toBe('은')
    expect(topicParticle('부채')).toBe('는')
    expect(topicParticle('EBITDA')).toBe('은(는)')
  })
})

describe('예시 질문', () => {
  it('계정 질문은 증감 방향에 맞춘다', () => {
    expect(accountQuestion({ accountName: '매출액', direction: 'UP' })).toBe('매출액은 왜 늘었나요?')
    expect(accountQuestion({ accountName: '부채', direction: 'DOWN' })).toBe('부채는 왜 줄었나요?')
    expect(accountQuestion({ accountName: '자본', direction: null })).toBe('자본은 어떻게 바뀌었나요?')
  })

  it('섹션 질문은 보이는 제목을 쓰고 길면 줄인다', () => {
    expect(sectionQuestion('II. 사업의 내용')).toBe("'II. 사업의 내용'에서 무엇이 바뀌었나요?")
    expect(sectionQuestion('가'.repeat(50))).toBe(`'${'가'.repeat(40)}…'에서 무엇이 바뀌었나요?`)
  })

  it('계정·섹션·위험 요인·둘째 계정 순으로 4개까지 만든다', () => {
    expect(
      askSuggestions({
        accounts: [
          { accountName: '매출액', direction: 'UP' },
          { accountName: '영업이익', direction: 'DOWN' },
          { accountName: '부채', direction: 'UP' },
        ],
        topSection: 'II. 사업의 내용',
      }),
    ).toEqual(['매출액은 왜 늘었나요?', "'II. 사업의 내용'에서 무엇이 바뀌었나요?", RISK_QUESTION, '영업이익은 왜 줄었나요?'])
  })

  it('자료가 없으면 위험 요인 질문만 남는다', () => {
    expect(askSuggestions({ accounts: [], topSection: null })).toEqual([RISK_QUESTION])
    expect(askSuggestions({ accounts: [{ accountName: ' ', direction: 'UP' }], topSection: '(목차 밖 본문)' })).toEqual([RISK_QUESTION])
  })

  it('같은 질문은 한 번만 둔다', () => {
    const same = { accountName: '매출액', direction: 'UP' } as const
    expect(askSuggestions({ accounts: [same, same], topSection: null })).toEqual(['매출액은 왜 늘었나요?', RISK_QUESTION])
  })

  it('경로에서 최상위 섹션을 꺼낸다', () => {
    expect(topSectionOf('II. 사업의 내용 > 1. 사업의 개요')).toBe('II. 사업의 내용')
  })
})

describe('searchWordOf', () => {
  it('조사·의문 낱말을 뺀 첫 낱말을 쓴다', () => {
    expect(searchWordOf('매출액은 왜 늘었나요?')).toBe('매출액')
    expect(searchWordOf(RISK_QUESTION)).toBe('위험')
    expect(searchWordOf('배당금 지급 계획이 바뀌었나요?')).toBe('배당금')
  })

  it('따옴표 안 글이 있으면 그것을 쓴다', () => {
    expect(searchWordOf("'II. 사업의 내용'에서 무엇이 바뀌었나요?")).toBe('II. 사업의 내용')
  })

  it('쓸 낱말이 없으면 null이다', () => {
    expect(searchWordOf('왜 그런가요?')).toBeNull()
  })

  it('찾지 못한 질문의 첫 핵심어를 검색 버튼 문구에 넣는다', () => {
    const word = searchWordOf('우주 탐사 계획은 어떻게 바뀌었나요?')
    expect(word).toBe('우주')
    expect(textSearchLabel(word ?? '')).toBe("문장·내용 변화에서 '우주' 찾기")
  })

  it('검색어는 검색 최대 길이를 넘지 않는다', () => {
    expect(searchWordOf(`'${'가'.repeat(150)}'에서 무엇이 바뀌었나요?`)).toHaveLength(SEARCH_MAX_LENGTH)
  })
})

describe('입력·표시 문구', () => {
  it('긴 글은 바로, 짧은 글은 보내려 했을 때만 안내한다', () => {
    expect(draftMessage('가'.repeat(201), false)).toBe(QUESTION_TOO_LONG)
    expect(draftMessage('가', false)).toBeNull()
    expect(draftMessage('가', true)).toBe(QUESTION_TOO_SHORT)
    expect(draftMessage('', true)).toBe(QUESTION_TOO_SHORT)
    expect(draftMessage('매출', true)).toBeNull()
  })

  it('질문 시각을 분까지 보인다', () => {
    expect(askedAtLabel('2026-10-24T10:12:03')).toBe('2026-10-24 10:12')
  })

  it('인용 보고서를 비교·현재로 보인다', () => {
    expect(citationSideLabel('current')).toBe('현재')
    expect(citationSideLabel('previous')).toBe('비교')
  })

  it('160자로 잘린 인용에만 말줄임표를 붙인다', () => {
    expect(quoteLabel('짧은 문단')).toBe('짧은 문단')
    expect(quoteLabel('가'.repeat(160))).toBe(`${'가'.repeat(160)}…`)
    expect(quoteLabel(`${'가'.repeat(159)}…`)).toBe(`${'가'.repeat(159)}…`)
  })
})

describe('sectionAskQuestion', () => {
  it('고른 섹션이 있으면 예시 질문과 같은 꼴의 질문을 만든다', () => {
    expect(sectionAskQuestion('XI. 그 밖에 투자자 보호를 위하여 필요한 사항')).toBe(
      sectionQuestion('XI. 그 밖에 투자자 보호를 위하여 필요한 사항'),
    )
    expect(sectionAskQuestion('II. 사업의 내용')).toBe("'II. 사업의 내용'에서 무엇이 바뀌었나요?")
  })

  it('섹션을 고르지 않았으면 질문을 만들지 않는다', () => {
    expect(sectionAskQuestion(null)).toBeNull()
    expect(sectionAskQuestion('  ')).toBeNull()
  })

  it('목차 밖 본문은 질문을 만들지 않는다', () => {
    expect(sectionAskQuestion('(목차 밖 본문)')).toBeNull()
    expect(sectionAskQuestion(' (목차 밖 본문) ')).toBeNull()
  })

  it('겹친 경로는 마지막 제목으로 묻는다', () => {
    expect(sectionAskQuestion('II. 사업의 내용 > 1. 사업의 개요')).toBe("'1. 사업의 개요'에서 무엇이 바뀌었나요?")
  })
})
