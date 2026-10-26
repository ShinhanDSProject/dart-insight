// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { DocumentOutline, SectionItem } from '@/shared/api/documents'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import { SourceTab } from './SourceTab'

afterEach(cleanup)

// 목차만 보려고 원문 훅은 고정된 목차를 돌려주고, 항목 본문은 불러오는 중으로 둔다
const outline = vi.hoisted(() => ({ data: null as DocumentOutline | null }))
vi.mock('../hooks/useDocument', () => ({
  useDocumentOutline: () => ({ state: { status: 'success', data: outline.data }, reload: () => {} }),
  useSection: () => ({ state: { status: 'loading' }, reload: () => {} }),
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

function renderTab(overrides: { onChange?: () => void; onOpenTextSection?: (s: string) => void; sectionCounts?: TextSectionCount[] } = {}) {
  return render(
    <SourceTab
      analysis={analysis}
      side="current"
      sectionNo={1}
      blockNo={null}
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
