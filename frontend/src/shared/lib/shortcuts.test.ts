import { describe, expect, it } from 'vitest'
import {
  isEditableTarget,
  shortcutFor,
  shortcutGroups,
  type ShortcutContext,
  type ShortcutKeyEvent,
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
    expect(groups.map((g) => g.id)).toEqual(['result', 'anywhere'])
    expect(groups.every((g) => g.available)).toBe(true)
  })

  it('결과 화면이 아니면 결과 화면 묶음을 뒤에 두고 쓸 수 없다고 표시한다', () => {
    const groups = shortcutGroups('search')
    expect(groups.map((g) => g.id)).toEqual(['anywhere', 'result'])
    expect(groups.find((g) => g.id === 'result')?.available).toBe(false)
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
