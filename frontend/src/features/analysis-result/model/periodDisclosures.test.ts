import { describe, expect, it } from 'vitest'
import type { DisclosureGroup, DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { plainTitle, summarizePeriodDisclosures } from './periodDisclosures'

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
  it('이전 보고서 제출 다음 날부터 현재 보고서 제출일까지 지분 변동·정기보고서를 빼고 센다', () => {
    const result = summarizePeriodDisclosures(
      list('2025-11-01', [
        item('반기보고서 (2026.06)', '2026-08-14', 'PERIODIC'),
        item('연결재무제표기준영업(잠정)실적(공정공시)', '2026-07-07', 'BUSINESS', '1'),
        item('[기재정정]연결재무제표기준영업(잠정)실적(공정공시)', '2026-04-07', 'BUSINESS', '2'),
        item('주식등의대량보유상황보고서(일반)', '2026-05-01', 'OWNERSHIP'),
        item('현금ㆍ현물배당결정', '2026-04-30', 'OTHER'),
        item('기타경영사항(자율공시)', '2026-02-14', 'OTHER'),
        item('기타경영사항(자율공시)', '2026-02-14', 'OTHER', '3'),
        item('현금ㆍ현물배당결정', '2026-08-15', 'OTHER'),
      ]),
      '2026-02-14',
      '2026-08-14',
    )
    expect(result.from).toBe('2026-02-15')
    expect(result.to).toBe('2026-08-14')
    expect(result.clipped).toBe(false)
    expect(result.count).toBe(3)
    expect(result.ownershipCount).toBe(1)
    expect(result.titles.map((t) => [t.title, t.count])).toEqual([
      ['연결재무제표기준영업(잠정)실적(공정공시)', 2],
      ['현금ㆍ현물배당결정', 1],
    ])
    expect(result.titles[0]?.dartUrl).toContain('rcpNo=1')
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
