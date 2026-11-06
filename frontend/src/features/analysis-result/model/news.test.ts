import { describe, expect, it } from 'vitest'
import type { NewsArticle } from '@/shared/api/news'
import { formatDate } from '@/shared/lib/reportLabels'
import { groupNews, newsTime } from './news'

describe('newsTime', () => {
  it('기사 시각을 날짜와 시:분으로 보이고, 시각이 없으면 null이다', () => {
    expect(newsTime('2026-11-03T11:52:00')).toBe(`${formatDate('2026-11-03')} 11:52`)
    expect(newsTime(null)).toBeNull()
  })
})

const article = (title: string, description = ''): NewsArticle => ({ title, description, url: `https://news.example/${title}`, source: null, publishedAt: null })

describe('groupNews', () => {
  it('제목의 낱말로 주제를 정하고, 건수가 많은 주제부터 두며 기타는 맨 뒤다', () => {
    const groups = groupNews([
      article("유한종 삼성전자 부사장, '국제회계기준 자문' GPF 위원 선임"),
      article('"퇴직연금 1억 녹아내린다"…삼성전자·SK하이닉스 폭락에 개미들 패닉'),
      article('삼성전자 사내 동호회 소식'),
      article('코스피 6% 급락…반도체 대형주 일제히 하락'),
    ])
    expect(groups.map((g) => [g.label, g.numbers])).toEqual([
      ['주가·시장', [2, 4]],
      ['인사·노사', [1]],
      ['기타', [3]],
    ])
    expect(groups[0].first.title).toContain('퇴직연금')
  })

  it('제목에 맞는 낱말이 없으면 요약으로 정한다', () => {
    const groups = groupNews([article('삼성전자 현직자 만난다', '취업박람회에서 직무를 설명한다')])
    expect(groups.map((g) => g.label)).toEqual(['채용'])
  })

  it('한 기사는 한 주제에만 들어가 건수의 합이 전체와 같다', () => {
    const items = [article('주가 급락 속 노조 교섭'), article('수주 계약'), article('알 수 없는 기사')]
    const groups = groupNews(items)
    expect(groups.flatMap((g) => g.numbers).sort()).toEqual([1, 2, 3])
    expect(groups[0].label).toBe('주가·시장')
  })
})
