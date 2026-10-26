// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextChangeHistory } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import { TextHistory } from './TextHistory'

// 이력을 불러오는 훅만 바꿔 끼워 고정된 이력을 그리고, 몇 번 불렀는지 센다
const history = vi.hoisted(() => ({ state: { status: 'loading' } as LoadState<TextChangeHistory>, calls: 0 }))
vi.mock('../hooks/useTextChanges', () => ({
  useTextChangeHistory: () => {
    history.calls++
    return { state: history.state, reload: () => {} }
  },
}))

afterEach(() => {
  cleanup()
  history.calls = 0
})

const data: TextChangeHistory = {
  analysisId: 42,
  changeId: 3001,
  entries: [
    {
      report: { rceptNo: '20250515000001', reportName: '분기보고서 (2025.03)', reportType: 'Q1', periodEnd: '2025-03-31' },
      status: 'NOT_ANALYZED',
      text: null,
      sectionPath: null,
      evidenceId: null,
      change: null,
    },
    {
      report: { rceptNo: '20250814000001', reportName: '반기보고서 (2025.06)', reportType: 'HALF', periodEnd: '2025-06-30' },
      status: 'PRESENT',
      text: '당사는 메모리를 만듭니다.',
      sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
      evidenceId: '20250814000001#B41',
      change: null,
    },
    {
      report: { rceptNo: '20260814000001', reportName: '반기보고서 (2026.06)', reportType: 'HALF', periodEnd: '2026-06-30' },
      status: 'ABSENT',
      text: null,
      sectionPath: null,
      evidenceId: null,
      change: { analysisId: 42, changeId: 3001, changeType: 'DELETED' },
    },
  ],
}

describe('TextHistory', () => {
  it('열기 전에는 이력을 불러오지 않는다', () => {
    render(<TextHistory analysisId={42} changeId={3001} />)

    expect(history.calls).toBe(0)
    expect(screen.getByRole('button', { name: '여러 기간 이력 보기' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('열면 오래된 기간부터 상태와 근거 위치를 보여 주고 분석하지 않은 기간을 따로 표시한다', async () => {
    history.state = { status: 'success', data }
    const { container } = render(<TextHistory analysisId={42} changeId={3001} />)

    fireEvent.click(screen.getByRole('button', { name: '여러 기간 이력 보기' }))

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toContain('분석 안 됨')
    expect(items[0].textContent).toContain('알 수 없어요')
    expect(items[1].textContent).toContain('그대로')
    expect(items[1].textContent).toContain('당사는 메모리를 만듭니다.')
    expect(items[1].textContent).toContain('20250814000001#B41')
    expect(items[2].textContent).toContain('삭제')
    expect(items[2].textContent).toContain('이 보고서에는 이 글이 없어요.')
    expect(await axeViolations(container)).toBe('')
  })
})
