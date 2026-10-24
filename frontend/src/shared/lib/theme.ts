/**
 * 화면 테마(FS-16). 헤더에서 시스템·밝게·어둡게 중 하나를 고르고 브라우저(localStorage)에 남긴다.
 * '시스템'은 저장값을 지우고 <html>의 data-theme도 지워, tokens.css의 prefers-color-scheme가 정하게 한다.
 * index.html의 인라인 스크립트가 React보다 먼저 같은 키·값을 읽어 적용한다(깜빡임 방지). 키·값을 바꾸면 그쪽도 고친다.
 */
export const THEME_KEY = 'dart-insight:theme'
/** 같은 탭 안에서 테마를 바꿨다고 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const THEME_CHANGE_EVENT = 'dart-insight:theme-change'

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 저장된 글자를 선택으로 바꾼다. 'light'·'dark'가 아니면(없음·옛 값·잘못된 값) 시스템 */
export function parseThemeChoice(raw: string | null): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'system'
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

/** 밝게·어둡게는 남기고, 시스템이면 지운다. 저장했으면 true, 저장소가 없거나 실패하면 false */
export function saveThemeChoice(storage: ThemeStorage | null, choice: ThemeChoice): boolean {
  if (storage === null) return false
  try {
    if (choice === 'system') {
      storage.removeItem(THEME_KEY)
    } else {
      storage.setItem(THEME_KEY, choice)
    }
    return true
  } catch {
    return false
  }
}

/** <html data-theme>에 넣을 값. 시스템이면 null(속성을 지움) */
export function themeAttribute(choice: ThemeChoice): 'light' | 'dark' | null {
  return choice === 'system' ? null : choice
}

/** 선택을 <html>에 적용한다. 테스트에서는 dataset만 가진 가짜를 넘긴다 */
export function applyThemeChoice(root: { dataset: DOMStringMap }, choice: ThemeChoice): void {
  const attribute = themeAttribute(choice)
  if (attribute === null) {
    delete root.dataset.theme
  } else {
    root.dataset.theme = attribute
  }
}
