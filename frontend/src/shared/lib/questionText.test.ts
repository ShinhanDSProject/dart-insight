import { describe, expect, it } from 'vitest'
import { draftMessage, parseQuestion, QUESTION_TOO_LONG, QUESTION_TOO_SHORT, questionCountLabel } from './questionText'

describe('질문 입력 규칙', () => {
  it('앞뒤 공백을 빼고 2~200자만 보낼 수 있다', () => {
    expect(parseQuestion('   ')).toEqual({ kind: 'empty' })
    expect(parseQuestion(' 가 ')).toEqual({ kind: 'too-short' })
    expect(parseQuestion('가'.repeat(201))).toEqual({ kind: 'too-long' })
    expect(parseQuestion(' 주요 제품은? ')).toEqual({ kind: 'ready', question: '주요 제품은?' })
  })

  it('긴 글은 입력하는 동안, 짧은 글은 보내려 했을 때만 안내한다', () => {
    expect(draftMessage('가'.repeat(201), false)).toBe(QUESTION_TOO_LONG)
    expect(draftMessage('가', false)).toBeNull()
    expect(draftMessage('가', true)).toBe(QUESTION_TOO_SHORT)
    expect(questionCountLabel('  주요  ')).toBe('2/200')
  })
})
