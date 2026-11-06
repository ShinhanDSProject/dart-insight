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

/**
 * 같은 화면(분석 결과의 커뮤니티 탭)에서 글쓰기 칸에 인용을 붙일 쿼리. 기업 화면 주소 없이 쿼리만 바꾼다
 * (AI 에이전트 채팅의 글 초안 열기, #584)
 */
export function communityQuoteParamChanges(target: Omit<CommunityQuoteTarget, 'corpCode'>): ParamChanges {
  return {
    quoteAnalysis: String(target.analysisId),
    quoteKind: target.kind,
    quoteChange: String(target.changeId),
    quoteSj: target.kind === 'FINANCIAL_CHANGE' && target.sjDiv ? target.sjDiv : null,
  }
}

/**
 * 새 글 초안을 열 때의 인용 쿼리. 앞 초안의 인용 쿼리를 먼저 지우고 새 인용만 남긴다(인용 없는 초안은 인용 쿼리 없음).
 * 아직 불러오는 중인 앞 인용도 쿼리가 바뀌어 취소된다
 */
export function communityDraftParamChanges(quote: ParamChanges | null): ParamChanges {
  return { ...clearCommunityQuoteParams, ...(quote ?? {}) }
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
