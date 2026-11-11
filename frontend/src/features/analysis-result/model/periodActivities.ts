import { match } from 'ts-pattern'
import type {
  ActivityArea,
  ActivityEvidenceSide,
  ActivityAudience,
  ActivityHoldReason,
  ActivityImpact,
  ActivityImpactKind,
  ActivityItem,
  ActivitySignal,
} from '@/shared/api/activities'
import type { BadgeTone } from '@/shared/ui'

/** 공시 분석 탭의 관점 고르기. null이면 전체 */
export type AudienceFilter = ActivityAudience | null

export const AUDIENCE_OPTIONS: { value: AudienceFilter; label: string; hint: string }[] = [
  { value: null, label: '전체', hint: '모든 활동' },
  { value: 'INVESTOR', label: '자금·실적', hint: '투자(주식·사모펀드·재무적 투자)를 검토할 때 볼 내용' },
  { value: 'CAREER', label: '사업 방향', hint: '무슨 사업에 힘을 싣는지. 취업·면접을 준비할 때 볼 내용' },
  { value: 'PARTNER', label: '거래·리스크', hint: '믿고 거래할 만한 상황인지. 협업·거래를 검토할 때 볼 내용' },
]

export const AREA_LABELS: Record<ActivityArea, string> = {
  BUSINESS: '사업·제품',
  INVESTMENT: '투자·설비',
  FINANCE: '자금·재무',
  SHAREHOLDER: '주주·배당',
  GOVERNANCE: '지배구조·경영진',
  PEOPLE: '인력·조직',
  RISK: '소송·위험',
  OTHER: '기타',
}

export const AUDIENCE_LABELS: Record<ActivityAudience, string> = {
  INVESTOR: '자금·실적',
  CAREER: '사업 방향',
  PARTNER: '거래·리스크',
}

export const SIGNAL_NOTICE = '신호는 공시에 적힌 사건의 종류와 변화로 정한 것이고, 투자 판단이나 추천이 아니에요.'
export const OUTLOOK_NOTICE = "'AI 전망'은 공시 사실이 아니라 AI의 해석이라 틀릴 수 있어요. 주가·목표주가는 다루지 않아요."
export const OUTLOOK_TAG = 'AI 전망 · 공시 사실 아님'
export const NO_IMPACT_LINE = '확인된 영향 없음'

export function signalBadge(signal: ActivitySignal): { label: string; tone: BadgeTone; mark: string } {
  return match(signal)
    .with('POSITIVE', () => ({ label: '긍정 신호', tone: 'positive' as const, mark: '▲' }))
    .with('CAUTION', () => ({ label: '주의 신호', tone: 'attention' as const, mark: '▼' }))
    .with('HOLD', () => ({ label: '보류', tone: 'neutral' as const, mark: '–' }))
    .exhaustive()
}

/** 보류 사유를 화면 문장으로. 보류가 아니거나 사유가 없으면 null */
export function holdReasonText(signal: ActivitySignal, reason: ActivityHoldReason | null): string | null {
  if (signal !== 'HOLD' || reason === null) return null
  return match(reason)
    .with('NO_CRITERIA', () => '판단 기준표에 없는 사건이라 신호를 붙이지 않았어요.')
    .with('MIXED_SIDES', () => '좋은 면과 나쁜 면이 함께 있는 사건이라 한쪽으로 정하지 않았어요.')
    .with('EVIDENCE_NOT_CONFIRMED', () => '판단 근거를 원문에서 확인하지 못해 신호를 붙이지 않았어요.')
    .exhaustive()
}

export function impactKindLabel(kind: ActivityImpactKind): string {
  return match(kind)
    .with('DISCLOSED', () => '회사가 밝힘')
    .with('OUTLOOK', () => 'AI 전망')
    .with('CHECK', () => '확인할 점')
    .exhaustive()
}

/** AI 전망 줄의 좋은 면·나쁜 면 표시. 색만으로 구분하지 않도록 글자를 함께 둔다(UI-5) */
export function impactToneLabel(impact: ActivityImpact): string | null {
  if (impact.kind !== 'OUTLOOK' || impact.tone === null) return null
  return impact.tone === 'GOOD' ? '좋은 면' : '부담이 될 수 있는 면'
}

/** 영향 줄을 보이는 순서: 회사가 밝힌 것 → AI 전망 → 확인할 점. 같은 종류 안에서는 받은 순서 */
export function orderedImpacts(impacts: ActivityImpact[]): ActivityImpact[] {
  const rank: Record<ActivityImpactKind, number> = { DISCLOSED: 0, OUTLOOK: 1, CHECK: 2 }
  return impacts
    .map((impact, index) => ({ impact, index }))
    .sort((a, b) => rank[a.impact.kind] - rank[b.impact.kind] || a.index - b.index)
    .map((entry) => entry.impact)
}

/** 고른 쓰임에 맞는 카드. 전체면 그대로 */
export function itemsFor(items: ActivityItem[], audience: AudienceFilter): ActivityItem[] {
  return audience === null ? items : items.filter((item) => item.audiences.includes(audience))
}

/** 쓰임마다 카드 수(칩의 숫자) */
export function audienceCount(items: ActivityItem[], audience: AudienceFilter): number {
  return itemsFor(items, audience).length
}

/** 신호마다 카드 수(위쪽 한 줄 요약). 받은 카드 기준 */
export function signalCounts(items: ActivityItem[]): Record<ActivitySignal, number> {
  const counts: Record<ActivitySignal, number> = { POSITIVE: 0, CAUTION: 0, HOLD: 0 }
  for (const item of items) counts[item.signal] += 1
  return counts
}

/** 원문 쪽 표시 */
export function sideLabel(side: ActivityEvidenceSide): string {
  return match(side)
    .with('CURRENT', () => '이번 보고서')
    .with('PREVIOUS', () => '이전 보고서')
    .with('FINANCIAL', () => '재무 수치')
    .with('DISCLOSURE', () => '공시')
    .exhaustive()
}

/** 타임라인 날짜. YYYY-MM-DD → YYYY.MM.DD */
export function timelineDate(date: string): string {
  return date.replaceAll('-', '.')
}
