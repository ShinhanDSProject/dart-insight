import type { FeaturedCompanyListResponse } from '@/shared/api/featuredCompanies'
import type { SeasonChangeList } from '@/shared/api/seasonChanges'
import { formatDate } from '@/shared/lib/reportLabels'
import { seasonCaption } from './seasonChanges'

/** 첫 화면 목록(#686)에 담는 줄 수. 나머지는 둘러보기에서 본다 */
export const HOME_LIST_LIMIT = 10
/** 처음 보이는 줄 수(#848). 나머지는 '더 보기'로 연다 */
export const HOME_LIST_FIRST = 5
/** 넓은 화면(#852)에서 처음 보이는 줄 수. company-search.css의 넓은 화면 구간과 같은 기준을 쓴다 */
export const HOME_LIST_FIRST_WIDE = 7
export const WIDE_SCREEN_QUERY = '(min-width: 1600px)'

/** 화면 폭에 따라 처음 보이는 줄 수 */
export function homeListFirst(wide: boolean): number {
  return wide ? HOME_LIST_FIRST_WIDE : HOME_LIST_FIRST
}

/** 대표 기업과 시즌 변화를 같은 모양으로 그리기 위한 한 줄 */
export interface HomeRankRow {
  rank: number
  name: string
  /** 오른쪽 작은 글자(종목코드·문장 변경 수). 없으면 null */
  meta: string | null
  to: string
}

/** 목록 위 안내 한 줄과 줄들. 아직 준비되지 않았으면 rows가 비고 caption이 그 안내다 */
export interface HomeRankList {
  caption: string
  rows: HomeRankRow[]
}

const companyPath = (corpCode: string) => `/companies/${encodeURIComponent(corpCode)}`

export function featuredRankList(data: FeaturedCompanyListResponse): HomeRankList {
  if (data.baseDate === null || data.items.length === 0) {
    return { caption: '대표 기업 목록을 준비하고 있어요. 위에서 회사명으로 찾아 주세요.', rows: [] }
  }
  return {
    caption: `유가증권시장 시가총액 상위 · ${formatDate(data.baseDate)} 기준 · 출처: ${data.source}`,
    rows: data.items.slice(0, HOME_LIST_LIMIT).map((item) => ({
      rank: item.rank,
      name: item.corpName,
      meta: item.stockCode,
      to: companyPath(item.corpCode),
    })),
  }
}

export function seasonRankList(data: SeasonChangeList): HomeRankList {
  const season = data.season
  if (season === null) {
    return { caption: '이번 시즌 순위를 준비하고 있어요. 정기보고서 제출 기한이 지나면 대표 기업의 변화를 재어 보여 드려요.', rows: [] }
  }
  const caption = `${seasonCaption(season.reportType, season.fiscalYear, season.previousFiscalYear, data.candidateCount)} · 바뀐 양이지 좋고 나쁨이 아니에요.`
  return {
    caption: data.items.length === 0 ? `${caption} 이 시즌에 순위를 매긴 기업이 없어요.` : caption,
    rows: data.items.slice(0, HOME_LIST_LIMIT).map((item) => ({
      rank: item.rank,
      name: item.corpName ?? item.corpCode,
      meta: item.changeCount === null ? null : `문장 변경 ${item.changeCount}`,
      // 분석을 요청하지 못했으면 기업 화면으로 보낸다(SeasonChanges와 같음)
      to: item.analysisId === null ? companyPath(item.corpCode) : `/analyses/${item.analysisId}`,
    })),
  }
}
