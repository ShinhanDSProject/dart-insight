import { match } from 'ts-pattern'
import type { AnalysisStatus } from '@/shared/api/analyses'
import type { AdminAnalysisDays, AdminDays, PricingPlan, SignupProvider } from '@/shared/api/admin'
import type { BadgeTone } from '@/shared/ui'

/** 관리자 콘솔(FS-72)의 주소 값 읽기와 표시 문구. 숫자는 서버가 계산하고 여기서는 글로만 바꾼다 */

export function parseOverviewDays(value: string | null): AdminDays {
  return value === '30' ? 30 : 7
}

export function parseAnalysisDays(value: string | null): AdminAnalysisDays | null {
  return match(value)
    .with('1', (): AdminAnalysisDays => 1)
    .with('7', (): AdminAnalysisDays => 7)
    .with('30', (): AdminAnalysisDays => 30)
    .otherwise(() => null)
}

const STATUSES: readonly AnalysisStatus[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']

export function parseAnalysisStatus(value: string | null): AnalysisStatus | null {
  return STATUSES.find((s) => s === value) ?? null
}

export function parseRole(value: string | null): 'USER' | 'ADMIN' | null {
  return value === 'USER' || value === 'ADMIN' ? value : null
}

/** 주소의 쪽 번호(1부터)를 API 쪽(0부터)으로. 잘못된 값은 0 */
export function parsePage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n - 1 : 0
}

/** 검색어: 앞뒤 공백을 지운 1~50자. 비었으면 null, 50자를 넘으면 자른다(서버는 50자를 넘으면 400) */
export function normalizeQuery(value: string | null): string | null {
  const q = (value ?? '').trim()
  return q === '' ? null : q.slice(0, 50)
}

export function lastPage(totalItems: number, size: number): number {
  return Math.max(0, Math.ceil(totalItems / size) - 1)
}




export function statusLabel(status: AnalysisStatus): string {
  return match(status)
    .with('PENDING', () => '대기')
    .with('RUNNING', () => '진행 중')
    .with('COMPLETED', () => '완료')
    .with('FAILED', () => '실패')
    .exhaustive()
}

export function statusTone(status: AnalysisStatus): BadgeTone {
  return match(status)
    .with('PENDING', 'RUNNING', (): BadgeTone => 'accent')
    .with('COMPLETED', (): BadgeTone => 'neutral')
    .with('FAILED', (): BadgeTone => 'danger')
    .exhaustive()
}

export function providerLabel(provider: SignupProvider): string {
  return match(provider)
    .with('LOCAL', () => '이메일')
    .with('GOOGLE', () => '구글')
    .with('KAKAO', () => '카카오')
    .with('NAVER', () => '네이버')
    .exhaustive()
}

export const PROVIDERS: readonly SignupProvider[] = ['LOCAL', 'GOOGLE', 'KAKAO', 'NAVER']

export function planLabel(plan: PricingPlan): string {
  return match(plan)
    .with('FREE', () => '무료')
    .with('PRO', () => '프로')
    .with('TEAM', () => '팀')
    .with('EMBED', () => '임베드·데이터')
    .exhaustive()
}

export const PLANS: readonly PricingPlan[] = ['FREE', 'PRO', 'TEAM', 'EMBED']

/** 'YYYY-MM-DD' → 'MM/DD' */
export function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${m}/${d}`
}

/** 'YYYY-MM-DDTHH:mm:ss' → 'MM/DD HH:mm' */
export function shortDateTime(isoDateTime: string): string {
  const [date, time = ''] = isoDateTime.split('T')
  return `${shortDate(date)} ${time.slice(0, 5)}`.trim()
}

/** 막대 길이 비율(0~100). 가장 큰 값이 0이면 모두 0 */
export function barPercent(value: number, max: number): number {
  return max <= 0 ? 0 : Math.round((value / max) * 1000) / 10
}
