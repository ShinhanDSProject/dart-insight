import { describe, expect, it } from 'vitest'
import {
  isEditableTarget,
  movedCardIndex,
  shortcutFor,
  shortcutGroups,
  textCardKeyFor,
  type ShortcutContext,
  type ShortcutKeyEvent,
  type TextCardContext,
} from './shortcuts'

function key(k: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return {
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    target: { tagName: 'BODY', isContentEditable: false },
    ...overrides,
  }
}

const search: ShortcutContext = { page: 'search', helpOpen: false, otherDialogOpen: false }
const result: ShortcutContext = { page: 'result', helpOpen: false, otherDialogOpen: false }
const other: ShortcutContext = { page: 'other', helpOpen: false, otherDialogOpen: false }

describe('shortcutFor 키 대응', () => {
  it('/는 어느 화면에서나 검색창으로 간다', () => {
    expect(shortcutFor(key('/'), search)).toEqual({ kind: 'focus-search' })
    expect(shortcutFor(key('/'), result)).toEqual({ kind: 'focus-search' })
    expect(shortcutFor(key('/'), other)).toEqual({ kind: 'focus-search' })
  })

  it('?는 어느 화면에서나 도움말을 연다', () => {
    expect(shortcutFor(key('?'), search)).toEqual({ kind: 'toggle-help' })
    expect(shortcutFor(key('?'), other)).toEqual({ kind: 'toggle-help' })
  })

  it('결과 화면에서 1~5는 탭 순서대로 간다', () => {
    expect(shortcutFor(key('1'), result)).toEqual({ kind: 'open-tab', tab: 'summary' })
    expect(shortcutFor(key('2'), result)).toEqual({ kind: 'open-tab', tab: 'financial' })
    expect(shortcutFor(key('3'), result)).toEqual({ kind: 'open-tab', tab: 'text' })
    expect(shortcutFor(key('4'), result)).toEqual({ kind: 'open-tab', tab: 'ask' })
    expect(shortcutFor(key('5'), result)).toEqual({ kind: 'open-tab', tab: 'source' })
  })

  it('결과 화면에서 6·0은 단축키가 아니다', () => {
    expect(shortcutFor(key('6'), result)).toBeNull()
    expect(shortcutFor(key('0'), result)).toBeNull()
  })

  it('결과 화면에서 a는 AI 질문 입력창으로 가고, 한글 자판의 ㅁ도 같다', () => {
    expect(shortcutFor(key('a'), result)).toEqual({ kind: 'focus-ask' })
    expect(shortcutFor(key('ㅁ'), result)).toEqual({ kind: 'focus-ask' })
  })

  it('Shift+A(대문자)는 단축키가 아니다', () => {
    expect(shortcutFor(key('A'), result)).toBeNull()
  })

  it('결과 화면이 아니면 숫자와 a는 무시한다', () => {
    expect(shortcutFor(key('1'), search)).toBeNull()
    expect(shortcutFor(key('a'), search)).toBeNull()
    expect(shortcutFor(key('3'), other)).toBeNull()
  })

  it('단축키가 아닌 키는 무시한다', () => {
    expect(shortcutFor(key('b'), result)).toBeNull()
    expect(shortcutFor(key('Enter'), result)).toBeNull()
  })
})

