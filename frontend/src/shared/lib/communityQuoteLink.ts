import type { QuoteKind } from '@/shared/api/community'
import type { SjDiv } from '@/shared/api/results'
import { positiveInt, type ParamChanges } from './searchParams'

/**
 * 분석 결과(W-03)에서 확인한 재무 수치·문장 변경을 기업 커뮤니티 글쓰기 칸에 바로 붙여 여는 주소 약속(#525).
 * 기능 폴더끼리 직접 import하지 않도록(DIR-4) 주소 조립과 해석만 shared에 둔다.
 */

const QUOTE_KINDS: readonly QuoteKind[] = ['FINANCIAL_CHANGE', 'TEXT_CHANGE']
const SJ_DIVS: readonly SjDiv[] = ['BS', 'IS', 'CIS', 'CF', 'SCE']

export interface CommunityQuoteTarget {
  corpCode: string
  analysisId: number
  kind: QuoteKind
  changeId: number
  sjDiv?: SjDiv | null
}

export interface ParsedCommunityQuote {
  analysisId: number
  kind: QuoteKind
  changeId: number
  sjDiv: SjDiv | null
}

/** 분석 결과의 변경점을 커뮤니티 글쓰기 칸에 붙여 여는 주소 */
export function communityQuotePath(target: CommunityQuoteTarget): string {
  const params = new URLSearchParams({
    view: 'community',
    quoteAnalysis: String(target.analysisId),
    quoteKind: target.kind,
    quoteChange: String(target.changeId),
  })
  if (target.kind === 'FINANCIAL_CHANGE' && target.sjDiv) {
    params.set('quoteSj', target.sjDiv)
  }
  return `/companies/${encodeURIComponent(target.corpCode)}?${params.toString()}`
}

/** 주소에 인용 관련 쿼리가 하나라도 있는지(잘못된 값도 정리할 수 있게 확인) */
export function hasCommunityQuoteParams(params: URLSearchParams): boolean {
  return (
    params.has('quoteAnalysis') ||
    params.has('quoteKind') ||
    params.has('quoteChange') ||
    params.has('quoteSj')
  )
}

/** 주소에서 인용 대상을 읽는다. 필수 값이 빠졌거나 형식이 다르면 null */
export function parseCommunityQuoteParams(params: URLSearchParams): ParsedCommunityQuote | null {
  const analysisId = positiveInt(params.get('quoteAnalysis'))
  const changeId = positiveInt(params.get('quoteChange'))
  const rawKind = params.get('quoteKind')
  const kind = QUOTE_KINDS.find((k) => k === rawKind) ?? null
  if (analysisId === null || changeId === null || kind === null) return null

  const rawSj = params.get('quoteSj')
  if (rawSj !== null && !SJ_DIVS.some((s) => s === rawSj)) return null
  const sjDiv = kind === 'FINANCIAL_CHANGE' ? (SJ_DIVS.find((s) => s === rawSj) ?? null) : null
  return { analysisId, kind, changeId, sjDiv }
}

/** 인용을 붙이거나 무시한 뒤 주소에서 지울 쿼리 키 */
export const clearCommunityQuoteParams: ParamChanges = {
  quoteAnalysis: null,
  quoteKind: null,
  quoteChange: null,
  quoteSj: null,
}
