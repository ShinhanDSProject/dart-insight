import type { TextEventItem, TextEventList, TextEventSignal } from '@/shared/api/textEvents'

/** 문장 변화 탭 맨 위 '한눈에 보기'(#826) 화면 문구 */
export const GLANCE_TITLE = '한눈에 보기'
export const GLANCE_EVIDENCE = '근거 ›'
/** 한눈에 보기에 올리는 사건 수(서버 순서 앞에서부터) */
export const GLANCE_EVENT_LIMIT = 3

/**
 * '○○이란?' 링크를 붙일 어려운 공시 용어(팀이 고른 목록). 한 문장에 여럿 나오면 목록에서 앞선 것 하나만 붙인다.
 * 뜻은 화면이 정하지 않고 AI 에이전트의 용어 풀이(카드 → 보고서 원문 → 못 찾음 안내)에 맡긴다.
 */
export const GLANCE_TERMS: readonly string[] = [
  '자기주식',
  '중간배당',
  '유상증자',
  '무상증자',
  '전환사채',
  '신주인수권부사채',
  '영업양도',
  '지분법',
  '종속기업',
  '지배기업',
  '우발부채',
  '손상차손',
  '과징금',
  '신탁계약',
  '감자',
]

export interface GlanceLine {
  eventId: number
  /** 사건 '공시의 의미'의 첫 사실 문장(AI 생성) */
  text: string
  /** '근거 ›'로 열 변경. 찾지 못하면 null(링크 없음) */
  changeId: number | null
  /** '○○이란?'을 붙일 용어. 목록 용어가 없으면 null */
  term: string | null
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
    term: GLANCE_TERMS.find((term) => fact.text.includes(term)) ?? null,
  }
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
