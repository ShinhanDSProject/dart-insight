import { match } from 'ts-pattern'
import type { QuestionAnswer } from '@/shared/api/questions'
import { OUTSIDE_TOC, parseQuestion, sectionQuestion, topSectionOf } from './askQuestion'

/**
 * 답 뒤 '이어서 물어보기'(3.10, FS-13). AI가 아니라 코드가 답의 근거와 예시 질문으로 다음 질문을 만든다.
 * - ANSWERED: 첫 인용의 최상위 섹션, 첫 수치의 계정으로 하나씩. 모자라면 예시 질문으로 채운다
 * - NOT_FOUND: 아직 묻지 않은 예시 질문 2개
 * - OUT_OF_SCOPE·REVIEW_NEEDED: 아직 묻지 않은 예시 질문 1개
 * 이미 물은 질문(앞뒤 공백을 뺀 글이 같음)은 빼고, 같은 질문은 한 번만, 최대 2개.
 */

export const FOLLOW_UP_MAX = 2

export interface FollowUpContext {
  /** 이 분석의 예시 질문(askSuggestions 순서) */
  suggestions: string[]
  /** 이 화면에서 이미 물은 질문(기록·보내는 중 포함) */
  asked: string[]
}

export function accountFollowUp(accountName: string): string {
  return `${accountName.trim()}의 변화를 공시에서 어떻게 설명하나요?`
}

function answerFollowUps(answer: QuestionAnswer): string[] {
  const firstCitation = answer.citations.at(0)
  const top = firstCitation ? topSectionOf(firstCitation.sectionPath) : ''
  const section = top !== '' && top !== OUTSIDE_TOC ? sectionQuestion(top) : null
  const account = answer.facts.at(0)?.accountName.trim() ?? ''
  return [section, account !== '' ? accountFollowUp(account) : null].filter((q): q is string => q !== null)
}

export function followUpQuestions(answer: QuestionAnswer, context: FollowUpContext): string[] {
  const asked = new Set([answer.question, ...context.asked].map((q) => q.trim()))
  const pick = (candidates: string[], limit: number) => {
    const picked: string[] = []
    for (const raw of candidates) {
      const q = raw.trim()
      if (picked.length >= limit) break
      if (asked.has(q) || picked.includes(q) || parseQuestion(q).kind !== 'ready') continue
      picked.push(q)
    }
    return picked
  }

  return match(answer.status)
    .with('ANSWERED', () => pick([...answerFollowUps(answer), ...context.suggestions], FOLLOW_UP_MAX))
    .with('NOT_FOUND', () => pick(context.suggestions, FOLLOW_UP_MAX))
    .with('OUT_OF_SCOPE', 'REVIEW_NEEDED', () => pick(context.suggestions, 1))
    .exhaustive()
}
