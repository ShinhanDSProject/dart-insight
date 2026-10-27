import type { OutlookCategory, OutlookItem } from '@/shared/api/outlook'

/** 전망·계획을 불러오지 못했을 때 에러 코드별 안내(conventions.yaml API-3) */
export const OUTLOOK_ERROR_MESSAGES: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어 전망·계획을 모으지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 원문을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 원문을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 인증키가 없어 원문을 받지 못했어요. 관리자에게 알려 주세요.',
  COMPANY_NOT_FOUND: '기업을 찾지 못했어요.',
}

/** 화면에 묶는 순서(서버 OutlookCategory와 같음) */
export const OUTLOOK_CATEGORY_ORDER: readonly OutlookCategory[] = ['INVESTMENT', 'NEW_BUSINESS', 'MARKET', 'FINANCIAL', 'OTHER']

export interface OutlookGroup {
  category: OutlookCategory
  label: string
  items: OutlookItem[]
}

/** 종류별 묶음. 정한 종류 순서로, 같은 종류 안에서는 받은 순서. 항목이 없는 종류는 뺀다 */
export function groupOutlookItems(items: readonly OutlookItem[]): OutlookGroup[] {
  return OUTLOOK_CATEGORY_ORDER.flatMap((category) => {
    const inGroup = items.filter((item) => item.category === category)
    return inGroup.length === 0 ? [] : [{ category, label: inGroup[0].categoryLabel, items: inGroup }]
  })
}