describe('shortcutFor 무시하는 경우', () => {
  it('입력창·여러 줄 입력·고르기·편집 영역에 초점이 있으면 무시한다', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shortcutFor(key('/', { target: { tagName } }), search)).toBeNull()
      expect(shortcutFor(key('1', { target: { tagName } }), result)).toBeNull()
      expect(shortcutFor(key('?', { target: { tagName } }), result)).toBeNull()
    }
    expect(shortcutFor(key('a', { target: { tagName: 'DIV', isContentEditable: true } }), result)).toBeNull()
  })

  it('버튼에 초점이 있을 때는 단축키가 동작한다', () => {
    expect(shortcutFor(key('2', { target: { tagName: 'BUTTON' } }), result)).toEqual({
      kind: 'open-tab',
      tab: 'financial',
    })
  })

  it('한글 조합 중이면 무시한다', () => {
    expect(shortcutFor(key('a', { isComposing: true }), result)).toBeNull()
    expect(shortcutFor(key('/', { isComposing: true }), search)).toBeNull()
    expect(shortcutFor(key('Process'), result)).toBeNull()
  })

  it('Ctrl·Cmd·Alt를 함께 누르면 무시한다', () => {
    expect(shortcutFor(key('1', { ctrlKey: true }), result)).toBeNull()
    expect(shortcutFor(key('a', { metaKey: true }), result)).toBeNull()
    expect(shortcutFor(key('/', { altKey: true }), search)).toBeNull()
    expect(shortcutFor(key('?', { metaKey: true }), search)).toBeNull()
  })

  it('키를 누르고 있어 반복되는 입력은 무시한다', () => {
    expect(shortcutFor(key('?', { repeat: true }), search)).toBeNull()
  })

  it('도움말이 아닌 대화상자가 열려 있으면 무시한다', () => {
    const ctx = { ...result, otherDialogOpen: true }
    expect(shortcutFor(key('1'), ctx)).toBeNull()
    expect(shortcutFor(key('?'), ctx)).toBeNull()
    expect(shortcutFor(key('/'), ctx)).toBeNull()
  })

  it('도움말이 열려 있으면 ?로 닫는 것만 받는다', () => {
    const ctx = { ...result, helpOpen: true }
    expect(shortcutFor(key('?'), ctx)).toEqual({ kind: 'toggle-help' })
    expect(shortcutFor(key('1'), ctx)).toBeNull()
    expect(shortcutFor(key('/'), ctx)).toBeNull()
    expect(shortcutFor(key('a'), ctx)).toBeNull()
  })

  it('초점이 있는 요소를 모르면(null) 글 쓰는 곳으로 보지 않는다', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(shortcutFor(key('/', { target: null }), search)).toEqual({ kind: 'focus-search' })
  })

  it('태그 이름이 소문자로 와도 입력창을 알아본다', () => {
    expect(isEditableTarget({ tagName: 'input' })).toBe(true)
  })
})

describe('shortcutGroups 도움말 목록', () => {
  it('결과 화면에서는 결과 화면 묶음을 먼저 두고 쓸 수 있다고 표시한다', () => {
    const groups = shortcutGroups('result')
    expect(groups.map((g) => g.id)).toEqual(['result', 'text', 'anywhere'])
    expect(groups.every((g) => g.available)).toBe(true)
  })

  it('결과 화면이 아니면 결과 화면 묶음을 뒤에 두고 쓸 수 없다고 표시한다', () => {
    const groups = shortcutGroups('search')
    expect(groups.map((g) => g.id)).toEqual(['anywhere', 'result', 'text'])
    expect(groups.find((g) => g.id === 'result')?.available).toBe(false)
    expect(groups.find((g) => g.id === 'text')?.available).toBe(false)
  })

  it('결과 화면 묶음은 탭 다섯 개와 AI 질문 입력창을 보여 준다', () => {
    const resultGroup = shortcutGroups('result').find((g) => g.id === 'result')
    expect(resultGroup?.items.map((i) => i.keys[0])).toEqual(['1', '2', '3', '4', '5', 'A'])
  })

  it('검색 화면에서는 /의 설명이 검색창으로 가기다', () => {
    const anywhere = shortcutGroups('search').find((g) => g.id === 'anywhere')
    expect(anywhere?.items[0]).toEqual({ keys: ['/'], label: '검색창으로 가기' })
  })
})

describe('shortcutGroups 문장 변화 묶음', () => {
  it('j·k·Enter·p를 보이고 문장·내용 변화 탭에서 쓴다고 늘 안내한다', () => {
    const text = shortcutGroups('result').find((g) => g.id === 'text')
    expect(text?.title).toBe('문장 변화')
    expect(text?.items.map((i) => i.keys)).toEqual([['J', '↓'], ['K', '↑'], ['Enter'], ['P']])
    expect(text?.note).toContain('문장·내용 변화 탭')
  })

  it('결과 화면에서는 결과 화면 묶음에 안내를 달지 않고, 다른 화면에서는 단다', () => {
    expect(shortcutGroups('result').find((g) => g.id === 'result')?.note).toBeNull()
    expect(shortcutGroups('search').find((g) => g.id === 'result')?.note).toBe('분석 결과 화면에서 쓸 수 있어요.')
  })
})

const onCard: TextCardContext = { focus: 'card', dialogOpen: false }
const insideCard: TextCardContext = { focus: 'inside-card', dialogOpen: false }
const offCard: TextCardContext = { focus: 'none', dialogOpen: false }

