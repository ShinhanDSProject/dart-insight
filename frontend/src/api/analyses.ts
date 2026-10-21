import { apiGet, apiPost } from './client'
import type { ComparabilityRequest, FsDiv } from './comparability'
import type { ComparisonBasis, ReportItem } from './reports'

export type AnalysisStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type AnalysisStepName = 'RECEIVED' | 'COMPARING' | 'VERIFYING' | 'DONE'
export type StepState = 'DONE' | 'ACTIVE' | 'PENDING' | 'FAILED'

export interface AnalysisStepView {
  step: AnalysisStepName
  label: string
  state: StepState
}

export interface Analysis {
  analysisId: number
  corpCode: string
  corpName: string
  basis: ComparisonBasis
  fsDiv: FsDiv | null
  current: ReportItem
  previous: ReportItem
  status: AnalysisStatus
  step: AnalysisStepName
  steps: AnalysisStepView[]
  error: { code: string; message: string; retryable: boolean } | null
  createdAt: string
  completedAt: string | null
}

export interface AnalysisCreated {
  analysisId: number
  status: AnalysisStatus
  step: AnalysisStepName
  /** 새로 만들지 않고 기존 분석(완료 또는 진행 중)을 돌려줬는지 */
  reused: boolean
}

export function requestAnalysis(request: ComparabilityRequest): Promise<AnalysisCreated> {
  return apiPost('/api/analyses', request)
}

export function getAnalysis(analysisId: string | number): Promise<Analysis> {
  return apiGet(`/api/analyses/${encodeURIComponent(String(analysisId))}`)
}

/** 분석 화면 주소. 완료됐으면 결과(W-03), 아니면 진행(W-02) */
export function analysisPath(analysisId: number, status: AnalysisStatus): string {
  return status === 'COMPLETED' ? `/analyses/${analysisId}` : `/analyses/${analysisId}/progress`
}
