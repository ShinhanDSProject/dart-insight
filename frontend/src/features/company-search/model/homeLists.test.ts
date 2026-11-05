import { describe, expect, it } from 'vitest'
import type { FeaturedCompany } from '@/shared/api/featuredCompanies'
import type { SeasonChangeList } from '@/shared/api/seasonChanges'
import { featuredRankList, HOME_LIST_LIMIT, seasonRankList } from './homeLists'

const season: SeasonChangeList = {
  season: { reportType: 'HALF', fiscalYear: 2026, previousFiscalYear: 2025 },
  seasons: [{ reportType: 'HALF', fiscalYear: 2026 }],
  computedAt: '2026-08-22T04:12:00',
  scoreVersion: 'season-1',
  candidateCount: 100,
  rankedCount: 2,
  excluded: { noReport: 0, failed: 0 },
  items: [
    { rank: 1, corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', previousRceptNo: null, currentRceptNo: null, changeCount: 147, highlight: null, analysisId: 42 },
    { rank: 2, corpCode: '00164779', corpName: null, stockCode: null, previousRceptNo: null, currentRceptNo: null, changeCount: null, highlight: null, analysisId: null },
  ],
}

describe('첫 화면 접는 목록의 줄(#686)', () => {
  it('대표 기업은 10곳까지 종목코드와 기업 화면 주소로 만들고 기준일·출처를 안내한다', () => {
    const items: FeaturedCompany[] = Array.from({ length: 12 }, (_, i) => ({
      rank: i + 1,
      corpCode: `0000000${i}`,
      corpName: `기업${i + 1}`,
      stockCode: i === 0 ? '005930' : null,
    }))
    const list = featuredRankList({ baseDate: '2026-10-24', source: '공공데이터포털', items })
    expect(list.rows).toHaveLength(HOME_LIST_LIMIT)
    expect(list.rows[0]).toEqual({ rank: 1, name: '기업1', meta: '005930', to: '/companies/00000000' })
    expect(list.caption).toContain('출처: 공공데이터포털')
  })

  it('대표 기업을 아직 받지 못했으면 줄 없이 준비 안내만 둔다', () => {
    expect(featuredRankList({ baseDate: null, source: 'x', items: [] }).rows).toEqual([])
  })

  it('시즌 변화는 분석이 있으면 분석 결과로, 없으면 기업 화면으로 보내고 이름이 없으면 고유번호를 쓴다', () => {
    const list = seasonRankList(season)
    expect(list.rows[0]).toEqual({ rank: 1, name: '삼성전자', meta: '문장 변경 147', to: '/analyses/42' })
    expect(list.rows[1]).toEqual({ rank: 2, name: '00164779', meta: null, to: '/companies/00164779' })
    expect(list.caption).toContain('2026 반기 vs 2025 반기')
  })

  it('계산한 시즌이 없으면 줄 없이 준비 안내만 둔다', () => {
    expect(seasonRankList({ ...season, season: null, items: [] }).rows).toEqual([])
  })
})
