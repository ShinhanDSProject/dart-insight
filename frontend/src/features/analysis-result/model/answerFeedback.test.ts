import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_REASONS,
  answerFeedbackReducer,
  feedbackStatusLabel,
  initialFeedbackState,
  nextFeedback,
} from './answerFeedback'

const helpful = { helpful: true, reason: null }
const notHelpful = { helpful: false, reason: null }
const wrongSource = { helpful: false, reason: 'WRONG_SOURCE' as const }

describe('nextFeedback', () => {
  it('평가가 없으면 누른 버튼대로 보낸다', () => {
    expect(nextFeedback(null, { kind: 'helpful' })).toEqual(helpful)
    expect(nextFeedback(null, { kind: 'not-helpful' })).toEqual(notHelpful)
  })

  it('이미 눌린 버튼을 다시 누르면 보내지 않는다', () => {
    expect(nextFeedback(helpful, { kind: 'helpful' })).toBeNull()
    expect(nextFeedback(wrongSource, { kind: 'not-helpful' })).toBeNull()
  })

  it('도움이 됐다에서 아니에요로 바꾸면 사유 없이 보낸다', () => {
    expect(nextFeedback(helpful, { kind: 'not-helpful' })).toEqual(notHelpful)
  })

  it('아니에요에서 도움이 됐어요로 바꾸면 사유를 지운다', () => {
    expect(nextFeedback(wrongSource, { kind: 'helpful' })).toEqual(helpful)
  })

  it('사유를 고르면 사유와 함께 보내고, 같은 사유를 다시 누르면 사유만 지운다', () => {
    expect(nextFeedback(notHelpful, { kind: 'reason', reason: 'WRONG_SOURCE' })).toEqual(wrongSource)
    expect(nextFeedback(wrongSource, { kind: 'reason', reason: 'OTHER' })).toEqual({ helpful: false, reason: 'OTHER' })
    expect(nextFeedback(wrongSource, { kind: 'reason', reason: 'WRONG_SOURCE' })).toEqual(notHelpful)
  })
})

describe('answerFeedbackReducer', () => {
  it('처음 상태는 기록의 평가를 보이고 저장된 것으로 본다', () => {
    expect(initialFeedbackState(wrongSource)).toEqual({
      shown: wrongSource,
      confirmed: wrongSource,
      seq: 0,
      save: { status: 'idle' },
    })
  })

  it('누르면 저장 전에 바로 보이고, 저장되면 고맙다는 안내를 보인다', () => {
    const saving = answerFeedbackReducer(initialFeedbackState(null), { type: 'choose', feedback: helpful, seq: 1 })
    expect(saving).toMatchObject({ shown: helpful, confirmed: null, save: { status: 'saving' } })

    const saved = answerFeedbackReducer(saving, { type: 'saved', feedback: helpful, seq: 1 })
    expect(saved).toMatchObject({ shown: helpful, confirmed: helpful, save: { status: 'saved' } })
  })

  it('저장에 실패하면 마지막으로 저장된 평가로 되돌린다', () => {
    const saving = answerFeedbackReducer(initialFeedbackState(helpful), { type: 'choose', feedback: notHelpful, seq: 1 })
    const failed = answerFeedbackReducer(saving, { type: 'fail', seq: 1 })
    expect(failed).toMatchObject({ shown: helpful, confirmed: helpful, save: { status: 'error' } })
  })

  it('앞 요청의 실패는 뒤에 보낸 평가를 되돌리지 않는다', () => {
    let state = answerFeedbackReducer(initialFeedbackState(null), { type: 'choose', feedback: notHelpful, seq: 1 })
    state = answerFeedbackReducer(state, { type: 'choose', feedback: wrongSource, seq: 2 })
    state = answerFeedbackReducer(state, { type: 'fail', seq: 1 })
    expect(state).toMatchObject({ shown: wrongSource, save: { status: 'saving' } })
  })

  it('앞 요청이 늦게 저장되면 저장된 값만 바꾸고 뒤 요청의 저장 중 상태는 그대로 둔다', () => {
    let state = answerFeedbackReducer(initialFeedbackState(null), { type: 'choose', feedback: notHelpful, seq: 1 })
    state = answerFeedbackReducer(state, { type: 'choose', feedback: wrongSource, seq: 2 })
    state = answerFeedbackReducer(state, { type: 'saved', feedback: notHelpful, seq: 1 })
    expect(state).toMatchObject({ shown: wrongSource, confirmed: notHelpful, save: { status: 'saving' } })
  })

  it('뒤 요청이 실패해 되돌린 뒤 앞 요청이 저장되면 그 값을 보인다', () => {
    let state = answerFeedbackReducer(initialFeedbackState(null), { type: 'choose', feedback: notHelpful, seq: 1 })
    state = answerFeedbackReducer(state, { type: 'choose', feedback: wrongSource, seq: 2 })
    state = answerFeedbackReducer(state, { type: 'fail', seq: 2 })
    expect(state.shown).toBeNull()
    state = answerFeedbackReducer(state, { type: 'saved', feedback: notHelpful, seq: 1 })
    expect(state).toMatchObject({ shown: notHelpful, confirmed: notHelpful })
  })
})

describe('feedbackStatusLabel', () => {
  it('저장되면 고맙다고, 실패하면 저장하지 못했다고 하고 그 밖에는 비운다', () => {
    expect(feedbackStatusLabel({ status: 'saved' })).toBe('의견 고마워요')
    expect(feedbackStatusLabel({ status: 'error' })).toBe('저장하지 못했어요. 다시 눌러 주세요.')
    expect(feedbackStatusLabel({ status: 'idle' })).toBe('')
    expect(feedbackStatusLabel({ status: 'saving' })).toBe('')
  })
})

describe('FEEDBACK_REASONS', () => {
  it('사유 네 가지를 API 값과 한국어 이름으로 둔다', () => {
    expect(FEEDBACK_REASONS.map((r) => r.reason)).toEqual(['WRONG_SOURCE', 'NOT_ANSWERED', 'HARD_TO_READ', 'OTHER'])
    expect(FEEDBACK_REASONS.map((r) => r.label)).toEqual([
      '근거가 안 맞아요',
      '질문에 답하지 않았어요',
      '이해하기 어려워요',
      '기타',
    ])
  })
})
