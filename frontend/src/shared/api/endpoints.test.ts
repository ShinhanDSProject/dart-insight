import { describe, expect, it } from 'vitest'
import { endpoints } from './endpoints'

// 경로는 docs/api-spec.md와의 약속이라 테스트에서는 문자열로 적는다(상수를 다시 쓰지 않음)
describe('endpoints', () => {
  it('API 명세의 경로를 만든다', () => {
    expect(endpoints.companies()).toBe('/api/companies')
    expect(endpoints.companyReports('00126380')).toBe('/api/companies/00126380/reports')
    expect(endpoints.reportPairs('00126380')).toBe('/api/companies/00126380/report-pairs')
    expect(endpoints.report('20260814003699')).toBe('/api/reports/20260814003699')
    expect(endpoints.analysis(3)).toBe('/api/analyses/3')
    expect(endpoints.financialChange(3, 12)).toBe('/api/analyses/3/financial-changes/12')
    expect(endpoints.documentSection(3, 'current', 2)).toBe('/api/analyses/3/documents/current/sections/2')
    expect(endpoints.questions(3)).toBe('/api/analyses/3/questions')
  })

  it('경로 변수는 항상 인코딩한다', () => {
    expect(endpoints.company('a/b')).toBe('/api/companies/a%2Fb')
    expect(endpoints.document(3, '../x')).toBe('/api/analyses/3/documents/..%2Fx')
    expect(endpoints.analysis('1?x=2')).toBe('/api/analyses/1%3Fx%3D2')
  })
})
