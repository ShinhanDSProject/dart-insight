import { useEffect, type Dispatch } from 'react'
import { useSearchParams } from 'react-router'
import { getAnalysis } from '@/shared/api/analyses'
import { getFinancialChange } from '@/shared/api/results'
import { getTextChange } from '@/shared/api/textChanges'
import {
  clearCommunityQuoteParams,
  parseCommunityQuoteParams,
  type ParsedCommunityQuote,
} from '@/shared/lib/communityQuoteLink'
import { applyParamChanges } from '@/shared/lib/searchParams'
import { financialPick, statementLabel, textPick, type QuoteComposerAction } from '../model/postQuote'

/**
 * 분석 결과에서 '커뮤니티에 인용'을 눌러 들어온 경우(?quoteAnalysis=&quoteKind=&quoteChange=),
 * 이 기업의 완료된 분석인지 확인한 뒤 글쓰기 칸에 미리보기를 붙이고 주소의 임시 쿼리는 지운다(#525).
 */
export function useInitialQuotePick(corpCode: string, dispatchQuote: Dispatch<QuoteComposerAction>): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawAnalysis = searchParams.get('quoteAnalysis')
  const rawKind = searchParams.get('quoteKind')
  const rawChange = searchParams.get('quoteChange')
  const rawSj = searchParams.get('quoteSj')

  useEffect(() => {
    if (rawAnalysis === null && rawKind === null && rawChange === null && rawSj === null) return

    const params = new URLSearchParams()
    if (rawAnalysis !== null) params.set('quoteAnalysis', rawAnalysis)
    if (rawKind !== null) params.set('quoteKind', rawKind)
    if (rawChange !== null) params.set('quoteChange', rawChange)
    if (rawSj !== null) params.set('quoteSj', rawSj)

    const target = parseCommunityQuoteParams(params)
    if (target === null) {
      setSearchParams((prev) => applyParamChanges(prev, clearCommunityQuoteParams), { replace: true })
      return
    }

    const controller = new AbortController()

    async function load(parsed: ParsedCommunityQuote) {
      try {
        const analysis = await getAnalysis(parsed.analysisId, controller.signal)
        if (controller.signal.aborted) return
        if (analysis.status === 'COMPLETED' && analysis.corpCode === corpCode) {
          if (parsed.kind === 'TEXT_CHANGE') {
            const detail = await getTextChange(parsed.analysisId, parsed.changeId, controller.signal)
            if (controller.signal.aborted) return
            if (detail.change.changeType !== 'REVIEW_NEEDED') {
              dispatchQuote({ type: 'pick', pick: textPick(analysis, detail.change) })
            }
          } else {
            const detail = await getFinancialChange(parsed.analysisId, parsed.changeId, controller.signal)
            if (controller.signal.aborted) return
            dispatchQuote({
              type: 'pick',
              pick: financialPick(analysis, statementLabel(detail.sjDiv), detail),
            })
          }
        }
      } catch {
        // 없는 분석·변경이나 취소된 요청은 인용을 붙이지 않고 조용히 넘긴다
      } finally {
        if (!controller.signal.aborted) {
          setSearchParams((prev) => applyParamChanges(prev, clearCommunityQuoteParams), { replace: true })
        }
      }
    }

    void load(target)
    return () => controller.abort()
  }, [corpCode, rawAnalysis, rawKind, rawChange, rawSj, setSearchParams, dispatchQuote])
}
