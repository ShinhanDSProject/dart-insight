import { useCallback, useReducer, useRef } from 'react'
import type { PricingPlan } from '@/shared/api/admin'
import { postPlanInterest } from '@/shared/api/pricing'
import { initialInterest, interestReducer, parseSentPlans, type InterestState } from '../model/pricing'

const STORAGE_KEY = 'dart-insight:plan-interest'

function readSent(): PricingPlan[] {
  try {
    return parseSentPlans(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function rememberSent(plan: PricingPlan) {
  try {
    const plans = new Set([...readSent(), plan])
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...plans]))
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 기억한다(서버는 그대로 셈)
  }
}

/**
 * 요금제 '관심 있어요'(FS-73 R2). 같은 브라우저에서 같은 요금제는 한 번만 보내도록 남긴 요금제를 기억한다.
 * 연락처는 받지 않고, 로그인했으면 서버가 회원 ID를 함께 남긴다.
 */
export function usePlanInterest(): { state: InterestState; send: (plan: PricingPlan) => void } {
  const [state, dispatch] = useReducer(interestReducer, undefined, () => initialInterest(readSent()))
  // 상태가 화면에 반영되기 전에 같은 요금제를 또 눌러도 한 번만 보내도록, 보내는 중·보낸 요금제를 바로 기억한다
  const busy = useRef(new Set<PricingPlan>())
  const send = useCallback(
    (plan: PricingPlan) => {
      if (state[plan] === 'sent' || busy.current.has(plan)) return
      busy.current.add(plan)
      dispatch({ type: 'send', plan })
      postPlanInterest(plan).then(
        () => {
          rememberSent(plan)
          dispatch({ type: 'sent', plan })
        },
        () => {
          busy.current.delete(plan)
          dispatch({ type: 'fail', plan })
        },
      )
    },
    [state],
  )
  return { state, send }
}
