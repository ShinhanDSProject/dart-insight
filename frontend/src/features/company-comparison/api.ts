import { listCompanyAnalyses } from '@/shared/api/analyses'
import { getCompany } from '@/shared/api/companies'
import { getFinancialTrends, type FsDiv } from '@/shared/api/financialTrends'
import type { SettledLoad } from './model/companyComparison'

/**
 * 한 기업의 이름(기업 정보)·주요 재무 흐름·완료된 분석 목록을 함께 부른다(API 변경 없음).
 * 기업 정보나 완료 분석 목록을 받지 못해도 재무 흐름이 있으면 표를 그린다. 재무 흐름을 받지 못하면 그 열만 실패다.
 */
export async function loadCompanyColumn(corpCode: string, fsDiv: FsDiv, signal: AbortSignal): Promise<SettledLoad> {
  const [company, trend, analyses] = await Promise.allSettled([
    getCompany(corpCode, signal),
    getFinancialTrends(corpCode, fsDiv, signal),
    listCompanyAnalyses(corpCode, signal, 20),
  ])
  const known = company.status === 'fulfilled' ? company.value : null
  const completedAnalyses = analyses.status === 'fulfilled' ? analyses.value.items : []
  return trend.status === 'fulfilled'
    ? { status: 'success', company: known, trend: trend.value, completedAnalyses }
    : { status: 'error', company: known, error: trend.reason }
}
