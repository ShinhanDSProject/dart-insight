import type { TextEventItem, TextEventList, TextEventSignal } from '@/shared/api/textEvents'

/** 문장 변화 탭 맨 위 '한눈에 보기'(#826) 화면 문구 */
export const GLANCE_TITLE = '한눈에 보기'
export const GLANCE_EVIDENCE = '근거 ›'
/** 한눈에 보기에 올리는 사건 수(서버 순서 앞에서부터) */
export const GLANCE_EVENT_LIMIT = 3

/**
 * '○○이란?' 링크를 붙일 어려운 공시 용어(팀이 고른 목록). 문장에 나오는 것마다 문장 순서로, 한 줄에 최대 GLANCE_TERM_LIMIT개 붙인다.
 * 띄어 쓴 용어(예: '지분 매도')는 앞 낱말 뒤에 뒷 낱말이 같은 문장에 나오면 찾는다('지분(40.2%)을 … 매도'). 두 말 용어가 찾아지면 그 안의 한 말 용어(자기주식)는 따로 붙이지 않는다.
 * 뜻은 화면이 정하지 않고 AI 에이전트의 용어 풀이(카드 → 보고서 원문 → 못 찾음 안내)에 맡긴다.
 */
export const GLANCE_TERMS: readonly string[] = [
  '자기주식 소각',
  '자기주식 취득',
  '자기주식 처분',
  '지분 매도',
  '지분 취득',
  '영업양도',
  '중간배당',
  '유상증자',
  '무상증자',
  '전환사채',
  '신주인수권부사채',
  '지분법',
  '종속기업',
  '지배기업',
  '자기주식',
  '우발부채',
  '손상차손',
  '과징금',
  '신탁계약',
]

/** 한 줄에 붙이는 용어 링크 수 */
export const GLANCE_TERM_LIMIT = 3

export interface GlanceLine {
  eventId: number
  /** 사건 '공시의 의미'의 첫 사실 문장(AI 생성) */
  text: string
  /** '근거 ›'로 열 변경. 찾지 못하면 null(링크 없음) */
  changeId: number | null
  /** '○○이란?'을 붙일 용어(문장 순서). 목록 용어가 없으면 [] */
  terms: string[]
}

export interface Glance {
  /** 코드가 센 사건·신호 건수 한 줄 */
  countLine: string
  lines: GlanceLine[]
}

function signalCount(list: Pick<TextEventList, 'signalCounts'>, signal: TextEventSignal): number {
  return list.signalCounts.find((count) => count.signal === signal)?.eventCount ?? 0
}

function glanceLine(item: TextEventItem): GlanceLine | null {
  if (item.meaning?.status !== 'GENERATED') return null
  const fact = item.meaning.items.find((entry) => entry.type === 'FACT')
  if (!fact) return null
  // 문장 근거와 같은 블록을 인용한 변경만 연다. 없으면 다른 원문을 근거처럼 보이지 않게 링크를 두지 않는다(상세의 공시의 의미와 같은 규칙)
  const cited = item.quotes.find((quote) => fact.evidence.some((evidence) => evidence.evidenceId === quote.evidenceId))
  return {
    eventId: item.eventId,
    text: fact.text,
    changeId: cited?.changeId ?? null,
    terms: glanceTerms(fact.text),
  }
}

/**
 * 용어가 문장에 처음 나오는 자리. 띄어 쓴 용어는 낱말이 이 순서로 나와야 하고, 없으면 null.
 * shortcut: 낱말 사이 거리를 보지 않아 긴 문장에서는 멀리 떨어진 '지분'과 '매도'도 잇는다. 잘못 잇는 문장이 보이면 거리 한도를 둔다
 */
function termPosition(text: string, term: string): { start: number; end: number } | null {
  const words = term.split(' ')
  const start = text.indexOf(words[0])
  if (start < 0) return null
  let end = start + words[0].length
  for (const word of words.slice(1)) {
    const at = text.indexOf(word, end)
    if (at < 0) return null
    end = at + word.length
  }
  return { start, end }
}

/** 문장에 나오는 목록 용어(문장 순서, 최대 GLANCE_TERM_LIMIT개). 앞선 용어가 차지한 자리와 겹치는 용어는 뺀다 */
export function glanceTerms(text: string): string[] {
  const found: { term: string; start: number; end: number }[] = []
  for (const term of GLANCE_TERMS) {
    const at = termPosition(text, term)
    if (at === null || found.some((f) => at.start < f.end && f.start < at.end)) continue
    found.push({ term, ...at })
  }
  return found
    .sort((a, b) => a.start - b.start)
    .slice(0, GLANCE_TERM_LIMIT)
    .map((f) => f.term)
}

/** 한눈에 보기. 사건이 없으면 null(카드를 그리지 않음). 문장은 서버 순서 앞 사건부터 '공시의 의미'가 있는 것만 고른다 */
export function eventGlance(list: Pick<TextEventList, 'items' | 'signalCounts'>): Glance | null {
  if (list.items.length === 0) return null
  const countLine = `주요 사건 ${list.items.length}건을 찾았어요. 긍정 ${signalCount(list, 'POSITIVE')}건, 주의 ${signalCount(list, 'CAUTION')}건, 보류 ${signalCount(list, 'HOLD')}건이에요.`
  const lines = list.items
    .map(glanceLine)
    .filter((line): line is GlanceLine => line !== null)
    .slice(0, GLANCE_EVENT_LIMIT)
  return { countLine, lines }
}

/** 마지막 글자에 받침이 있는지(한글이 아니면 없는 것으로 본다) */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

/** 링크 글자. 예: '중간배당이란?', '감자란?' */
export function termLinkLabel(term: string): string {
  return `${term}${hasFinalConsonant(term) ? '이란' : '란'}?`
}

/** AI 에이전트에게 보낼 질문. 예: '중간배당이 뭐예요?' */
export function termQuestion(term: string): string {
  return `${term}${hasFinalConsonant(term) ? '이' : '가'} 뭐예요?`
}
