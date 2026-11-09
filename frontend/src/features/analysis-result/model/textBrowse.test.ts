import { describe, expect, it } from 'vitest'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { canMergeChange, rowPreviewText, sectionRuns, textDetailOf } from './textBrowse'

function change(changeId: number, sectionPath: string, over: Partial<TextChangeItem> = {}): TextChangeItem {
  return {
    changeId,
    changeNo: changeId,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MODIFIED',
    sectionTitle: sectionPath,
    sectionPath,
    previousSectionPath: null,
    previousPreview: '이전 문장이에요.',
    currentPreview: '바뀐 문장이에요.',
    similarity: 0.8,
    reviewReason: null,
    priority: null,
    riskRelated: false,
    listGroup: 'MAIN',
    field: 'BUSINESS',
    raisedFromNote: false,
    noteScope: null,
    rowDiff: null,
    ...over,
  }
}

describe('sectionRuns', () => {
  it('이어진 같은 목차끼리 묶고, 떨어져 다시 나온 목차는 따로 묶는다', () => {
    const runs = sectionRuns([change(1, 'A'), change(2, 'A'), change(3, 'B'), change(4, 'A')])
    expect(runs.map((run) => [run.sectionPath, run.items.map((i) => i.changeId)])).toEqual([
      ['A', [1, 2]],
      ['B', [3]],
      ['A', [4]],
    ])
    expect(new Set(runs.map((run) => run.key)).size).toBe(3)
  })
})

describe('rowPreviewText', () => {
  it('현재 글을 먼저 쓰고 앞의 …와 줄바꿈을 뺀다', () => {
    expect(rowPreviewText({ previousPreview: '이전', currentPreview: '…새\n글' })).toBe('새 글')
    expect(rowPreviewText({ previousPreview: '빠진 글', currentPreview: null })).toBe('빠진 글')
    expect(rowPreviewText({ previousPreview: null, currentPreview: null })).toBe('')
  })
})

describe('textDetailOf', () => {
  const items = [change(1, 'A'), change(2, 'B')]

  it('아무것도 고르지 않으면 첫 변경, 고르면 그 변경을 보인다', () => {
    expect(textDetailOf(items, null, null)).toMatchObject({ kind: 'item', index: 0 })
    expect(textDetailOf(items, 2, null)).toMatchObject({ kind: 'item', index: 1 })
  })

  it('원문 비교 창으로 연 변경이 목록에 있으면 그것을 먼저 보인다', () => {
    expect(textDetailOf(items, 1, 2)).toMatchObject({ kind: 'item', index: 1 })
    expect(textDetailOf(items, 1, 99)).toMatchObject({ kind: 'item', index: 0 })
  })

  it('고른 변경이 목록에 없으면 목록 밖이라고 알리고, 목록이 비면 아무것도 보이지 않는다', () => {
    expect(textDetailOf(items, 99, null)).toEqual({ kind: 'outside', changeId: 99 })
    expect(textDetailOf([], null, null)).toEqual({ kind: 'none' })
  })
})

describe('canMergeChange', () => {
  it('수정된 문단만 합치고 표·추가·검토 필요는 합치지 않는다', () => {
    expect(canMergeChange(change(1, 'A'))).toBe(true)
    expect(canMergeChange(change(1, 'A', { blockType: 'TABLE' }))).toBe(false)
    expect(canMergeChange(change(1, 'A', { changeType: 'ADDED', previousPreview: null }))).toBe(false)
    expect(canMergeChange(change(1, 'A', { changeType: 'REVIEW_NEEDED' }))).toBe(false)
    expect(canMergeChange(change(1, 'A', { previousPreview: '전혀 다른 글', currentPreview: '완전히 새로운 문장' }))).toBe(false)
  })
})
