import { match } from 'ts-pattern'
import { OUTSIDE_TOC } from './askQuestion'

/** AI 질문 입력 중 섹션 질문 제안(3.10, #267). 섹션 목록은 문장 변화 탭과 같은 출처(GET text-changes의 sections)다 */

export const SECTION_SUGGESTION_MAX = 5
const QUERY_MIN_LENGTH = 2

// 서버가 섹션 제목을 맞출 때처럼 앞 번호(II.·7.·가.·(1))·따옴표·공백은 보지 않는다
const LEADING_NUMBER = /^\s*(?:(?:[IVXLCDM]+|\d+|[가-힣])\.|\((?:\d+|[가-힣])\))\s*/i
const IGNORED_CHARS = /[\s'"‘’“”?!.,]/g

/** 비교용 제목·입력. 소문자로, 앞 번호·따옴표·공백·문장 부호를 뺀다 */
export function normalizeSectionText(text: string): string {
  return text.replace(LEADING_NUMBER, '').replace(IGNORED_CHARS, '').toLowerCase()
}

/**
 * 입력과 맞는 섹션 제목(최대 5개). 공백을 뺀 입력이 2자보다 짧으면 제안하지 않는다.
 * 제목이 입력 전체를 담거나, 입력의 마지막 낱말(2자 이상)을 담으면 맞는 것으로 본다.
 * 목차 밖 본문은 빼고, 같은 제목은 한 번만, 최상위·짧은 제목을 먼저 둔다.
 */
export function sectionSuggestions(titles: string[], input: string): string[] {
  const query = normalizeSectionText(input)
  if (query.length < QUERY_MIN_LENGTH) return []
  const lastWord = normalizeSectionText(input.trim().split(/\s+/).at(-1) ?? '')
  const keys = lastWord.length >= QUERY_MIN_LENGTH && lastWord !== query ? [query, lastWord] : [query]

  const unique = [...new Set(titles.map((t) => t.trim()))].filter((t) => t !== '' && t !== OUTSIDE_TOC)
  return unique
    .filter((title) => {
      const normalized = normalizeSectionText(title)
      return keys.some((key) => normalized.includes(key))
    })
    .map((title, order) => ({ title, order, depth: title.split(' > ').length }))
    .sort((a, b) => a.depth - b.depth || a.title.length - b.title.length || a.order - b.order)
    .map((s) => s.title)
    .slice(0, SECTION_SUGGESTION_MAX)
}

/** 제안 목록의 열림과 키보드로 고른 줄. 닫혀 있으면 고른 줄도 없다 */
export type SectionComboState = { status: 'closed' } | { status: 'open'; active: number | null }

export type SectionComboAction =
  | { type: 'input' }
  | { type: 'move'; delta: 1 | -1; count: number }
  | { type: 'close' }

export const SECTION_COMBO_CLOSED: SectionComboState = { status: 'closed' }

/**
 * 입력하면 열고(고른 줄 없음), ↑↓로 고른 줄을 옮긴다(끝에서 돌아감). 닫힌 채 ↑↓를 누르면 다시 열어 첫(마지막) 줄을 고른다.
 * 제안을 고르거나 Esc를 누르면 닫는다.
 */
export function sectionComboReducer(state: SectionComboState, action: SectionComboAction): SectionComboState {
  return match<SectionComboAction, SectionComboState>(action)
    .with({ type: 'input' }, () => ({ status: 'open', active: null }))
    .with({ type: 'move' }, ({ delta, count }) => {
      if (count <= 0) return state
      const current = state.status === 'open' ? state.active : null
      const start = delta === 1 ? -1 : count
      return { status: 'open', active: (((current ?? start) + delta) % count + count) % count }
    })
    .with({ type: 'close' }, () => SECTION_COMBO_CLOSED)
    .exhaustive()
}
