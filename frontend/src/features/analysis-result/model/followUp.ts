import { match } from 'ts-pattern'
import type { QuestionAnswer, QuestionStatus } from '@/shared/api/questions'
import { isAskableSection, parseQuestion, sectionQuestion, topSectionOf } from './askQuestion'

/**
 * 답 뒤 '이어서 물어보기'(3.10, FS-13). AI가 아니라 코드가 답의 근거와 예시 질문으로 다음 질문을 만든다.
 * - ANSWERED: 첫 인용의 최상위 섹션, 첫 수치의 계정으로 하나씩. 모자라면 예시 질문으로 채운다
 * - NOT_FOUND·OUT_OF_SCOPE: 이 분석에서 답할 수 있는 질문 최대 3개(#284). 아직 묻지 않은 예시 질문, 모자라면 섹션 질문(FS-25)
 * - REVIEW_NEEDED: 아직 묻지 않은 예시 질문 1개
 * 이미 물은 질문(앞뒤 공백을 뺀 글이 같음)은 빼고, 같은 질문은 한 번만.
 */

export const FOLLOW_UP_MAX = 2
/** 답을 못 했을 때 다음 행동으로 두는 질문 수(#284) */
export const NEXT_STEP_MAX = 3

export interface FollowUpContext {
  /** 이 분석의 예시 질문(askSuggestions 순서) */
  suggestions: string[]
  /** 이 화면에서 이미 물은 질문(기록·보내는 중 포함) */
  asked: string[]
  /** 이 분석의 최상위 섹션 제목(문장 변화 탭의 섹션 선택과 같은 출처). 없으면 빈 목록 */
  sections?: string[]
}

export function accountFollowUp(accountName: string): string {
  return `${accountName.trim()}의 변화를 공시에서 어떻게 설명하나요?`
}

function answerFollowUps(answer: QuestionAnswer): string[] {
  const firstCitation = answer.citations.at(0)
  const top = firstCitation ? topSectionOf(firstCitation.sectionPath) : ''
  const section = isAskableSection(top) ? sectionQuestion(top) : null
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

  const sectionQuestions = (context.sections ?? [])
    .map((title) => title.trim())
    .filter(isAskableSection)
    .map(sectionQuestion)

  return match(answer.status)
    .with('ANSWERED', () => pick([...answerFollowUps(answer), ...context.suggestions], FOLLOW_UP_MAX))
    .with('NOT_FOUND', 'OUT_OF_SCOPE', () => pick([...context.suggestions, ...sectionQuestions], NEXT_STEP_MAX))
    .with('REVIEW_NEEDED', () => pick(context.suggestions, 1))
    .exhaustive()
}

/** 다음 질문 줄의 제목. 답을 못 찾았으면 이 분석에서 답할 수 있는 질문으로, 투자 판단 질문이면 공시 사실 질문으로 이끈다(#284) */
export function followUpLabel(status: QuestionStatus): string {
  return match(status)
    .with('ANSWERED', 'REVIEW_NEEDED', () => '이어서 물어보기')
    .with('NOT_FOUND', () => '이 분석에서 물어볼 수 있는 질문')
    .with('OUT_OF_SCOPE', () => '공시 사실로 물어보기')
    .exhaustive()
}
