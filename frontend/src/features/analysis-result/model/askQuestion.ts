import { match, P } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { FinancialChangeItem } from '@/shared/api/results'
import { displaySectionTitle } from '@/shared/lib/sectionTitle'
import { SEARCH_MAX_LENGTH, searchQueryOf } from './textFilter'

/** AI 질문(3.10, FS-5) 화면 문구와 순수 함수. 길이는 docs/api-spec.md POST questions의 question과 같다 */

export const QUESTION_MIN_LENGTH = 2
export const QUESTION_MAX_LENGTH = 200

export const ASK_INTRO = '두 보고서 원문에서 찾은 문단과 계산한 수치로만 답해요. 투자 판단·주가 예측 질문에는 답하지 않아요.'
export const QUESTION_TOO_SHORT = `${QUESTION_MIN_LENGTH}자 이상 입력해 주세요.`
export const QUESTION_TOO_LONG = `${QUESTION_MAX_LENGTH}자 이내로 줄여 주세요.`
export const RISK_QUESTION = '새로 생긴 위험 요인이 있나요?'

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

/** 마지막 글자에 받침이 있으면 '은', 없으면 '는'. 한글이 아니면 '은(는)' */
export function topicParticle(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '은(는)'
  return (code - 0xac00) % 28 === 0 ? '는' : '은'
}

/** 예시 질문을 만들 계정(요약 순서). 증감 방향은 코드가 계산한 값 */
export type SuggestionAccount = Pick<FinancialChangeItem, 'accountName' | 'direction'>

export interface SuggestionSource {
  accounts: SuggestionAccount[]
  /** 중요도가 가장 높은 문장 변경의 최상위 섹션 제목. 없으면 null */
  topSection: string | null
}

export const SUGGESTION_COUNT = 4
const SECTION_TITLE_MAX = 40
/** 파서가 붙인 목차 밖 본문은 질문으로 만들지 않는다 */
export const OUTSIDE_TOC = '(목차 밖 본문)'

export function accountQuestion(account: SuggestionAccount): string {
  const name = account.accountName.trim()
  const verb = match(account.direction)
    .with('UP', () => '왜 늘었나요?')
    .with('DOWN', () => '왜 줄었나요?')
    .with(P.union('SAME', null), () => '어떻게 바뀌었나요?')
    .exhaustive()
  return `${name}${topicParticle(name)} ${verb}`
}

export function sectionQuestion(title: string): string {
  const shown = displaySectionTitle(title).trim()
  const short = shown.length > SECTION_TITLE_MAX ? `${shown.slice(0, SECTION_TITLE_MAX)}…` : shown
  return `'${short}'에서 무엇이 바뀌었나요?`
}

/**
 * 예시 질문(최대 4개). 요약의 첫 계정 → 중요한 문장 변경의 섹션 → 새 위험 요인(늘 있음) → 둘째 계정 순이라,
 * 앞의 3개만 써도 수치·문장·위험이 고루 들어간다. 같은 질문은 한 번만 둔다.
 */
export function askSuggestions(source: SuggestionSource): string[] {
  const accounts = source.accounts.filter((a) => a.accountName.trim().length > 0).map(accountQuestion)
  const section =
    source.topSection !== null && source.topSection.trim() !== '' && source.topSection.trim() !== OUTSIDE_TOC
      ? sectionQuestion(source.topSection)
      : null
  const ordered = [accounts[0], section, RISK_QUESTION, ...accounts.slice(1)]
  const unique = [...new Set(ordered.filter((q): q is string => q !== undefined && q !== null))]
  return unique.filter((q) => parseQuestion(q).kind === 'ready').slice(0, SUGGESTION_COUNT)
}

/** 최상위 섹션 제목('II. 사업의 내용 > 1. 개요'의 앞부분) */
export function topSectionOf(sectionPath: string): string {
  return sectionPath.split(' > ')[0].trim()
}

const STOP_WORDS = new Set([
  '왜', '무엇', '무엇이', '무엇을', '뭐', '뭐가', '어떻게', '어떤', '얼마나', '언제', '어디', '누가', '새로', '생긴', '새로운',
  '있나요', '있어요', '없나요', '있는', '바뀐', '달라진', '이유', '내용이', '알려', '주세요', '대해', '대한', '관련',
])
const PARTICLES = ['에서는', '에서', '으로', '에는', '이란', '이라', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '만']
const QUESTION_ENDING = /(나요|까요|어요|아요|해요|가요|니까|죠|지요)$/

/**
 * 찾지 못한 질문을 문장 변화 검색(?tq=)으로 넘길 낱말. 따옴표 안 글이 있으면 그것을, 없으면 조사·의문 낱말을 뺀 첫 낱말을 쓴다.
 * 검색은 글 안에 들어 있는지를 보므로 낱말 하나만 넘긴다. 쓸 낱말이 없으면 null(검색 없이 연다)
 */
export function searchWordOf(question: string): string | null {
  const quoted = /['‘"“]([^'’"”]+)['’"”]/.exec(question)
  if (quoted) {
    const q = searchQueryOf(quoted[1].replace(/…$/, ''))
    if (q !== null) return q.slice(0, SEARCH_MAX_LENGTH)
  }
  for (const raw of question.split(/[\s?!.,·~()[\]{}'"‘’“”]+/)) {
    if (raw.length < 2 || STOP_WORDS.has(raw) || QUESTION_ENDING.test(raw)) continue
    const particle = PARTICLES.find((p) => raw.endsWith(p) && raw.length - p.length >= 2)
    const word = particle ? raw.slice(0, raw.length - particle.length) : raw
    if (word.length >= 2 && !STOP_WORDS.has(word)) return searchQueryOf(word)
  }
  return null
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

/** 인용 원문이 어느 보고서인지 */
export function citationSideLabel(side: DocumentSide): string {
  return match(side)
    .with('current', () => '현재')
    .with('previous', () => '비교')
    .exhaustive()
}

const QUOTE_MAX_LENGTH = 160

/** 인용 일부. 서버가 문단 앞 160자로 자른 것이면 말줄임표를 붙인다 */
export function quoteLabel(quote: string): string {
  const trimmed = quote.trim()
  return trimmed.length >= QUOTE_MAX_LENGTH && !trimmed.endsWith('…') ? `${trimmed}…` : trimmed
}
