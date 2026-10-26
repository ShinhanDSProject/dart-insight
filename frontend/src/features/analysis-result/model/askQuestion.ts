import { match, P } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { FinancialChangeItem } from '@/shared/api/results'
import { parseQuestion } from '@/shared/lib/questionText'
import { displaySectionTitle } from '@/shared/lib/sectionTitle'
import { SEARCH_MAX_LENGTH, searchQueryOf } from './textFilter'

/** AI 질문(3.10, FS-5) 화면 문구와 순수 함수. 입력 길이 규칙은 기업 질문과 함께 쓰는 shared/lib/questionText에 있다 */

export {
  askedAtLabel,
  draftMessage,
  parseQuestion,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  QUESTION_TOO_LONG,
  QUESTION_TOO_SHORT,
  questionCountLabel,
  quoteLabel,
  type QuestionInput,
} from '@/shared/lib/questionText'

export const ASK_INTRO = '두 보고서 원문에서 찾은 문단과 계산한 수치로만 답해요. 투자 판단·주가 예측 질문에는 답하지 않아요.'
export const RISK_QUESTION = '새로 생긴 위험 요인이 있나요?'

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
/** 보고서 표지 제목(사업·반기·분기보고서)은 섹션이 아니라 문서 이름이라 질문으로 만들지 않는다 */
const COVER_TITLE = /^(사업|반기|분기)보고서$/

/** 섹션 제목으로 질문을 만들 수 있는지. 빈 제목, 목차 밖 본문, 보고서 표지 제목은 뺀다 */
export function isAskableSection(title: string): boolean {
  const trimmed = title.trim()
  return trimmed !== '' && trimmed !== OUTSIDE_TOC && !COVER_TITLE.test(trimmed.replace(/\s+/g, ''))
}

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
    source.topSection !== null && isAskableSection(source.topSection)
      ? sectionQuestion(source.topSection)
      : null
  const ordered = [accounts[0], section, RISK_QUESTION, ...accounts.slice(1)]
  const unique = [...new Set(ordered.filter((q): q is string => q !== undefined && q !== null))]
  return unique.filter((q) => parseQuestion(q).kind === 'ready').slice(0, SUGGESTION_COUNT)
}

/**
 * 문장 변화 탭에서 고른 섹션을 AI에게 물을 질문(3.10). 'A > B' 꼴이면 마지막 제목으로 묻고, 예시 질문과 같은 꼴로 만든다.
 * 섹션을 고르지 않았거나 목차 밖 본문이면 null(묻기 버튼을 두지 않음)
 */
export function sectionAskQuestion(section: string | null): string | null {
  if (section === null) return null
  const title = section.split(' > ').at(-1)?.trim() ?? ''
  if (!isAskableSection(title)) return null
  return sectionQuestion(title)
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

/** 찾지 못한 답의 문장 변화 검색 버튼 문구(#284) */
export function textSearchLabel(word: string): string {
  return `문장·내용 변화에서 '${word}' 찾기`
}

/** 인용 원문이 어느 보고서인지 */
export function citationSideLabel(side: DocumentSide): string {
  return match(side)
    .with('current', () => '현재')
    .with('previous', () => '비교')
    .exhaustive()
}
