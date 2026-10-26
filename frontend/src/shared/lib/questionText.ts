import { match, P } from 'ts-pattern'

/**
 * AI 질문 입력의 공통 규칙(분석 질문 3.10, 기업 질문 FS-53). 길이는 docs/api-spec.md POST …/questions의 question과 같다.
 * 두 기능이 함께 쓰므로 shared에 둔다(DIR-4).
 */

export const QUESTION_MIN_LENGTH = 2
export const QUESTION_MAX_LENGTH = 200

export const QUESTION_TOO_SHORT = `${QUESTION_MIN_LENGTH}자 이상 입력해 주세요.`
export const QUESTION_TOO_LONG = `${QUESTION_MAX_LENGTH}자 이내로 줄여 주세요.`

/** 입력창 글의 상태. ready일 때만 보낸다 */
export type QuestionInput =
  | { kind: 'empty' }
  | { kind: 'too-short' }
  | { kind: 'too-long' }
  | { kind: 'ready'; question: string }

export function parseQuestion(input: string): QuestionInput {
  const question = input.trim()
  if (question.length === 0) return { kind: 'empty' }
  if (question.length < QUESTION_MIN_LENGTH) return { kind: 'too-short' }
  if (question.length > QUESTION_MAX_LENGTH) return { kind: 'too-long' }
  return { kind: 'ready', question }
}

/** 글자 수 표시(예: 12/200). 앞뒤 공백은 세지 않는다(서버와 같음) */
export function questionCountLabel(input: string): string {
  return `${input.trim().length}/${QUESTION_MAX_LENGTH}`
}

/** 입력창 아래 안내. 긴 글은 입력하는 동안, 짧은 글은 보내려 했을 때만 보인다. 문제없으면 null */
export function draftMessage(draft: string, rejected: boolean): string | null {
  return match(parseQuestion(draft))
    .with({ kind: 'too-long' }, () => QUESTION_TOO_LONG)
    .with({ kind: P.union('empty', 'too-short') }, () => (rejected ? QUESTION_TOO_SHORT : null))
    .with({ kind: 'ready' }, () => null)
    .exhaustive()
}

/** 질문한 시각(예: 2026-10-24 10:12). 서버 값은 한국 시간 */
export function askedAtLabel(createdAt: string): string {
  return createdAt.replace('T', ' ').slice(0, 16)
}

const QUOTE_MAX_LENGTH = 160

/** 인용 일부. 서버가 문단 앞 160자로 자른 것이면 말줄임표를 붙인다 */
export function quoteLabel(quote: string): string {
  const trimmed = quote.trim()
  return trimmed.length >= QUOTE_MAX_LENGTH && !trimmed.endsWith('…') ? `${trimmed}…` : trimmed
}
