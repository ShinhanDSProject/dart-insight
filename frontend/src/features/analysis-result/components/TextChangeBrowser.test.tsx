// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { TextChangeBrowser } from './TextChangeBrowser'

afterEach(cleanup)

function item(changeId: number): TextChangeItem {
  return {
    changeId,
    changeNo: changeId,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MODIFIED',
    sectionTitle: '1. 사업의 개요',
    sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
    previousSectionPath: null,
    previousPreview: '이전 문장이에요.',
    currentPreview: `바뀐 문장 ${changeId}이에요.`,
    similarity: 0.8,
    reviewReason: null,
    priority: null,
    riskRelated: false,
    listGroup: 'MAIN',
    field: 'BUSINESS',
    raisedFromNote: false,
    noteScope: null,
    rowDiff: null,
  }
}

interface Options {
  items: TextChangeItem[]
  index: number
  total: number
  onLoadMore?: () => void
  loadingMore?: boolean
}

function browser({ items, index, total, onLoadMore, loadingMore }: Options, onSelect: (changeId: number) => void) {
  return (
    <TextChangeBrowser
      items={items}
      total={total}
      grouped={false}
      detail={{ kind: 'item', item: items[index], index }}
      onSelect={onSelect}
      renderDetail={(shown) => <p>상세 {shown.changeId}</p>}
      onOpenOutside={() => {}}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
    />
  )
}

const next = () => screen.getByRole('button', { name: '다음 (j) ↓' }) as HTMLButtonElement

describe('바뀐 곳 상세의 이전·다음', () => {
  it('받아 둔 마지막 변경이어도 더 받을 것이 있으면 다음으로 다음 쪽을 불러오고, 오면 그 첫 변경으로 넘어간다', () => {
    const onSelect = vi.fn()
    const onLoadMore = vi.fn()
    const loaded = [item(1), item(2)]
    const view = render(browser({ items: loaded, index: 1, total: 3, onLoadMore }, onSelect))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(next().disabled).toBe(false)

    fireEvent.click(next())
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()

    view.rerender(browser({ items: loaded, index: 1, total: 3, onLoadMore, loadingMore: true }, onSelect))
    expect(next().disabled).toBe(true)

    view.rerender(browser({ items: [...loaded, item(3)], index: 1, total: 3, onLoadMore }, onSelect))
    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it('전체의 마지막 변경이면 다음을 누를 수 없다', () => {
    render(browser({ items: [item(1), item(2)], index: 1, total: 2, onLoadMore: vi.fn() }, vi.fn()))
    expect(next().disabled).toBe(true)
  })

  it('기다리는 사이 거르기가 바뀌어 다른 목록이 되면 넘어가지 않는다', () => {
    const onSelect = vi.fn()
    const onLoadMore = vi.fn()
    const view = render(browser({ items: [item(1), item(2)], index: 1, total: 3, onLoadMore }, onSelect))
    fireEvent.click(next())
    view.rerender(browser({ items: [item(7), item(8), item(9)], index: 1, total: 3, onLoadMore }, onSelect))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('다음 쪽을 받지 못하고 끝나면, 나중에 더 보기로 받아도 저절로 넘어가지 않는다', () => {
    const onSelect = vi.fn()
    const onLoadMore = vi.fn()
    const loaded = [item(1), item(2)]
    const view = render(browser({ items: loaded, index: 1, total: 3, onLoadMore }, onSelect))
    fireEvent.click(next())
    view.rerender(browser({ items: loaded, index: 1, total: 3, onLoadMore, loadingMore: true }, onSelect))
    view.rerender(browser({ items: loaded, index: 1, total: 3, onLoadMore }, onSelect))
    view.rerender(browser({ items: [...loaded, item(3)], index: 1, total: 3, onLoadMore }, onSelect))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
