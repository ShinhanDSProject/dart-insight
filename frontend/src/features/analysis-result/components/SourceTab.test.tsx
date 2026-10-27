// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { DocumentOutline, SectionItem, SourceBlock } from '@/shared/api/documents'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import { SourceTab } from './SourceTab'

afterEach(() => {
  cleanup()
  sectionState.value = { status: 'loading' }
})

// 목차만 보려고 원문 훅은 고정된 목차를 돌려주고, 항목 본문은 불러오는 중으로 둔다
const outline = vi.hoisted(() => ({ data: null as DocumentOutline | null }))
const sectionState = vi.hoisted(() => ({ value: { status: 'loading' } as unknown }))
vi.mock('../hooks/useDocument', () => ({
  useDocumentOutline: () => ({ state: { status: 'success', data: outline.data }, reload: () => {} }),
  useSection: () => ({ state: sectionState.value, reload: () => {} }),
}))

const RCEPT_NO = '20250814000123'
const analysis = {
  analysisId: 16,
  current: { rceptNo: RCEPT_NO, reportName: '반기보고서 (2025.06)' },
  previous: { rceptNo: '20250515000456', reportName: '분기보고서 (2025.03)' },
} as Analysis

function section(sectionNo: number, depth: number, title: string, parentNo: number | null = null): SectionItem {
  return { sectionNo, parentNo, depth, title, cover: false, blockCount: 1 }
}

outline.data = {
  side: 'current',
  rceptNo: RCEPT_NO,
  reportName: '반기보고서 (2025.06)',
  documentStatus: 'STRUCTURED',
  statusMessage: null,
  dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${RCEPT_NO}`,
  positionLinkSupported: false,
  restructuredAfterAnalysis: false,
  sections: [
    section(1, 1, 'I. 회사의 개요'),
    section(2, 1, 'III. 재무에 관한 사항'),
    // 하위 항목은 제목이 같아도 배지를 달지 않는다(건수는 최상위 섹션에만 있다)
    section(3, 2, 'III. 재무에 관한 사항', 2),
    section(4, 1, 'IV. 이사의 경영진단 및 분석의견'),
  ],
}

const counts: TextSectionCount[] = [
  { title: 'I. 회사의 개요', count: 0 },
  { title: 'III. 재무에 관한 사항', count: 448 },
  { title: 'IV. 이사의 경영진단 및 분석의견', count: 7 },
]

function renderTab(
  overrides: { onChange?: () => void; onOpenTextSection?: (s: string) => void; sectionCounts?: TextSectionCount[]; blockNo?: number } = {},
) {
  return render(
    <SourceTab
      analysis={analysis}
      side="current"
      sectionNo={1}
      blockNo={overrides.blockNo ?? null}
      onChange={overrides.onChange ?? (() => {})}
      sectionCounts={overrides.sectionCounts ?? counts}
      onOpenTextSection={overrides.onOpenTextSection ?? (() => {})}
    />,
  )
}

describe('원문 확인 목차의 섹션별 변경 건수', () => {
  it('변경이 있는 최상위 항목 옆에 변경 건수 배지를 보이고 변경이 없는 항목에는 두지 않는다', () => {
    renderTab()
    const toc = screen.getByRole('navigation', { name: '문서 목차' })
    const badges = within(toc).getAllByRole('button', { name: /문장 변경 .*건 보기/ })
    expect(badges.map((b) => b.getAttribute('aria-label'))).toEqual([
      'III. 재무에 관한 사항 문장 변경 448건 보기',
      'IV. 이사의 경영진단 및 분석의견 문장 변경 7건 보기',
    ])
    expect(within(toc).getByText('변경 448')).not.toBeNull()
    expect(within(toc).queryByRole('button', { name: /I\. 회사의 개요 문장 변경/ })).toBeNull()
  })

  it('배지를 누르면 원래 섹션 제목으로 문장 탭을 열고 목차 항목은 그대로 원문을 연다', () => {
    const onChange = vi.fn()
    const onOpenTextSection = vi.fn()
    renderTab({ onChange, onOpenTextSection })
    fireEvent.click(screen.getByRole('button', { name: 'III. 재무에 관한 사항 문장 변경 448건 보기' }))
    expect(onOpenTextSection).toHaveBeenCalledWith('III. 재무에 관한 사항')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'III. 재무에 관한 사항' })[0])
    expect(onChange).toHaveBeenCalledWith({ section: 2, block: null })
    expect(onOpenTextSection).toHaveBeenCalledTimes(1)
  })

  it('배지 버튼은 목차 항목 버튼 안이 아니라 옆에 둔다', () => {
    renderTab()
    const badge = screen.getByRole('button', { name: 'III. 재무에 관한 사항 문장 변경 448건 보기' })
    expect(badge.parentElement?.closest('button')).toBeNull()
  })

  it('건수를 못 불러왔으면 배지 없이 목차만 보인다', () => {
    renderTab({ sectionCounts: [] })
    expect(screen.queryByRole('button', { name: /문장 변경 .*건 보기/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'I. 회사의 개요' })).not.toBeNull()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = renderTab()
    expect(await axeViolations(container)).toBe('')
  })
})

let blockSeq = 0
function para(text: string): SourceBlock {
  blockSeq += 1
  return { blockNo: blockSeq, evidenceId: `${RCEPT_NO}#B${blockSeq}`, type: 'PARAGRAPH', text, table: null }
}

