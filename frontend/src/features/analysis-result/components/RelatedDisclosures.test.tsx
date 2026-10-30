// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RelatedDisclosure, TextChangeRelatedDisclosures } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import { RelatedDisclosures } from './RelatedDisclosures'

// 관련 수시공시를 불러오는 훅만 바꿔 끼워 고정된 응답을 그리고, 몇 번 불렀는지와 다시 시도를 센다
const related = vi.hoisted(() => ({
  state: { status: 'loading' } as LoadState<TextChangeRelatedDisclosures>,
  calls: 0,
  reloads: 0,
}))
vi.mock('../hooks/useTextChanges', () => ({
  useRelatedDisclosures: () => {
    related.calls++
    return { state: related.state, reload: () => related.reloads++ }
  },
}))

afterEach(() => {
  cleanup()
  related.calls = 0
  related.reloads = 0
})

const NOTICE = '같은 기간에 공개된 관련 공시입니다. 변경의 원인을 뜻하지 않습니다.'

function item(rceptNo: string, overrides: Partial<RelatedDisclosure> = {}): RelatedDisclosure {
  return {
    rceptNo,
    latestRceptNo: rceptNo,
    reportName: `단일판매ㆍ공급계약체결 ${rceptNo}`,
    receivedDate: '2026-03-12',
    disclosureType: 'I001',
    timing: 'DURING',
    matchRule: 'supply-contract',
    matchRuleLabel: '공급계약',
    matchLevel: 'TYPE_ONLY',
    matchedFields: [],
    remarks: null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    ...overrides,
  }
}

function response(overrides: Partial<TextChangeRelatedDisclosures>): TextChangeRelatedDisclosures {
  return {
    analysisId: 2,
    changeId: 2585,
    status: 'FOUND',
    unavailableReason: null,
    partial: false,
    window: { from: '2025-06-30', periodEnd: '2026-06-30', to: '2026-08-14' },
    ruleVersion: 'related-2',
    computedAt: '2026-10-27T10:12:40',
    cached: false,
    items: [],
    notice: NOTICE,
    ...overrides,
  }
}

const strong = item('20260630000676', {
  latestRceptNo: '20261013000198',
  reportName: '주요사항보고서(유상증자결정)',
  receivedDate: '2026-06-30',
  disclosureType: 'B001',
  matchRule: 'equity-financing',
  matchRuleLabel: '자본 조달',
  matchLevel: 'STRONG',
  matchedFields: ['NEW_SHARES'],
  remarks: '정',
  dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261013000198',
})

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: '관련 수시공시(보조) 보기' }))
}

describe('RelatedDisclosures', () => {
  it('열기 전에는 관련 수시공시를 불러오지 않는다', () => {
    render(<RelatedDisclosures analysisId={2} changeId={2585} />)

    expect(related.calls).toBe(0)
    expect(screen.getByRole('button', { name: '관련 수시공시(보조) 보기' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('열면 불러오는 동안 로딩을 보여 준다', () => {
    render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(related.calls).toBeGreaterThan(0)
    expect(screen.getByRole('status').textContent).toContain('관련 수시공시를 찾는 중입니다')
  })

  it('찾은 공시를 보조 표시·기간 구분·연결 이유·최신 정정본 링크와 함께 보여 주고 고정 문구를 붙인다', async () => {
    related.state = {
      status: 'success',
      data: response({ items: [strong, item('20260801000001', { timing: 'AFTER', receivedDate: '2026-08-01' })] }),
    }
    const { container } = render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(screen.getByText('보조 근거 · 수시공시')).toBeTruthy()
    expect(screen.getByText('인과관계는 확인되지 않았습니다.')).toBeTruthy()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('주요사항보고서(유상증자결정)')
    expect(items[0].textContent).toContain('보고 기간 중')
    expect(items[0].textContent).toContain('내용 일치(신주 수)')
    expect(items[0].textContent).toContain('자본 조달')
    expect(items[0].textContent).toContain('2026.06.30')
    expect(items[0].textContent).toContain('최신 정정본')
    expect(items[1].textContent).toContain('기간 후~제출 전')
    expect(items[1].textContent).toContain('같은 종류')
    // 정정된 원본은 최신 정정본 원문을 연다
    expect(
      screen.getByRole('link', { name: '주요사항보고서(유상증자결정) DART 원문 새 창으로 열기' }).getAttribute('href'),
    ).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261013000198')
    expect(container.textContent).toContain(NOTICE)
    expect(container.textContent).not.toContain('AI 생성')
    expect(await axeViolations(container)).toBe('')
  })

  it('5건을 넘으면 나머지 같은 종류를 접었다가 더 보기로 편다', () => {
    const items = [strong, ...['1', '2', '3', '4', '5', '6'].map((n) => item(`2026010100000${n}`))]
    related.state = { status: 'success', data: response({ items }) }
    render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: '같은 종류 공시 2건 더 보기' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('button', { name: '같은 종류 공시 접기' })).toBeTruthy()
  })

  it('주요 정보를 받지 못했으면 같은 종류로만 보여 준다고 알린다', () => {
    related.state = { status: 'success', data: response({ partial: true, items: [item('20260101000001')] }) }
    const { container } = render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(container.textContent).toContain('같은 종류’로만 보여 줘요')
  })

  it('찾지 못했으면 찾지 못했다고만 말하고 공시가 없다고 단정하지 않는다', async () => {
    related.state = { status: 'success', data: response({ status: 'NOT_FOUND' }) }
    const { container } = render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(container.textContent).toContain('이 기간에 이 항목과 연결된 수시공시를 찾지 못했습니다.')
    expect(container.textContent).toContain('공시가 없다는 뜻은 아니에요')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(await axeViolations(container)).toBe('')
  })

  it('공시 목록을 불러오지 못했으면 안내와 다시 시도를 보여 준다', () => {
    related.state = {
      status: 'success',
      data: response({ status: 'UNAVAILABLE', unavailableReason: 'DART_RATE_LIMITED' }),
    }
    const { container } = render(<RelatedDisclosures analysisId={2} changeId={2585} />)
    openPanel()

    expect(container.textContent).toContain('공시 목록을 지금 불러오지 못했습니다.')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(related.reloads).toBe(1)
  })
})
