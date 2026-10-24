import { describe, expect, it } from 'vitest'
import type { QuestionAnswer } from '@/shared/api/questions'
import { askReducer, initialAskState, type AskState } from './askState'

const answer = (questionId: number, question = `질문 ${questionId}`) => ({ questionId, question }) as QuestionAnswer

const typed = askReducer(initialAskState, { type: 'set-draft', draft: '매출액은 왜 늘었나요?' })
const sendingDraft = askReducer(typed, { type: 'send', question: '매출액은 왜 늘었나요?', fromDraft: true })

describe('askReducer', () => {
  it('입력하면 글을 바꾸고 짧다는 안내를 지운다', () => {
    const rejected = askReducer(initialAskState, { type: 'reject-draft' })
    expect(rejected.draftRejected).toBe(true)
    expect(askReducer(rejected, { type: 'set-draft', draft: '매출' })).toMatchObject({ draft: '매출', draftRejected: false })
  })

  it('보내면 보내는 중이 되고, 보내는 중에는 다른 질문을 받지 않는다', () => {
    expect(sendingDraft.request).toEqual({ status: 'sending', question: '매출액은 왜 늘었나요?', fromDraft: true })
    expect(askReducer(sendingDraft, { type: 'send', question: '다른 질문', fromDraft: false })).toBe(sendingDraft)
  })

  it('입력창 글의 답이 오면 맨 앞에 두고 입력창을 비운다', () => {
    const before: AskState = { ...sendingDraft, items: [answer(1)] }
    expect(askReducer(before, { type: 'answer', answer: answer(2) })).toEqual({
      draft: '',
      draftRejected: false,
      request: { status: 'idle' },
      items: [answer(2), answer(1)],
      lastAnsweredId: 2,
    })
  })

  it('예시 질문의 답이 오면 입력창 글은 그대로 둔다', () => {
    const sending = askReducer(typed, { type: 'send', question: '새로 생긴 위험 요인이 있나요?', fromDraft: false })
    expect(askReducer(sending, { type: 'answer', answer: answer(3) }).draft).toBe('매출액은 왜 늘었나요?')
  })

  it('실패하면 질문과 오류를 남기고 입력창 글은 지우지 않는다', () => {
    const failed = askReducer(sendingDraft, { type: 'fail', error: 'x' })
    expect(failed.request).toEqual({ status: 'error', question: '매출액은 왜 늘었나요?', fromDraft: true, error: 'x' })
    expect(failed.draft).toBe('매출액은 왜 늘었나요?')
  })

  it('실패한 뒤 다시 보낼 수 있다', () => {
    const failed = askReducer(sendingDraft, { type: 'fail', error: 'x' })
    expect(askReducer(failed, { type: 'send', question: '매출액은 왜 늘었나요?', fromDraft: true }).request.status).toBe('sending')
  })

  it('보내는 중이 아닐 때 온 답·오류는 버린다', () => {
    expect(askReducer(typed, { type: 'answer', answer: answer(1) })).toBe(typed)
    expect(askReducer(typed, { type: 'fail', error: 'x' })).toBe(typed)
  })

  it('기록은 이 화면에서 받은 답 뒤에 붙이고 같은 질문은 한 번만 둔다', () => {
    const answered = askReducer(sendingDraft, { type: 'answer', answer: answer(9) })
    const merged = askReducer(answered, { type: 'history', items: [answer(9), answer(8), answer(7)] })
    expect(merged.items.map((i) => i.questionId)).toEqual([9, 8, 7])
  })

  it('저장한 답 평가는 그 질문에만 적는다', () => {
    const before: AskState = { ...initialAskState, items: [answer(1), answer(2)] }
    const after = askReducer(before, { type: 'set-feedback', questionId: 2, feedback: { helpful: false, reason: 'OTHER' } })
    expect(after.items[1].feedback).toEqual({ helpful: false, reason: 'OTHER' })
    expect(after.items[0]).toBe(before.items[0])
  })
})
