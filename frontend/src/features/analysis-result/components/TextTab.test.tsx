// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem, TextChangeList } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import { TextTab } from './TextTab'

// 카드 키보드 검토(#311)만 보도록 목록·고정·풀이 훅을 바꿔 끼운다
const pins = vi.hoisted(() => ({ toggle: vi.fn(), ids: [] as number[] }))
const list = vi.hoisted(() => ({ items: [] as TextChangeItem[] }))
vi.mock('../hooks/useTextChanges', () => ({
  useTextChanges: () => ({
    state: {
      status: 'success',
      data: { page: 0, totalItems: list.items.length, items: list.items } as unknown as TextChangeList,
      items: list.items,
      more: { status: 'idle' },
    },
    counts: null,
    sections: [],
    contentAvailable: false,
    type: null,
    reload: () => {},
    loadMore: () => {},
  }),
}))
vi.mock('../hooks/usePinnedChanges', () => ({
  usePinnedChanges: () => ({
    ids: pins.ids,
    isPinned: (id: number) => pins.ids.includes(id),
    toggle: pins.toggle,
    remove: () => {},
  }),
  usePinnedTextChanges: () => ({ view: { status: 'success', items: [] }, reload: () => {} }),
}))
vi.mock('../hooks/useTextExplanations', () => ({
  useTextExplanations: () => ({ request: () => {}, entryOf: () => undefined }),
}))

beforeAll(() => {
  // jsdom에는 scrollIntoView가 없다
  Element.prototype.scrollIntoView = vi.fn()
})
beforeEach(() => {
  pins.toggle.mockReset()
  pins.ids = []
})
afterEach(cleanup)

const report = (rceptNo: string, reportName: string) => ({ rceptNo, reportName, reportType: 'ANNUAL', fiscalYear: 2024 })
const analysis = {
  analysisId: 16,
  textStatus: 'COMPLETED',
  textMessage: null,
  previous: report('20240314000100', '사업보고서 (2023.12)'),
  current: report('20250314000100', '사업보고서 (2024.12)'),
} as unknown as Analysis

function item(changeId: number, sectionTitle: string): TextChangeItem {
  return {
    changeId,
    changeNo: changeId,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MODIFIED',
    sectionTitle,
    sectionPath: `II. 사업의 내용 > ${sectionTitle}`,
    previousSectionPath: null,
    previousPreview: '이전 문장이에요.',
    currentPreview: '바뀐 문장이에요.',
    similarity: 0.8,
    reviewReason: null,
    priority: null,
  }
}

function renderTab(onChange = vi.fn()) {
  list.items = [item(1, '1. 사업의 개요'), item(2, '2. 주요 제품'), item(3, '3. 원재료')]
  const view = render(
    <main>
      <TextTab
        analysis={analysis}
        type={null}
        sort="priority"
        section={null}
        q={null}
        pinned={false}
        selectedChangeId={null}
        onChange={onChange}
        onOpenSource={() => {}}
        onAsk={() => {}}
        asking={false}
      />
    </main>,
  )
  const cards = screen.getAllByRole('article')
  return { ...view, cards, onChange }
}

/** 지금 초점이 있는 곳에서 키를 누른다(문서까지 올라가 단축키가 받는다) */
function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key })
}

describe('TextTab 카드 키보드 검토', () => {
  it('카드에 초점이 없으면 j로 첫 카드에 가고, j·k로 다음·이전 카드로 옮긴다', () => {
    const { cards } = renderTab()
    press('j')
    expect(document.activeElement).toBe(cards[0])
    press('j')
    press('ㅓ')
    expect(document.activeElement).toBe(cards[2])
    press('k')
    expect(document.activeElement).toBe(cards[1])
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('카드에 초점이 있으면 ↓·↑로도 옮긴다', () => {
    const { cards } = renderTab()
    press('j')
    press('ArrowDown')
    expect(document.activeElement).toBe(cards[1])
    press('ArrowUp')
    expect(document.activeElement).toBe(cards[0])
  })

  it('카드에서 Enter를 누르면 그 카드의 근거를 연다', () => {
    const { onChange } = renderTab()
    press('j')
    press('j')
    press('Enter')
    expect(onChange).toHaveBeenCalledWith({ change: 2 })
  })

  it('카드 안 버튼에서 누른 Enter는 단축키로 받지 않는다', () => {
    const { cards, onChange } = renderTab()
    const button = cards[0].querySelector('button.change-card__explain') as HTMLButtonElement
    button.focus()
    press('Enter')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('p를 누르면 초점이 있는 카드를 고정하고, 카드 안 버튼에 있어도 그 카드를 고정한다', () => {
    const { cards } = renderTab()
    press('j')
    press('p')
    expect(pins.toggle).toHaveBeenLastCalledWith(1)
    ;(cards[2].querySelector('button') as HTMLButtonElement).focus()
    press('ㅔ')
    expect(pins.toggle).toHaveBeenLastCalledWith(3)
  })

  it('문장 검색 입력창에서 j·p를 치면 카드를 옮기거나 고정하지 않는다', () => {
    renderTab()
    const input = screen.getByLabelText('문장 검색')
    input.focus()
    press('j')
    press('p')
    expect(document.activeElement).toBe(input)
    expect(pins.toggle).not.toHaveBeenCalled()
  })

  it('카드에 초점이 있는 상태에서도 접근성 위반이 없다', async () => {
    const { container } = renderTab()
    press('j')
    expect(await axeViolations(container)).toBe('')
  })
})

describe('TextTab 문단 줄이기(#390)', () => {
  it('문단이 3줄을 넘어 잘리면 문단 펼치기를 두고, 누르면 전체를 보였다가 다시 접는다', () => {
    // jsdom은 높이를 계산하지 않으므로 글 상자가 잘린 것처럼 높이를 준다
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('change-side__body') ? 120 : 0
    })
    const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('change-side__body') ? 72 : 0
    })
    try {
      const { cards } = renderTab()
      const expand = cards[0].querySelector<HTMLButtonElement>('.change-card__expand')!
      expect(expand.textContent).toBe('문단 펼치기')
      expect(expand.getAttribute('aria-expanded')).toBe('false')
      const sides = document.getElementById(expand.getAttribute('aria-controls')!)!
      expect(sides.classList.contains('change-card__sides--clamped')).toBe(true)

      fireEvent.click(expand)
      expect(expand.textContent).toBe('문단 접기')
      expect(expand.getAttribute('aria-expanded')).toBe('true')
      expect(sides.classList.contains('change-card__sides--clamped')).toBe(false)
    } finally {
      scroll.mockRestore()
      client.mockRestore()
    }
  })

  it('문단이 잘리지 않으면 문단 펼치기를 두지 않는다', () => {
    const { cards } = renderTab()
    expect(cards[0].querySelector('.change-card__expand')).toBeNull()
  })
})
