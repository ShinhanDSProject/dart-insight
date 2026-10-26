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

/** 대화상자와 상관없이 단축키로 보지 않는 키(한글 조합 중·Ctrl/Cmd/Alt 조합·누르고 있는 반복·글 쓰는 곳) */
function ignoredKey(event: ShortcutKeyEvent): boolean {
  // 조합 중의 키는 IME가 'Process'로 보내기도 한다
  if (event.isComposing || event.key === 'Process') return true
  if (event.ctrlKey || event.metaKey || event.altKey) return true
  if (event.repeat === true) return true
  return isEditableTarget(event.target)
}

/** 한글 자판 상태에서 a 자리를 누르면 'ㅁ'이 온다 */
const askKeys = new Set(['a', 'ㅁ'])

/** 키에 맞는 할 일. 단축키가 아니거나 무시할 때는 null */
export function shortcutFor(event: ShortcutKeyEvent, context: ShortcutContext): ShortcutAction | null {
  if (ignoredKey(event)) return null
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

/** 문장 변화 카드 단축키(#311)에서 초점이 있는 곳. card: 카드 자체, inside-card: 카드 안의 버튼 등, none: 카드 밖 */
export type TextCardFocus = 'card' | 'inside-card' | 'none'

export interface TextCardContext {
  focus: TextCardFocus
  /** 대화상자(단축키 도움말 포함)가 열려 있는지 */
  dialogOpen: boolean
}

export type TextCardAction = { kind: 'move'; step: 1 | -1 } | { kind: 'toggle-evidence' } | { kind: 'toggle-pin' }

/** 한글 자판 상태에서 j·k·p 자리를 누르면 'ㅓ'·'ㅏ'·'ㅔ'가 온다 */
const nextCardKeys = new Set(['j', 'ㅓ'])
const prevCardKeys = new Set(['k', 'ㅏ'])
const pinKeys = new Set(['p', 'ㅔ'])

/**
 * 문장·내용 변화 탭의 카드 단축키(#311). 무시하는 경우는 shortcutFor와 같다(FS-17 AC4).
 * j·k는 어디서나 카드를 옮기고, p는 카드나 카드 안에 초점이 있을 때 그 카드를 고정한다.
 * 화살표와 Enter는 카드 자체에 초점이 있을 때만 받는다(그 밖에서는 화면 스크롤·버튼 누르기를 그대로 둔다).
 */
export function textCardKeyFor(event: ShortcutKeyEvent, context: TextCardContext): TextCardAction | null {
  if (ignoredKey(event) || context.dialogOpen) return null
  if (nextCardKeys.has(event.key)) return { kind: 'move', step: 1 }
  if (prevCardKeys.has(event.key)) return { kind: 'move', step: -1 }
  if (context.focus === 'none') return null
  if (pinKeys.has(event.key)) return { kind: 'toggle-pin' }
  if (context.focus !== 'card') return null
  if (event.key === 'ArrowDown') return { kind: 'move', step: 1 }
  if (event.key === 'ArrowUp') return { kind: 'move', step: -1 }
  if (event.key === 'Enter') return { kind: 'toggle-evidence' }
  return null
}

/**
 * 옮겨 갈 카드의 순서. current는 초점이 있는 카드(없으면 null)다.
 * 초점이 없으면 다음(j)은 첫 카드로 가고 이전(k)은 가지 않는다. 처음·끝에서는 그 자리에 둔다. 카드가 없으면 null
 */
export function movedCardIndex(current: number | null, step: 1 | -1, count: number): number | null {
  if (count <= 0) return null
  if (current === null) return step === 1 ? 0 : null
  return Math.min(Math.max(current + step, 0), count - 1)
}

export interface ShortcutItem {
  /** 화면에 보이는 키(여러 개면 나란히) */
  keys: string[]
  label: string
}

export interface ShortcutGroup {
  id: 'anywhere' | 'result' | 'text'
  title: string
  /** 지금 화면에서 쓸 수 있는지 */
  available: boolean
  /** 묶음 아래에 보일 쓸 수 있는 곳 안내. 지금 화면에서 그대로 쓸 수 있으면 null */
  note: string | null
  items: ShortcutItem[]
}

/** 도움말에 보일 단축키 묶음. 지금 화면에서 쓸 수 있는 묶음을 먼저 둔다 */
export function shortcutGroups(page: ShortcutPage): ShortcutGroup[] {
  const anywhere: ShortcutGroup = {
    id: 'anywhere',
    title: '어느 화면에서나',
    available: true,
    note: null,
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
    note: page === 'result' ? null : '분석 결과 화면에서 쓸 수 있어요.',
    items: [
      { keys: ['1'], label: '요약·설명 탭' },
      { keys: ['2'], label: '재무 수치 변화 탭' },
      { keys: ['3'], label: '문장·내용 변화 탭' },
      { keys: ['4'], label: 'AI 질문 탭' },
      { keys: ['5'], label: '원문 확인 탭' },
      { keys: ['A'], label: 'AI 질문 입력창으로 가기' },
    ],
  }
  const text: ShortcutGroup = {
    id: 'text',
    title: '문장 변화',
    available: page === 'result',
    // 결과 화면에서도 문장 변화 탭에서만 동작하므로 늘 안내한다
    note: '분석 결과의 문장·내용 변화 탭에서 쓸 수 있어요.',
    items: [
      { keys: ['J', '↓'], label: '다음 카드로 가기(↓는 카드에 초점이 있을 때)' },
      { keys: ['K', '↑'], label: '이전 카드로 가기(↑는 카드에 초점이 있을 때)' },
      { keys: ['Enter'], label: '초점이 있는 카드의 근거 열기·닫기' },
      { keys: ['P'], label: '초점이 있는 카드 고정·해제' },
    ],
  }
  return page === 'result' ? [result, text, anywhere] : [anywhere, result, text]
}
