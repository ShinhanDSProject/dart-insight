import { describe, expect, it } from 'vitest'
import { endpoints } from './endpoints'

// 경로는 docs/api-spec.md와의 약속이라 테스트에서는 문자열로 적는다(상수를 다시 쓰지 않음)
describe('endpoints', () => {
  it('API 명세의 경로를 만든다', () => {
    expect(endpoints.companies()).toBe('/api/companies')
    expect(endpoints.companyOverview('00126380')).toBe('/api/companies/00126380/overview')
    expect(endpoints.companyReports('00126380')).toBe('/api/companies/00126380/reports')
    expect(endpoints.reportPairs('00126380')).toBe('/api/companies/00126380/report-pairs')
    expect(endpoints.companyAnalyses('00126380')).toBe('/api/companies/00126380/analyses')
    expect(endpoints.companyFinancialTrends('00126380')).toBe('/api/companies/00126380/financial-trends')
    expect(endpoints.companyKeyFacts('00126380')).toBe('/api/companies/00126380/key-facts')
    expect(endpoints.companyDisclosures('00126380')).toBe('/api/companies/00126380/disclosures')
    expect(endpoints.companyDisclosureSignals('00126380')).toBe('/api/companies/00126380/disclosure-signals')
    expect(endpoints.companyBriefing('00126380')).toBe('/api/companies/00126380/briefing')
    expect(endpoints.companyOutlook('00126380')).toBe('/api/companies/00126380/outlook')
    expect(endpoints.companyQuestions('00126380')).toBe('/api/companies/00126380/questions')
    expect(endpoints.report('20260814003699')).toBe('/api/reports/20260814003699')
    expect(endpoints.analysis(3)).toBe('/api/analyses/3')
    expect(endpoints.financialChange(3, 12)).toBe('/api/analyses/3/financial-changes/12')
    expect(endpoints.documentSection(3, 'current', 2)).toBe('/api/analyses/3/documents/current/sections/2')
    expect(endpoints.questions(3)).toBe('/api/analyses/3/questions')
    expect(endpoints.questionFeedback(3, 7)).toBe('/api/analyses/3/questions/7/feedback')
    expect(endpoints.textChangeExplanations(3, 5512)).toBe('/api/analyses/3/text-changes/5512/explanations')
    expect(endpoints.aiUsage()).toBe('/api/system/ai-usage')
    expect(endpoints.notes()).toBe('/api/notes')
    expect(endpoints.note(5)).toBe('/api/notes/5')
    expect(endpoints.noteMemo(5)).toBe('/api/notes/5/memo')
    expect(endpoints.notesExport()).toBe('/api/notes/export')
  })

  it('경로 변수는 항상 인코딩한다', () => {
    expect(endpoints.company('a/b')).toBe('/api/companies/a%2Fb')
    expect(endpoints.document(3, '../x')).toBe('/api/analyses/3/documents/..%2Fx')
    expect(endpoints.analysis('1?x=2')).toBe('/api/analyses/1%3Fx%3D2')
  })
})
