import type { AnalysisStatus, AnalysisStepName } from './analyses'
import { apiGet, type RequestOptions } from './client'
import { endpoints } from './endpoints'
import type { ComparisonBasis } from './reports'

/** docs/api-spec.md GET /api/admin/overview·analyses·users(관리자만, FS-72) */

export type AdminDays = 7 | 30

export interface DailyAnalyses {
  date: string
  requested: number
  completed: number
  failed: number
}

export interface AdminOverview {
  days: AdminDays
  from: string
  to: string
  analyses: {
    requested: number
    completed: number
    failed: number
    inProgress: number
    /** 완료 ÷ (완료 + 실패). 분모가 0이면 null */
    completionRate: number | null
    p50Seconds: number | null
    p90Seconds: number | null
    outdated: number
    daily: DailyAnalyses[]
    topFailures: { errorCode: string; count: number; lastAt: string }[]
    topCompanies: { corpCode: string; corpName: string; count: number }[]
  }
  users: {
    total: number
    newInPeriod: number
    admins: number
    byProvider: Record<SignupProvider, number>
    daily: { date: string; signups: number }[]
  }
  watch: {
    favorites: number
    companies: number
    topWatched: { corpCode: string; corpName: string; count: number }[]
  }
  community: { openReports: number; postsInPeriod: number }
  ai: { calls: number; failedCalls: number; estimatedCostUsd: number | null; unpricedCalls: number }
  planInterests: {
    total: number
    signedIn: number
    byPlan: Record<PricingPlan, number>
    daily: { date: string; count: number }[]
  }
}

export type SignupProvider = 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER'
export type PricingPlan = 'FREE' | 'PRO' | 'TEAM' | 'EMBED'

export interface AdminAnalysisItem {
  analysisId: number
  corpCode: string
  corpName: string
  basis: ComparisonBasis
  current: { rceptNo: string; reportName: string }
  previous: { rceptNo: string; reportName: string }
  status: AnalysisStatus
  step: AnalysisStepName
  errorCode: string | null
  errorMessage: string | null
  traceId: string | null
  analysisVersion: string
  outdated: boolean
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
}

export interface PageOf<T> {
  page: number
  size: number
  totalItems: number
  items: T[]
}

export type AdminAnalysisDays = 1 | 7 | 30

export interface AdminAnalysesQuery {
  status: AnalysisStatus | null
  days: AdminAnalysisDays | null
  q: string | null
  page: number
}

export interface AdminUserItem {
  userId: number
  nickname: string | null
  /** 가린 이메일(예: tj***@g***.com). 이메일이 없으면 null. 전체 이메일은 오지 않는다 */
  maskedEmail: string | null
  providers: SignupProvider[]
  role: 'USER' | 'ADMIN'
  createdAt: string
  favoriteCount: number
  postCount: number
}

export interface AdminUsersQuery {
  role: 'USER' | 'ADMIN' | null
  q: string | null
  page: number
}

export function getAdminOverview(days: AdminDays, options?: RequestOptions): Promise<AdminOverview> {
  return apiGet<AdminOverview>(endpoints.adminOverview(), { days }, options)
}

export function getAdminAnalyses(query: AdminAnalysesQuery, options?: RequestOptions): Promise<PageOf<AdminAnalysisItem>> {
  return apiGet<PageOf<AdminAnalysisItem>>(
    endpoints.adminAnalyses(),
    { status: query.status, days: query.days, q: query.q, page: query.page },
    options,
  )
}

export function getAdminUsers(query: AdminUsersQuery, options?: RequestOptions): Promise<PageOf<AdminUserItem>> {
  return apiGet<PageOf<AdminUserItem>>(
    endpoints.adminUsers(),
    { role: query.role, q: query.q, page: query.page },
    options,
  )
}
