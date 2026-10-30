// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { DocumentOutline, DocumentSide, SectionItem, SourceBlock } from '@/shared/api/documents'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import type { SourceViewChange } from '../model/resultParams'
import { SourceTab } from './SourceTab'

const RCEPT_NO = '20250814000123'
const PREV_RCEPT_NO = '20250515000456'

const defaultCurrentOutline: DocumentOutline = {
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

// 목차만 보려고 원문 훅은 고정된 목차를 돌려주고, 항목 본문은 불러오는 중으로 둔다
const outline = vi.hoisted(() => ({
  data: null as DocumentOutline | null,
  bySide: null as Record<DocumentSide, DocumentOutline> | null,
}))
const sectionState = vi.hoisted(() => ({ value: { status: 'loading' } as unknown }))
vi.mock('../hooks/useDocument', () => ({
  useDocumentOutline: (_analysisId: number, side: DocumentSide) => ({
    state: { status: 'success', data: outline.bySide ? outline.bySide[side] : outline.data },
    reload: () => {},
  }),
  useSection: () => ({ state: sectionState.value, reload: () => {} }),
}))

afterEach(() => {
  cleanup()
  outline.data = defaultCurrentOutline
  outline.bySide = null
  sectionState.value = { status: 'loading' }
})

const analysis = {
  analysisId: 16,
  corpName: '삼성전자',
  current: {
    rceptNo: RCEPT_NO,
    reportName: '반기보고서 (2025.06)',
    reportType: 'HALF',
    fiscalYear: 2025,
    periodEnd: '2025-06-30',
    receivedAt: '2025-08-14',
    correction: 'ORIGINAL',
  },
  previous: {
    rceptNo: PREV_RCEPT_NO,
    reportName: '분기보고서 (2025.03)',
    reportType: 'Q1',
    fiscalYear: 2025,
    periodEnd: '2025-03-31',
    receivedAt: '2025-05-15',
    correction: 'ORIGINAL',
  },
} as Analysis

function section(sectionNo: number, depth: number, title: string, parentNo: number | null = null): SectionItem {
  return { sectionNo, parentNo, depth, title, cover: false, blockCount: 1 }
}

outline.data = defaultCurrentOutline

const counts: TextSectionCount[] = [
  { title: 'I. 회사의 개요', count: 0 },
  { title: 'III. 재무에 관한 사항', count: 448 },
  { title: 'IV. 이사의 경영진단 및 분석의견', count: 7 },
]

function renderTab(
  overrides: {
    onChange?: (c: SourceViewChange) => void
    onOpenTextSection?: (s: string) => void
    sectionCounts?: TextSectionCount[]
    blockNo?: number
  } = {},
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

describe('원문 뷰어 머리(#550)', () => {
  it("제목 '관련 원문 위치'와 보고서 이름 줄을 두고, 근거 위치에서 오면 '주된 근거' 배지를 붙인다", () => {
    renderTab({ blockNo: 5 })
    expect(screen.getByRole('heading', { name: '관련 원문 위치' })).toBeTruthy()
    expect(document.querySelector('.source-report__name')?.textContent).toBe('반기보고서 (2025.06)')
    expect(document.querySelector('.source-report')?.textContent).toContain('제출일 2025.08.14')
    expect(screen.getByText('주된 근거')).toBeTruthy()
  })

  it('근거 위치 없이 열면 주된 근거 배지를 두지 않는다', () => {
    renderTab()
    expect(screen.queryByText('주된 근거')).toBeNull()
  })

  it('분석 결과로 돌아가기를 누르면 onBack을 부른다', () => {
    const onBack = vi.fn()
    render(
      <SourceTab
        analysis={analysis}
        side="current"
        sectionNo={1}
        blockNo={null}
        onChange={() => {}}
        sectionCounts={counts}
        onOpenTextSection={() => {}}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '분석 결과로 돌아가기' }))
    expect(onBack).toHaveBeenCalled()
  })
})

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

