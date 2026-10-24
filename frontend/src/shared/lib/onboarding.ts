/**
 * 처음 쓰는 사용자 안내(FS-10). 검색 화면이 보여 주고 사이드바가 다시 열므로 shared에 둔다(DIR-4).
 * 닫았다는 표시만 브라우저(localStorage)에 남긴다. 저장을 쓸 수 없으면 null로 돌려, 화면이 이번 방문 동안만 기억하게 한다.
 */
export const ONBOARDING_DISMISSED_KEY = 'dart-insight:onboarding-dismissed'
/** 같은 탭 안에서 닫기·다시 보기를 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const ONBOARDING_CHANGE_EVENT = 'dart-insight:onboarding-change'

/** '예시로 해보기'에 쓰는 기업(삼성전자 고유번호) */
export const ONBOARDING_EXAMPLE_CORP_CODE = '00126380'

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 저장된 값이 '1'이면 닫은 것이다. 저장소가 없거나 읽다가 예외가 나면 모른다는 뜻으로 null */
export function readOnboardingDismissed(storage: OnboardingStorage | null): boolean | null {
  if (storage === null) return null
  try {
    return storage.getItem(ONBOARDING_DISMISSED_KEY) === '1'
  } catch {
    return null
  }
}

/** 닫으면 '1'을 남기고, 다시 보기면 지운다. 저장했으면 true, 저장소가 없거나 실패하면 false */
export function saveOnboardingDismissed(storage: OnboardingStorage | null, dismissed: boolean): boolean {
  if (storage === null) return false
  try {
    if (dismissed) {
      storage.setItem(ONBOARDING_DISMISSED_KEY, '1')
    } else {
      storage.removeItem(ONBOARDING_DISMISSED_KEY)
    }
    return true
  } catch {
    return false
  }
}

/** 안내를 닫았는지 정한다. 저장된 값을 읽을 수 있으면 그 값을, 없으면 이번 방문 동안의 값을 쓴다 */
export function onboardingDismissed(stored: boolean | null, sessionDismissed: boolean): boolean {
  return stored ?? sessionDismissed
}

/** 검색어가 없는 첫 화면에서, 닫지 않았을 때만 안내를 보인다 */
export function isOnboardingVisible(query: string, dismissed: boolean): boolean {
  return query === '' && !dismissed
}
