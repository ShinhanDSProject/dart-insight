import { match } from 'ts-pattern'
import type { PricingPlan } from '@/shared/api/admin'

/**
 * 요금제 화면(FS-73)의 내용. 가격·크레딧은 수익화 전략의 가설(노션 결정 로그 '수익화: 가격 숫자 확정 방법')이고,
 * 바꾸면 이 파일과 Figma '요금제 · /pricing · FS-73'을 함께 고친다.
 */
export interface PlanCard {
  plan: PricingPlan
  name: string
  price: string
  unit: string
  features: string[]
  /** 주 대상(테두리 강조). 수요 결과가 아니라 수익화 전략에서 정한 첫 고객이다 */
  primary: boolean
}

export const PLAN_CARDS: readonly PlanCard[] = [
  {
    plan: 'FREE',
    name: '무료',
    price: '0원',
    unit: '매월 50 크레딧',
    // 50 크레딧은 모니터링 2곳(40)과 질문 25회(50)를 함께 쓰기엔 모자라, 둘 중 하나로 쓰는 예로 적는다
    features: ['미리 계산된 비교 결과 보기 무제한', '50 크레딧으로 관심 기업 2곳 모니터링 또는 AI 질문 25회'],
    primary: false,
  },
  {
    plan: 'PRO',
    name: '프로',
    price: '49,000원',
    unit: '월 · 600 크레딧',
    features: ['사용자 무제한(사업자·전문가)', '관심 기업 모니터링·위험 변화 알림', 'API·MCP 키 1개', '노트·내보내기'],
    primary: true,
  },
  {
    plan: 'TEAM',
    name: '팀',
    price: '290,000원',
    unit: '월 · 4,000 크레딧',
    features: ['프로의 모든 것', 'API 키 여러 개·키별 월 예산', '사용 기록(감사 로그)'],
    primary: false,
  },
  {
    plan: 'EMBED',
    name: '임베드·데이터',
    price: '연 계약',
    unit: '견적',
    features: ['증권사·핀테크 앱에 변화 카드 넣기', '전 상장사 변화 데이터 피드', '별도 SLA'],
    primary: false,
  },
]

export interface CreditRow {
  work: string
  credits: string
  note: string
}

export const CREDIT_ROWS: readonly CreditRow[] = [
  { work: '미리 계산된 비교 보기(화면)', credits: '0', note: '공시 당일 미리 계산' },
  { work: '미리 계산된 비교 가져오기(API·MCP)', credits: '1', note: '에이전트용' },
  { work: '새 비교 계산', credits: '10', note: '실패·검토 필요면 0' },
  { work: '기업 1곳 모니터링', credits: '월 20', note: '새 정기보고서 자동 비교·알림' },
  { work: 'AI 질문·채팅 1회', credits: '2', note: '근거를 못 찾으면 0' },
  { work: '노트·내보내기·커뮤니티', credits: '0', note: '' },
]

/** 요금제별 '관심 있어요' 상태(ST-1·2). sent는 이 브라우저에서 이미 남긴 것 */
export type InterestStatus = 'idle' | 'sending' | 'sent' | 'error'
export type InterestState = Record<PricingPlan, InterestStatus>

export type InterestAction =
  | { type: 'send'; plan: PricingPlan }
  | { type: 'sent'; plan: PricingPlan }
  | { type: 'fail'; plan: PricingPlan }

export function initialInterest(sentPlans: readonly PricingPlan[]): InterestState {
  const has = (plan: PricingPlan): InterestStatus => (sentPlans.includes(plan) ? 'sent' : 'idle')
  return { FREE: has('FREE'), PRO: has('PRO'), TEAM: has('TEAM'), EMBED: has('EMBED') }
}

export function interestReducer(state: InterestState, action: InterestAction): InterestState {
  return match(action)
    .with({ type: 'send' }, ({ plan }) => (state[plan] === 'sent' ? state : { ...state, [plan]: 'sending' as const }))
    .with({ type: 'sent' }, ({ plan }) => ({ ...state, [plan]: 'sent' as const }))
    .with({ type: 'fail' }, ({ plan }) => ({ ...state, [plan]: 'error' as const }))
    .exhaustive()
}

/** 브라우저에 남긴 요금제 목록을 읽는다. 저장소를 못 쓰거나 값이 이상하면 빈 목록 */
export function parseSentPlans(raw: string | null): PricingPlan[] {
  if (raw === null) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((v): v is PricingPlan => v === 'FREE' || v === 'PRO' || v === 'TEAM' || v === 'EMBED')
  } catch {
    return []
  }
}

export function buttonLabel(status: InterestStatus): string {
  return match(status)
    .with('idle', () => '관심 있어요')
    .with('sending', () => '남기는 중…')
    .with('sent', () => '기록했어요')
    .with('error', () => '다시 시도')
    .exhaustive()
}
