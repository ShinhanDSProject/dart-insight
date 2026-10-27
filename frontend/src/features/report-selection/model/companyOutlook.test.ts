import { describe, expect, it } from 'vitest'
import type { OutlookCategory, OutlookItem } from '@/shared/api/outlook'
import { groupOutlookItems } from './companyOutlook'

function item(no: number, category: OutlookCategory, categoryLabel: string): OutlookItem {
  return {
    no,
    category,
    categoryLabel,
    summary: `요지 ${no}`,
    quote: `인용 ${no}`,
    evidence: { evidenceId: `R#B${no}`, rceptNo: 'R', sectionNo: 1, blockNo: no, sectionPath: 'IV' },
  }
}

describe('전망·계획 종류별 묶음', () => {
  it('정한 종류 순서로 묶고, 같은 종류 안에서는 받은 순서를 지키며 빈 종류는 뺀다', () => {
    const groups = groupOutlookItems([
      item(1, 'MARKET', '시장·업황 전망'),
      item(2, 'INVESTMENT', '투자·설비'),
      item(3, 'MARKET', '시장·업황 전망'),
      item(4, 'OTHER', '기타'),
    ])

    expect(groups.map((g) => g.label)).toEqual(['투자·설비', '시장·업황 전망', '기타'])
    expect(groups[1].items.map((i) => i.no)).toEqual([1, 3])
  })

  it('항목이 없으면 빈 목록이다', () => {
    expect(groupOutlookItems([])).toEqual([])
  })
})
