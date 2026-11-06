import { formatDate } from '@/shared/lib/reportLabels'
import type { NewsArticle } from '@/shared/api/news'

/** 뉴스 탭 맨 위 안내(ADR-0046). 뉴스는 DART 공시가 아니고 AI에도 넣지 않는다 */
export const NEWS_NOTICE = '네이버 뉴스 검색으로 찾은 외부 기사예요. 공시 근거가 아니며, 기사 내용은 원문에서 확인해 주세요.'

/** 기사 시각 'YYYY.MM.DD HH:mm'. 시각이 없으면 null */
export function newsTime(publishedAt: string | null): string | null {
  if (publishedAt === null) return null
  return `${formatDate(publishedAt.slice(0, 10))} ${publishedAt.slice(11, 16)}`
}

/**
 * '뉴스 한눈에 보기' 주제와 낱말(#765). 위에서부터 처음 맞는 주제 하나에만 넣는다.
 * 뉴스는 AI에 넣지 않으므로(ADR-0046) LLM 대신 이 표로 나눈다.
 */
export const NEWS_TOPICS = [
  { label: '주가·시장', words: ['주가', '코스피', '코스닥', '증시', '급락', '급등', '폭락', '폭등', '시가총액', '외국인', '개미', '목표가', '상한가', '하한가'] },
  { label: '실적·사업', words: ['실적', '매출', '영업이익', '순이익', '수주', '계약', '출시', '공급', '투자', '공장', '양산', '수출', '인수', '합병'] },
  { label: '인사·노사', words: ['선임', '임명', '취임', '사장', '대표이사', '회장', '인사', '노조', '노사', '교섭', '파업'] },
  { label: '채용', words: ['채용', '취업', '공채', '박람회', '인턴'] },
] as const

export const NEWS_OTHER_TOPIC = '기타'

/** 카드를 보일 최소 기사 수. 이보다 적으면 목록을 바로 읽는 편이 빠르다 */
export const NEWS_DIGEST_MIN = 3

export interface NewsTopicGroup {
  label: string
  /** 목록 번호(1부터). 목록과 같은 최신순 */
  numbers: number[]
  /** 그 주제의 가장 최신 기사 */
  first: NewsArticle
}

function topicOf(text: string): string | null {
  return NEWS_TOPICS.find((topic) => topic.words.some((word) => text.includes(word)))?.label ?? null
}

/** 기사를 주제별로 나눈다. 제목으로 먼저, 안 맞으면 요약으로 정하고, 둘 다 안 맞으면 '기타'. 건수가 많은 주제부터, '기타'는 맨 뒤 */
export function groupNews(items: NewsArticle[]): NewsTopicGroup[] {
  const groups = new Map<string, NewsTopicGroup>()
  items.forEach((article, index) => {
    const label = topicOf(article.title) ?? topicOf(article.description) ?? NEWS_OTHER_TOPIC
    const group = groups.get(label)
    if (group) group.numbers.push(index + 1)
    else groups.set(label, { label, numbers: [index + 1], first: article })
  })
  const order = (group: NewsTopicGroup) => (group.label === NEWS_OTHER_TOPIC ? -1 : group.numbers.length)
  return [...groups.values()].sort((a, b) => order(b) - order(a))
}
