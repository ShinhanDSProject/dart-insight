import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { PAST_ANALYSES_LIMIT, pastAnalysisLabel } from '@/shared/lib/pastAnalyses'
import type { ResultTab } from './resultParams'

/** '이 기업의 다른 분석'의 항목 하나 */
export interface OtherAnalysisLink {
  analysisId: number
  label: string
  /** 그 분석 결과의 같은 탭. 탭 안의 선택값(change·tc 등)은 남기지 않는다 */
  to: string
}

/** 지금 보는 분석을 빼고도 최대 개수를 채울 수 있게 하나 더 요청한다 */
export const OTHER_ANALYSES_REQUEST_LIMIT = PAST_ANALYSES_LIMIT + 1

/** 같은 기업의 완료된 분석 목록에서 지금 보는 분석을 빼고, 최대 5개를 지금 탭으로 가는 링크로 만든다(#290) */
export function otherAnalysisLinks(
  items: CompanyAnalysisItem[],
  currentAnalysisId: number,
  tab: ResultTab,
): OtherAnalysisLink[] {
  return items
    .filter((item) => item.analysisId !== currentAnalysisId)
    .slice(0, PAST_ANALYSES_LIMIT)
    .map((item) => ({
      analysisId: item.analysisId,
      label: pastAnalysisLabel(item),
      to: `/analyses/${item.analysisId}?${new URLSearchParams({ tab }).toString()}`,
    }))
}
