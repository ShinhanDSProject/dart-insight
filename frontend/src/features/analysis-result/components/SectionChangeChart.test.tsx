// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { TextSectionCount } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import type { TextOverview } from '../model/overview'
import { SectionChangeChart } from './SectionChangeChart'

afterEach(cleanup)

const noop = () => {}

function loaded(sections: TextSectionCount[]): LoadState<TextOverview> {
  const all = sections.reduce((sum, s) => sum + s.count, 0)
  return {
    status: 'success',
    data: { status: 'available', all, added: all, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0, partial: false, sections },
  }
}

const many: TextSectionCount[] = [
  { title: '(목차 밖 본문)', count: 4 },
  { title: 'I. 회사의 개요', count: 12 },
  { title: 'II. 사업의 내용', count: 31 },
  { title: 'III. 재무에 관한 사항', count: 0 },
  { title: 'IV. 이사의 경영진단 및 분석의견', count: 9 },
  { title: 'V. 회계감사인의 감사의견 등', count: 2 },
  { title: 'VI. 이사회 등 회사의 기관에 관한 사항', count: 3 },
  { title: 'VII. 주주에 관한 사항', count: 5 },
  { title: 'VIII. 임원 및 직원 등에 관한 사항', count: 7 },
  { title: 'IX. 계열회사 등에 관한 사항', count: 1 },
  { title: 'X. 대주주 등과의 거래내용', count: 1 },
]

describe('섹션별 문장 변경 막대', () => {
  it('건수가 많은 순으로 8개까지 보이고 나머지는 그 밖 섹션으로 묶는다', () => {
    render(<SectionChangeChart state={loaded(many)} onOpenSection={noop} />)
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(8)
    expect(rows[0].getAttribute('aria-label')).toBe('II. 사업의 내용: 문장 변경 31건. 문장 탭에서 보기')
    expect(rows[1].getAttribute('aria-label')).toBe('I. 회사의 개요: 문장 변경 12건. 문장 탭에서 보기')
    expect(screen.getByText(/그 밖 2개 섹션 2건/)).not.toBeNull()
  })

  it('목차 밖 본문은 표시 이름으로 보이고 누르면 원래 제목으로 문장 탭을 거른다', () => {
    const onOpenSection = vi.fn()
    render(<SectionChangeChart state={loaded([{ title: '(목차 밖 본문)', count: 4 }])} onOpenSection={onOpenSection} />)
    fireEvent.click(screen.getByRole('button', { name: /표지·목차 앞 내용: 문장 변경 4건/ }))
    expect(onOpenSection).toHaveBeenCalledWith('(목차 밖 본문)')
    expect(screen.queryByText(/그 밖/)).toBeNull()
  })

  it('변경이 없거나 문장을 비교하지 못했거나 불러오지 못하면 그리지 않는다', () => {
    const apiError = new ApiError(503, { code: 'COMMON_INTERNAL', message: '오류', traceId: 't', errors: [] })
    const states: LoadState<TextOverview>[] = [
      loaded([]),
      loaded([{ title: 'I. 회사의 개요', count: 0 }]),
      { status: 'success', data: { status: 'unavailable' } },
      { status: 'error', error: apiError },
    ]
    for (const state of states) {
      const { container } = render(<SectionChangeChart state={state} onOpenSection={noop} />)
      expect(container.innerHTML).toBe('')
      cleanup()
    }
  })

  it('불러오는 중에는 제목과 함께 기다린다고 알린다', () => {
    render(<SectionChangeChart state={{ status: 'loading' }} onOpenSection={noop} />)
    expect(screen.getByRole('heading', { name: '섹션별 문장 변경' })).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
  })

  it('막대와 불러오는 중 상태에 접근성 위반이 없다', async () => {
    const { container } = render(
      <main>
        <SectionChangeChart state={loaded(many)} onOpenSection={noop} />
      </main>,
    )
    expect(await axeViolations(container)).toBe('')
    cleanup()
    const pending = render(
      <main>
        <SectionChangeChart state={{ status: 'loading' }} onOpenSection={noop} />
      </main>,
    )
    expect(await axeViolations(pending.container)).toBe('')
  })
})
