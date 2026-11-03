import { formatDate } from '@/shared/lib/reportLabels'

/** 뉴스 탭 맨 위 안내(ADR-0046). 뉴스는 DART 공시가 아니고 AI에도 넣지 않는다 */
export const NEWS_NOTICE = '네이버 뉴스 검색으로 찾은 외부 기사예요. 공시 근거가 아니며, 기사 내용은 원문에서 확인해 주세요.'

/** 기사 시각 'YYYY.MM.DD HH:mm'. 시각이 없으면 null */
export function newsTime(publishedAt: string | null): string | null {
  if (publishedAt === null) return null
  return `${formatDate(publishedAt.slice(0, 10))} ${publishedAt.slice(11, 16)}`
}
