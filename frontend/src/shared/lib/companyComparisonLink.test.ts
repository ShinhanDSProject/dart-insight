import { describe, expect, it } from 'vitest'
import { companyComparisonPath, pickComparisonCorps } from './companyComparisonLink'

describe('여러 기업 나란히 보기 주소 조립', () => {
  it('8자리 고유번호만 중복 없이 앞에서부터 최대 4곳까지 고른다', () => {
    expect(
      pickComparisonCorps(['00126380', 'bad', '00164779', '00126380', '00000003', '00000004', '00000005']),
    ).toEqual(['00126380', '00164779', '00000003', '00000004'])
  })

  it('유효한 기업이 2곳 미만이면 null, 2곳 이상이면 나란히 보기 주소를 만든다', () => {
    expect(companyComparisonPath([])).toBeNull()
    expect(companyComparisonPath(['00126380'])).toBeNull()
    expect(companyComparisonPath(['00126380', '00126380'])).toBeNull()
    expect(companyComparisonPath(['00126380', '00164779'])).toBe('/compare/companies?corps=00126380,00164779')
    expect(
      companyComparisonPath(['00126380', '00164779', '00000003', '00000004', '00000005']),
    ).toBe('/compare/companies?corps=00126380,00164779,00000003,00000004')
  })
})