/** 소제목 3개(각 15문단)가 있는 긴 항목 */
function longSection() {
  blockSeq = 0
  const blocks = ['1. 일반적 사항', '2. 회계정책', '3. 추정'].flatMap((title) => [
    para(title),
    ...Array.from({ length: 15 }, (_, i) => para(`${title} 본문 ${i}이에요.`)),
  ])
  sectionState.value = {
    status: 'success',
    data: { side: 'current', rceptNo: RCEPT_NO, sectionNo: 1, sectionPath: 'III. 재무에 관한 사항 > 3. 연결재무제표 주석', blocks },
  }
  return blocks
}

describe('원문 확인 긴 항목(#396)', () => {
  it('번호 소제목이 이어지는 긴 항목은 소제목 하나씩 보이고, 고르기와 이전·다음으로 넘긴다', () => {
    longSection()
    renderTab()
    const picker = screen.getByRole('combobox', { name: '소제목' }) as HTMLSelectElement
    expect([...picker.options].map((o) => o.textContent)).toEqual(['1. 일반적 사항', '2. 회계정책', '3. 추정'])
    expect(screen.getByText('1. 일반적 사항 본문 0이에요.')).toBeTruthy()
    expect(screen.queryByText('2. 회계정책 본문 0이에요.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /다음 소제목/ }))
    expect(screen.getByText('2. 회계정책 본문 0이에요.')).toBeTruthy()
    expect(screen.queryByText('1. 일반적 사항 본문 0이에요.')).toBeNull()

    fireEvent.change(picker, { target: { value: '2' } })
    expect(screen.getByText('3. 추정 본문 0이에요.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /다음 소제목/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('근거 위치에서 오면 그 블록이 든 소제목을 열고 강조한다', () => {
    const blocks = longSection()
    const target = blocks.find((b) => b.text === '3. 추정 본문 4이에요.')!
    renderTab({ blockNo: target.blockNo })
    expect((screen.getByRole('combobox', { name: '소제목' }) as HTMLSelectElement).value).toBe('2')
    expect(document.getElementById(`source-block-${target.blockNo}`)?.className).toContain('source-block--selected')
  })

  it('아주 높은 블록은 접어 두고 전체 보기로 펼친다', () => {
    sectionState.value = {
      status: 'success',
      data: { side: 'current', rceptNo: RCEPT_NO, sectionNo: 1, sectionPath: 'I. 회사의 개요', blocks: [para('아주 긴 문단이에요.')] },
    }
    // jsdom은 높이를 계산하지 않으므로 블록 본문이 600px보다 높은 것처럼 둔다
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('source-block__body') ? 1800 : 0
    })
    try {
      renderTab()
      const toggle = screen.getByRole('button', { name: '전체 보기' })
      const body = document.getElementById(toggle.getAttribute('aria-controls')!)!
      expect(body.className).toContain('source-block__body--collapsed')
      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(body.className).not.toContain('source-block__body--collapsed')
    } finally {
      scroll.mockRestore()
    }
  })
})
