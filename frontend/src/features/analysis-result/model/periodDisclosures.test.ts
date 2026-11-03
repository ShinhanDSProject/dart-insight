import { describe, expect, it } from 'vitest'
import type { DisclosureGroup, DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { periodBreakdownLine, plainTitle, summarizePeriodDisclosures } from './periodDisclosures'

function item(reportName: string, receivedDate: string, group: DisclosureGroup, rceptNo = receivedDate): DisclosureItem {
  return {
    rceptNo,
    reportName,
    filerName: null,
    receivedDate,
    group,
    groupLabel: group,
    periodic: group === 'PERIODIC',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
    keyItemsKind: null,
  }
}

function list(from: string, items: DisclosureItem[]): DisclosureList {
  return { corpCode: '00126380', days: 365, from, to: '2026-11-01', fetchedAt: null, refreshError: null, groups: [], items }
}

describe('이 기간 수시공시(시안)', () => {
  const items = [
    item('반기보고서 (2026.06)', '2026-08-14', 'PERIODIC'),
    item('연결재무제표기준영업(잠정)실적(공정공시)', '2026-07-07', 'BUSINESS', '1'),
    item('[기재정정]연결재무제표기준영업(잠정)실적(공정공시)', '2026-04-07', 'BUSINESS', '2'),
    item('주식등의대량보유상황보고서(일반)', '2026-05-01', 'OWNERSHIP'),
    item('현금ㆍ현물배당결정', '2026-04-30', 'OTHER', '4'),
    item('현금ㆍ현물배당결정', '2026-03-30', 'OTHER', '5'),
    item('유상증자결정', '2026-06-01', 'FUNDING'),
    item('기타경영사항(자율공시)', '2026-03-02', 'OTHER'),
    item('기타경영사항(자율공시)', '2026-02-14', 'OTHER', '3'),
    item('주주총회소집결의', '2026-08-15', 'GOVERNANCE'),
  ]

  it('이전 보고서 제출 다음 날부터 현재 보고서 제출일까지 실적·영업·자금 조달·지배구조를 머리 건수로 세고 기타·지분 변동은 따로 센다', () => {
    const result = summarizePeriodDisclosures(list('2025-11-01', items), '2026-02-14', '2026-08-14')
    expect(result.from).toBe('2026-02-15')
    expect(result.to).toBe('2026-08-14')
    expect(result.clipped).toBe(false)
    expect(result.count).toBe(3)
    // 기간 밖(2026-02-14, 2026-08-15)과 정기보고서는 세지 않는다
    expect(result.breakdown).toEqual({ business: 2, funding: 1, governance: 0, other: 3 })
    expect(result.ownershipCount).toBe(1)
  })

  it('제목은 네 묶음에서 먼저 고르고 모자라면 기타 제목으로 채운다', () => {
    const result = summarizePeriodDisclosures(list('2025-11-01', items), '2026-02-14', '2026-08-14')
    expect(result.titles.map((t) => [t.title, t.count, t.group])).toEqual([
      ['연결재무제표기준영업(잠정)실적(공정공시)', 2, 'BUSINESS'],
      ['유상증자결정', 1, 'FUNDING'],
      ['현금ㆍ현물배당결정', 2, 'OTHER'],
    ])
    expect(result.titles[0]?.dartUrl).toContain('rcpNo=1')
  })

  it('네 묶음 제목이 세 개 이상이면 기타 제목은 넣지 않는다', () => {
    const main = [
      item('유상증자결정', '2026-06-01', 'FUNDING', 'a'),
      item('주주총회소집결의', '2026-05-01', 'GOVERNANCE', 'b'),
      item('단일판매ㆍ공급계약체결', '2026-04-01', 'BUSINESS', 'c'),
      item('현금ㆍ현물배당결정', '2026-04-30', 'OTHER', 'd'),
      item('현금ㆍ현물배당결정', '2026-03-30', 'OTHER', 'e'),
    ]
    const result = summarizePeriodDisclosures(list('2025-11-01', main), '2026-02-14', '2026-08-14')
    expect(result.titles.every((t) => t.group !== 'OTHER')).toBe(true)
  })

  it('묶음별 건수를 한 줄로 잇고 지분 변동은 뺀 건수로 적는다', () => {
    expect(
      periodBreakdownLine({ breakdown: { business: 5, funding: 0, governance: 2, other: 61 }, ownershipCount: 3 }),
    ).toBe('실적·영업 5 · 자금 조달 0 · 지배구조 2 · 기타 61 · 지분 변동 3건 제외')
  })

  it('받은 목록이 기간 시작을 덮지 못하면 받은 기간부터 세고 잘렸다고 알린다', () => {
    const result = summarizePeriodDisclosures(list('2025-11-01', []), '2025-08-14', '2026-08-14')
    expect(result.from).toBe('2025-11-01')
    expect(result.clipped).toBe(true)
    expect(result.count).toBe(0)
    expect(result.titles).toEqual([])
  })

  it('제목 앞 꼬리표와 뒤 괄호 설명을 떼고 같은 제목으로 묶는다', () => {
    expect(plainTitle('[기재정정][첨부추가]기타경영사항(자율공시)')).toBe('기타경영사항(자율공시)')
    expect(plainTitle('단일판매ㆍ공급계약체결   (자회사의 주요경영사항)')).toBe('단일판매ㆍ공급계약체결')
  })
})