function table(rows: string[][]): SourceBlock {
  blockSeq += 1
  return {
    blockNo: blockSeq,
    evidenceId: `${RCEPT_NO}#B${blockSeq}`,
    type: 'TABLE',
    text: '',
    table: rows.map((row, r) => row.map((text) => ({ text, header: r === 0, colspan: 1, rowspan: 1 }))),
  }
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

function ControlledSourceTab({ initialSectionNo }: { initialSectionNo: number }) {
  const [side, setSide] = useState<DocumentSide>('current')
  const [sectionNo, setSectionNo] = useState<number | null>(initialSectionNo)
  const [blockNo, setBlockNo] = useState<number | null>(null)
  return (
    <SourceTab
      analysis={analysis}
      side={side}
      sectionNo={sectionNo}
      blockNo={blockNo}
      onChange={(c) => {
        if (c.side !== undefined) setSide(c.side)
        if (c.section !== undefined) setSectionNo(c.section)
        if (c.block !== undefined) setBlockNo(c.block)
      }}
      sectionCounts={counts}
      onOpenTextSection={() => {}}
    />
  )
}

describe('원문 확인 보고서 전환 시 목차 자동 매칭과 항목 내 검색(#523)', () => {
  it('보고서를 전환하면 반대편 보고서에서 같은 계층 경로의 목차를 자동으로 연다', () => {
    outline.bySide = {
      current: {
        ...defaultCurrentOutline,
        sections: [
          section(1, 1, 'I. 회사의 개요'),
          section(2, 1, 'III. 재무에 관한 사항'),
          section(5, 2, '3. 연결재무제표 주석', 2),
          section(6, 1, 'IV. 이사의 경영진단 및 분석의견'),
        ],
      },
      previous: {
        ...defaultCurrentOutline,
        side: 'previous',
        rceptNo: PREV_RCEPT_NO,
        reportName: '분기보고서 (2025.03)',
        sections: [
          section(10, 1, 'I. 회사의 개요'),
          section(20, 1, 'Ⅲ. 재무에 관한 사항'),
          section(28, 2, '4. 연결재무제표 주석', 20),
        ],
      },
    }

    render(<ControlledSourceTab initialSectionNo={5} />)
    fireEvent.click(screen.getByRole('button', { name: '비교 보고서' }))

    const matchedButton = screen.getByRole('button', { name: '4. 연결재무제표 주석' })
    expect(matchedButton.getAttribute('aria-current')).toBe('location')
  })

  it('반대편 보고서에 없는 목차를 보고 있다가 전환하면 첫 항목을 열고 안내 문구를 보인 뒤 목차를 고르면 안내를 닫는다', () => {
    outline.bySide = {
      current: defaultCurrentOutline,
      previous: {
        ...defaultCurrentOutline,
        side: 'previous',
        rceptNo: PREV_RCEPT_NO,
        reportName: '분기보고서 (2025.03)',
        sections: [
          section(10, 1, 'I. 회사의 개요'),
          section(20, 1, 'III. 재무에 관한 사항'),
        ],
      },
    }

    render(<ControlledSourceTab initialSectionNo={4} />)
    fireEvent.click(screen.getByRole('button', { name: '비교 보고서' }))

    expect(
      screen.getByText("선택한 'IV. 이사의 경영진단 및 분석의견' 항목은 이 보고서에서 찾지 못해 첫 항목을 열었어요."),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I. 회사의 개요' }).getAttribute('aria-current')).toBe('location')

    fireEvent.click(screen.getByRole('button', { name: 'III. 재무에 관한 사항' }))
    expect(
      screen.queryByText("선택한 'IV. 이사의 경영진단 및 분석의견' 항목은 이 보고서에서 찾지 못해 첫 항목을 열었어요."),
    ).toBeNull()
  })

  it('이 항목 안에서 찾기로 긴 항목의 다른 소제목 문단과 표 셀을 강조하고 이전·다음으로 이동한다', async () => {
    blockSeq = 0
    const blocks = [
      para('1. 일반적 사항'),
      ...Array.from({ length: 14 }, (_, i) => para(`일반 본문 ${i}이에요.`)),
      para('2. 회계정책'),
      ...Array.from({ length: 14 }, (_, i) => para(`회계정책 본문 ${i}이에요.`)),
      para('3. 우발부채와 약정사항'),
      para('진행 중인 소송 관련 우발부채 내역이에요.'),
      table([
        ['구분', '기말 금액'],
        ['우발부채 합계', '12,500'],
      ]),
      ...Array.from({ length: 12 }, (_, i) => para(`약정 본문 ${i}이에요.`)),
    ]
    sectionState.value = {
      status: 'success',
      data: {
        side: 'current',
        rceptNo: RCEPT_NO,
        sectionNo: 1,
        sectionPath: 'III. 재무에 관한 사항 > 3. 연결재무제표 주석',
        blocks,
      },
    }

    const { container } = renderTab()
    const searchInput = screen.getByLabelText('이 항목 안에서 찾기')
    fireEvent.change(searchInput, { target: { value: '우발부채' } })

    const picker = screen.getByRole('combobox', { name: '소제목' }) as HTMLSelectElement
    expect(picker.value).toBe('2')
    expect(screen.getByText('3건 일치 (1 / 3)')).toBeTruthy()

    const marks = container.querySelectorAll('mark.source-search__hit')
    expect(marks.length).toBe(3)

    fireEvent.click(screen.getByRole('button', { name: '다음 일치 위치' }))
    expect(screen.getByText('3건 일치 (2 / 3)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '다음 일치 위치' }))
    expect(screen.getByText('3건 일치 (3 / 3)')).toBeTruthy()

    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    expect(container.querySelectorAll('mark.source-search__hit').length).toBe(0)
  })
})
