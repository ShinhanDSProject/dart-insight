/**
 * 화면 테마(FS-16, #856). 헤더에서 밝게·어둡게 중 하나를 고르고 브라우저(localStorage)에 남긴다.
 * 처음(저장값 없음)은 운영체제 설정과 상관없이 밝게다. <html>에는 늘 data-theme을 붙여 tokens.css가 그 값만 본다.
 * index.html의 인라인 스크립트가 React보다 먼저 같은 키·값을 읽어 적용한다(깜빡임 방지). 키·값을 바꾸면 그쪽도 고친다.
 */
export const THEME_KEY = 'dart-insight:theme'
/** 같은 탭 안에서 테마를 바꿨다고 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const THEME_CHANGE_EVENT = 'dart-insight:theme-change'

export type ThemeChoice = 'light' | 'dark'

export const THEME_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 저장된 글자를 선택으로 바꾼다. 'dark'가 아니면(없음·예전 '시스템'·잘못된 값) 밝게 */
export function parseThemeChoice(raw: string | null): ThemeChoice {
  return raw === 'dark' ? 'dark' : 'light'
}

/** 저장된 선택을 읽는다. 저장소가 없거나 읽다가 예외가 나면 모른다는 뜻으로 null */
export function readThemeChoice(storage: ThemeStorage | null): ThemeChoice | null {
  if (storage === null) return null
  try {
    return parseThemeChoice(storage.getItem(THEME_KEY))
  } catch {
    return null
  }
}

/** 고른 값을 남긴다. 저장했으면 true, 저장소가 없거나 실패하면 false */
export function saveThemeChoice(storage: ThemeStorage | null, choice: ThemeChoice): boolean {
  if (storage === null) return false
  try {
    storage.setItem(THEME_KEY, choice)
    return true
  } catch {
    return false
  }
}

/**
 * 지금 테마. 이번 방문에 고른 값(session)을 먼저 쓴다. 저장소를 읽을 수는 있지만 쓰기가 실패해도
 * 고른 테마가 바로 적용되게 하기 위해서다. 아무것도 모르면 밝게
 */
export function resolveThemeChoice(session: ThemeChoice | null, stored: ThemeChoice | null): ThemeChoice {
  return session ?? stored ?? 'light'
}

/** 선택을 <html>에 적용한다. 테스트에서는 dataset만 가진 가짜를 넘긴다 */
export function applyThemeChoice(root: { dataset: DOMStringMap }, choice: ThemeChoice): void {
  root.dataset.theme = choice
}
