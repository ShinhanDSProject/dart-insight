import type { FollowupStatus } from '@/shared/api/planFollowups'

/** 대조를 불러오지 못했을 때 에러 코드별 안내(conventions.yaml API-3) */
export const PLAN_FOLLOWUP_ERROR_MESSAGES: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어 작년 계획과 올해 보고서를 나란히 놓지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 원문을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 원문을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 인증키가 없어 원문을 받지 못했어요. 관리자에게 알려 주세요.',
  COMPANY_NOT_FOUND: '기업을 찾지 못했어요.',
}

/** 상태 배지 색. 평가로 읽히지 않게 중립색만 쓴다(초록·빨강 없음). 계획 변경 언급만 눈에 띄게 한다 */
export function followupTone(status: FollowupStatus): 'neutral' | 'attention' {
  return status === 'CHANGED' ? 'attention' : 'neutral'
}

/** 안내 문구(AC2). '찾지 못함'이 이행하지 않았다는 뜻이 아님을 알린다 */
export const FOLLOWUP_NOTICE = '찾지 못함은 이행하지 않았다는 뜻이 아니에요. 회사 공시 문장을 나란히 놓은 것이며 평가하지 않아요.'

export const NOT_FOUND_TEXT = '올해 보고서에서 찾지 못했어요'
