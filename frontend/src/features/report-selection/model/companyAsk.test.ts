import { describe, expect, it } from 'vitest'
import type { CompanyQuestionAnswer } from '@/shared/api/companyQuestions'
import {
  citationLocation,
  COMPANY_ASK_EXAMPLES,
  companyAskReducer,
  initialCompanyAskState,
  unansweredTitle,
} from './companyAsk'

const RCEPT = '20260310000123'

function answer(questionId: number, overrides: Partial<CompanyQuestionAnswer> = {}): CompanyQuestionAnswer {
  return {
    questionId,
    question: '주요 제품은 무엇인가요?',
    status: 'ANSWERED',
    answer: '스마트폰을 주요 제품으로 밝혔어요[1].',
    message: null,
    citations: [],
    report: { rceptNo: RCEPT, reportName: '사업보고서 (2025.12)', dartUrl: 'https://dart.fss.or.kr' },
    aiGenerated: true,
    ai: { model: 'fake-model', promptVersion: 'answer-2', generatedAt: '2026-10-26T10:12:03' },
    createdAt: '2026-10-26T10:12:03',
    ...overrides,
  }
}

describe('기업 질문 상태', () => {
  it('예시 질문은 3개이고 모두 질문 길이 규칙을 지킨다', () => {
    expect(COMPANY_ASK_EXAMPLES).toHaveLength(3)
    for (const q of COMPANY_ASK_EXAMPLES) expect(q.length).toBeGreaterThanOrEqual(2)
  })

  it('입력창 글을 보내 답이 오면 입력창을 비우고 답을 맨 앞에 둔다', () => {
    const typed = companyAskReducer(initialCompanyAskState, { type: 'set-draft', draft: '주요 제품은?' })
    const sending = companyAskReducer(typed, { type: 'send', question: '주요 제품은?', fromDraft: true })
    expect(sending.request.status).toBe('sending')

    const done = companyAskReducer(sending, { type: 'answer', answer: answer(7) })
    expect(done.draft).toBe('')
    expect(done.request.status).toBe('idle')
    expect(done.items.map((i) => i.questionId)).toEqual([7])
    expect(done.lastAnsweredId).toBe(7)
  })

  it('예시 질문의 답이 와도 입력 중인 글은 남긴다', () => {
    const typed = companyAskReducer(initialCompanyAskState, { type: 'set-draft', draft: '쓰는 중' })
    const sending = companyAskReducer(typed, { type: 'send', question: COMPANY_ASK_EXAMPLES[0], fromDraft: false })
    expect(companyAskReducer(sending, { type: 'answer', answer: answer(1) }).draft).toBe('쓰는 중')
  })

  it('보내는 중에는 다른 질문을 받지 않고, 실패하면 질문을 남겨 다시 보낼 수 있다', () => {
    const sending = companyAskReducer(initialCompanyAskState, { type: 'send', question: '첫 질문', fromDraft: false })
    expect(companyAskReducer(sending, { type: 'send', question: '둘째', fromDraft: false })).toBe(sending)

    const failed = companyAskReducer(sending, { type: 'fail', error: new Error('x') })
    expect(failed.request).toMatchObject({ status: 'error', question: '첫 질문' })
  })

  it('기록은 이 화면에서 받은 답 뒤에 붙이고 같은 질문은 한 번만 둔다', () => {
    const sending = companyAskReducer(initialCompanyAskState, { type: 'send', question: 'q', fromDraft: false })
    const answered = companyAskReducer(sending, { type: 'answer', answer: answer(3) })
    const merged = companyAskReducer(answered, { type: 'history', items: [answer(3), answer(2)] })
    expect(merged.items.map((i) => i.questionId)).toEqual([3, 2])
  })

  it('짧은 글을 보내려 하면 안내하고, 글을 고치면 안내를 지운다', () => {
    const rejected = companyAskReducer(initialCompanyAskState, { type: 'reject-draft' })
    expect(rejected.draftRejected).toBe(true)
    expect(companyAskReducer(rejected, { type: 'set-draft', draft: '주요' }).draftRejected).toBe(false)
  })
})

describe('인용 위치와 안내 제목', () => {
  it('섹션 경로와 블록 번호를 보이고, 위치를 모르면 위치 확인 안 됨', () => {
    expect(
      citationLocation({
        no: 1,
        evidenceId: `${RCEPT}#B130`,
        rceptNo: RCEPT,
        sectionNo: 13,
        blockNo: 130,
        sectionPath: 'II. 사업의 내용 > 2. 주요 제품 및 서비스',
        quote: '…',
      }),
    ).toMatch(/· 블록 130$/)
    expect(
      citationLocation({ no: 1, evidenceId: 'x', rceptNo: RCEPT, sectionNo: null, blockNo: null, sectionPath: null, quote: null }),
    ).toBe('위치 확인 안 됨')
  })

  it('답이 없는 상태마다 안내 제목이 있고 답이 있으면 없다', () => {
    expect(unansweredTitle(answer(1))).toBeNull()
    expect(unansweredTitle(answer(1, { status: 'NOT_FOUND' }))).toBe('관련 내용을 찾지 못했어요')
    expect(unansweredTitle(answer(1, { status: 'OUT_OF_SCOPE' }))).toBe('답하지 않는 질문이에요')
    expect(unansweredTitle(answer(1, { status: 'REVIEW_NEEDED' }))).toBe('검토 필요')
  })
})
