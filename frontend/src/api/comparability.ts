import { apiPost } from './client'
import { endpoints } from './endpoints'
import type { ComparisonBasis, ReportItem } from './reports'

export type ComparabilityLevel = 'FULL' | 'PARTIAL' | 'NOT_COMPARABLE'
export type CheckStatus = 'OK' | 'WARN' | 'FAIL' | 'SKIPPED'
export type AmountBasis = 'POINT' | 'CUMULATIVE' | 'QUARTER'
export type FsDiv = 'CFS' | 'OFS'

export interface ComparabilityCheck {
  item: string
  label: string
  status: CheckStatus
  detail: string
}

export interface StatementComparability {
  sjDiv: string
  label: string
  comparable: boolean
  amountBasis: AmountBasis | null
  note: string | null
}

export interface ComparabilityReason {
  code: string
  message: string
  nextAction: string
}

export interface ComparabilityResult {
  comparable: boolean
  level: ComparabilityLevel
  fsDiv: FsDiv | null
  current: ReportItem
  previous: ReportItem
  statements: StatementComparability[]
  checks: ComparabilityCheck[]
  reasons: ComparabilityReason[]
}

export interface ComparabilityRequest {
  corpCode: string
  currentRceptNo: string
  previousRceptNo: string
  basis: ComparisonBasis
}

export function checkComparability(request: ComparabilityRequest): Promise<ComparabilityResult> {
  return apiPost(endpoints.comparabilityChecks(), request)
}