describe('textCardKeyFor 문장 변화 카드 키', () => {
  it('j는 다음 카드, k는 이전 카드로 가고 카드 밖에서도 받는다', () => {
    for (const ctx of [onCard, insideCard, offCard]) {
      expect(textCardKeyFor(key('j'), ctx)).toEqual({ kind: 'move', step: 1 })
      expect(textCardKeyFor(key('k'), ctx)).toEqual({ kind: 'move', step: -1 })
    }
  })

  it('한글 자판의 ㅓ·ㅏ·ㅔ는 j·k·p와 같다', () => {
    expect(textCardKeyFor(key('ㅓ'), onCard)).toEqual({ kind: 'move', step: 1 })
    expect(textCardKeyFor(key('ㅏ'), onCard)).toEqual({ kind: 'move', step: -1 })
    expect(textCardKeyFor(key('ㅔ'), onCard)).toEqual({ kind: 'toggle-pin' })
  })

  it('↓·↑와 Enter는 카드 자체에 초점이 있을 때만 받는다', () => {
    expect(textCardKeyFor(key('ArrowDown'), onCard)).toEqual({ kind: 'move', step: 1 })
    expect(textCardKeyFor(key('ArrowUp'), onCard)).toEqual({ kind: 'move', step: -1 })
    expect(textCardKeyFor(key('Enter'), onCard)).toEqual({ kind: 'toggle-evidence' })
    for (const ctx of [insideCard, offCard]) {
      expect(textCardKeyFor(key('ArrowDown'), ctx)).toBeNull()
      expect(textCardKeyFor(key('ArrowUp'), ctx)).toBeNull()
      expect(textCardKeyFor(key('Enter'), ctx)).toBeNull()
    }
  })

  it('p는 카드나 카드 안에 초점이 있을 때만 그 카드를 고정한다', () => {
    expect(textCardKeyFor(key('p'), onCard)).toEqual({ kind: 'toggle-pin' })
    expect(textCardKeyFor(key('p'), insideCard)).toEqual({ kind: 'toggle-pin' })
    expect(textCardKeyFor(key('p'), offCard)).toBeNull()
  })

  it('Shift를 함께 누른 대문자와 다른 키는 단축키가 아니다', () => {
    expect(textCardKeyFor(key('J'), onCard)).toBeNull()
    expect(textCardKeyFor(key('P'), onCard)).toBeNull()
    expect(textCardKeyFor(key('x'), onCard)).toBeNull()
  })
})

describe('textCardKeyFor 무시하는 경우', () => {
  it('입력창·편집 영역에 초점이 있으면 j·k·p를 글자로 둔다', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(textCardKeyFor(key('j', { target: { tagName } }), offCard)).toBeNull()
      expect(textCardKeyFor(key('p', { target: { tagName } }), insideCard)).toBeNull()
    }
    expect(textCardKeyFor(key('k', { target: { tagName: 'DIV', isContentEditable: true } }), offCard)).toBeNull()
  })

  it('한글 조합 중이면 무시한다', () => {
    expect(textCardKeyFor(key('ㅓ', { isComposing: true }), onCard)).toBeNull()
    expect(textCardKeyFor(key('Process'), onCard)).toBeNull()
  })

  it('Ctrl·Cmd·Alt를 함께 누르면 무시한다', () => {
    expect(textCardKeyFor(key('j', { ctrlKey: true }), onCard)).toBeNull()
    expect(textCardKeyFor(key('p', { metaKey: true }), onCard)).toBeNull()
    expect(textCardKeyFor(key('Enter', { altKey: true }), onCard)).toBeNull()
  })

  it('키를 누르고 있어 반복되는 입력은 무시한다', () => {
    expect(textCardKeyFor(key('j', { repeat: true }), onCard)).toBeNull()
  })

  it('대화상자가 열려 있으면 무시한다', () => {
    const ctx = { ...onCard, dialogOpen: true }
    expect(textCardKeyFor(key('j'), ctx)).toBeNull()
    expect(textCardKeyFor(key('Enter'), ctx)).toBeNull()
    expect(textCardKeyFor(key('p'), ctx)).toBeNull()
  })
})

describe('movedCardIndex 옮겨 갈 카드', () => {
  it('초점이 없으면 다음은 첫 카드로 가고 이전은 가지 않는다', () => {
    expect(movedCardIndex(null, 1, 3)).toBe(0)
    expect(movedCardIndex(null, -1, 3)).toBeNull()
  })

  it('다음·이전 카드로 한 칸씩 간다', () => {
    expect(movedCardIndex(0, 1, 3)).toBe(1)
    expect(movedCardIndex(2, -1, 3)).toBe(1)
  })

  it('처음과 끝에서는 그 자리에 둔다', () => {
    expect(movedCardIndex(0, -1, 3)).toBe(0)
    expect(movedCardIndex(2, 1, 3)).toBe(2)
  })

  it('카드가 없으면 가지 않는다', () => {
    expect(movedCardIndex(null, 1, 0)).toBeNull()
  })
})
