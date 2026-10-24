/**
 * 키보드 단축키(FS-17). 눌린 키와 지금 화면으로 할 일을 정한다(순수 함수).
 * 입력창에 글을 쓰는 중·한글 조합 중·Ctrl/Cmd/Alt 조합·다른 대화상자가 열렸을 때는 아무것도 하지 않는다(AC4).
 */

/** 분석 결과 화면의 탭 주소 값(?tab=). 1~5 키의 순서이고 결과 화면의 탭 순서와 같다 */
export const shortcutResultTabs = ['summary', 'financial', 'text', 'ask', 'source'] as const
export type ShortcutResultTab = (typeof shortcutResultTabs)[number]

/** 단축키 판단에 쓰는 화면. search: 기업 검색(/), result: 분석 결과, other: 그 밖 */
export type ShortcutPage = 'search' | 'result' | 'other'

export interface ShortcutContext {
  page: ShortcutPage
  /** 단축키 도움말이 열려 있는지 */
  helpOpen: boolean
  /** 도움말이 아닌 다른 대화상자(모달)가 열려 있는지 */
  otherDialogOpen: boolean
}

/** 초점이 있는 요소에서 판단에 필요한 것만 */
export interface ShortcutTarget {
  tagName?: string
  isContentEditable?: boolean
}

/** KeyboardEvent에서 판단에 필요한 것만 */
export interface ShortcutKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  isComposing: boolean
  repeat?: boolean
  target: ShortcutTarget | null
}

export type ShortcutAction =
  | { kind: 'focus-search' }
  | { kind: 'open-tab'; tab: ShortcutResultTab }
  | { kind: 'focus-ask' }
  | { kind: 'toggle-help' }

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** 글을 쓰는 곳(입력창·여러 줄 입력·고르기·편집 가능한 영역)인지 */
export function isEditableTarget(target: ShortcutTarget | null): boolean {
  if (target === null) return false
  return target.isContentEditable === true || editableTags.has((target.tagName ?? '').toUpperCase())
}

/** 한글 자판 상태에서 a 자리를 누르면 'ㅁ'이 온다 */
const askKeys = new Set(['a', 'ㅁ'])

/** 키에 맞는 할 일. 단축키가 아니거나 무시할 때는 null */
export function shortcutFor(event: ShortcutKeyEvent, context: ShortcutContext): ShortcutAction | null {
  // 조합 중의 키는 IME가 'Process'로 보내기도 한다
  if (event.isComposing || event.key === 'Process') return null
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.repeat === true) return null
  if (isEditableTarget(event.target)) return null
  if (context.otherDialogOpen) return null

  // 도움말이 열려 있으면 ?로 닫는 것만 받는다(Esc는 대화상자가 닫는다)
  if (context.helpOpen) return event.key === '?' ? { kind: 'toggle-help' } : null

  if (event.key === '?') return { kind: 'toggle-help' }
  if (event.key === '/') return { kind: 'focus-search' }
  if (context.page !== 'result') return null

  const index = ['1', '2', '3', '4', '5'].indexOf(event.key)
  if (index >= 0) return { kind: 'open-tab', tab: shortcutResultTabs[index] }
  if (askKeys.has(event.key)) return { kind: 'focus-ask' }
  return null
}

export interface ShortcutItem {
  /** 화면에 보이는 키(여러 개면 나란히) */
  keys: string[]
  label: string
}

export interface ShortcutGroup {
  id: 'anywhere' | 'result'
  title: string
  /** 지금 화면에서 쓸 수 있는지 */
  available: boolean
  items: ShortcutItem[]
}

/** 도움말에 보일 단축키 묶음. 지금 화면에서 쓸 수 있는 묶음을 먼저 둔다 */
export function shortcutGroups(page: ShortcutPage): ShortcutGroup[] {
  const anywhere: ShortcutGroup = {
    id: 'anywhere',
    title: '어느 화면에서나',
    available: true,
    items: [
      { keys: ['/'], label: page === 'search' ? '검색창으로 가기' : '기업 검색으로 가서 검색창으로 가기' },
      { keys: ['?'], label: '단축키 도움말 열기·닫기' },
      { keys: ['Esc'], label: '도움말 닫기' },
    ],
  }
  const result: ShortcutGroup = {
    id: 'result',
    title: '분석 결과 화면',
    available: page === 'result',
    items: [
      { keys: ['1'], label: '요약·설명 탭' },
      { keys: ['2'], label: '재무 수치 변화 탭' },
      { keys: ['3'], label: '문장·내용 변화 탭' },
      { keys: ['4'], label: 'AI 질문 탭' },
      { keys: ['5'], label: '원문 확인 탭' },
      { keys: ['A'], label: 'AI 질문 입력창으로 가기' },
    ],
  }
  return page === 'result' ? [result, anywhere] : [anywhere, result]
}
