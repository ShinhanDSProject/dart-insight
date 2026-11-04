import type { PricingPlan } from './admin'
import { apiPost } from './client'
import { endpoints } from './endpoints'

/** POST /api/plan-interests(FS-73). 결제 없이 요금제별 관심만 센다. 로그인했으면 서버가 회원 ID를 함께 남긴다 */
export function postPlanInterest(plan: PricingPlan, source = 'pricing'): Promise<void> {
  return apiPost<void>(endpoints.planInterests(), { plan, source })
}
