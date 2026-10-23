import { describe, expect, it } from 'vitest'
import type { TextChangeItem, TextChangeList } from '@/shared/api/textChanges'
import { textListReducer, type TextListState } from './textList'

const item = (changeId: number) => ({ changeId }) as TextChangeItem
const page = (n: number, ids: number[]): TextChangeList =>
  ({ page: n, totalItems: 4, items: ids.map(item) }) as unknown as TextChangeList

const loading: TextListState = { status: 'loading' }
const firstPage = textListReducer(loading, { type: 'load-success', data: page(0, [1, 2]) })

describe('textListReducer', () => {
  it('첫 쪽을 받으면 목록을 보여 준다', () => {
    expect(firstPage).toEqual({ status: 'success', data: page(0, [1, 2]), items: [item(1), item(2)], more: { status: 'idle' } })
  })

  it('첫 쪽을 받지 못하면 오류를 보여 주고, 다시 시도하면 불러오는 중이 된다', () => {
    const failed = textListReducer(loading, { type: 'load-failure', error: 'x' })
    expect(failed).toEqual({ status: 'error', error: 'x' })
    expect(textListReducer(failed, { type: 'load-start' })).toEqual(loading)
  })

  it('더 보기로 받은 쪽은 지금 목록 뒤에 붙인다', () => {
    const more = textListReducer(firstPage, { type: 'more-start' })
    expect(more).toMatchObject({ more: { status: 'loading' }, items: [item(1), item(2)] })
    const next = textListReducer(more, { type: 'more-success', data: page(1, [3, 4]) })
    expect(next).toEqual({ status: 'success', data: page(1, [3, 4]), items: [1, 2, 3, 4].map(item), more: { status: 'idle' } })
  })

  it('더 보기가 실패하면 목록은 두고 오류만 남기며, 다시 누르면 다시 불러온다', () => {
    const more = textListReducer(firstPage, { type: 'more-start' })
    const failed = textListReducer(more, { type: 'more-failure', error: 'net' })
    expect(failed).toMatchObject({ items: [item(1), item(2)], more: { status: 'error', error: 'net' } })
    expect(textListReducer(failed, { type: 'more-start' })).toMatchObject({ more: { status: 'loading' } })
  })

  it('더 보기 중에는 다시 더 보기를 시작하지 않는다', () => {
    const more = textListReducer(firstPage, { type: 'more-start' })
    expect(textListReducer(more, { type: 'more-start' })).toBe(more)
  })

  it('거르기·정렬을 바꿔 다시 불러오는 중에 늦게 온 더 보기 응답은 버린다', () => {
    const more = textListReducer(firstPage, { type: 'more-start' })
    const reloading = textListReducer(more, { type: 'load-start' })
    expect(textListReducer(reloading, { type: 'more-success', data: page(1, [3]) })).toBe(reloading)
    expect(textListReducer(reloading, { type: 'more-failure', error: 'x' })).toBe(reloading)
  })

  it('목록을 받은 뒤 늦게 온 첫 쪽 응답은 버린다', () => {
    expect(textListReducer(firstPage, { type: 'load-success', data: page(0, [9]) })).toBe(firstPage)
  })
})
