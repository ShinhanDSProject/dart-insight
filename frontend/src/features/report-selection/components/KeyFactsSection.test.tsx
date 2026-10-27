// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Executive, KeyFactGroup, KeyFacts, KeyFactSection, MajorShareholder } from '@/shared/api/keyFacts'
import { ApiError } from '@/shared/api/client'
import { axeViolations } from '@/test/axe'
import { KeyFactsSection } from './KeyFactsSection'

const getKeyFacts = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<KeyFacts>>()

vi.mock('@/shared/api/keyFacts', () => ({
  getKeyFacts: (corpCode: string, signal?: AbortSignal) => getKeyFacts(corpCode, signal),
}))

const CURRENT = '20260814003699'
const PREVIOUS = '20250814003156'

function section<T>(rceptNo: string, rows: T[]): KeyFactSection<T> {
  return { rceptNo, sourceRceptNo: null, status: 'AVAILABLE', settlementDate: '2026-06-30', rows }
}

function holder(name: string, endRatio: string): MajorShareholder {
  return {
    name,
    relation: '최대주주의 특수관계인',
    stockKind: '보통주',
    beginShares: null,
    beginRatio: null,
    endShares: null,
    endRatio,
    remark: null,
  }
}

function executive(name: string, position: string): Executive {
  return {
    name,
    position,
    registeredType: '사내이사',
    fullTime: '상근',
    duty: null,
    largestShareholderRelation: null,
    tenure: null,
    termEnd: '2029년 03월 17일',
  }
}

function facts(overrides: Partial<KeyFacts> = {}): KeyFacts {
  const executives: KeyFactGroup<Executive> = {
    current: section(CURRENT, [executive('전영현', '부회장'), executive('김용관', '사장')]),
    previous: section(PREVIOUS, [executive('전영현', '부회장'), executive('송재혁', '사장')]),
    changes: [
      { type: 'ADDED', name: '김용관', stockKind: null, field: 'position', before: null, after: '사장' },
      { type: 'REMOVED', name: '송재혁', stockKind: null, field: 'position', before: '사장', after: null },
    ],
  }
  return {
    corpCode: '00126380',
    current: {
      rceptNo: CURRENT,
      reportName: '반기보고서 (2026.06)',
      reportType: 'HALF',
      fiscalYear: 2026,
      periodEnd: '2026-06-30',
      dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${CURRENT}`,
    },
    previous: {
      rceptNo: PREVIOUS,
      reportName: '반기보고서 (2025.06)',
      reportType: 'HALF',
      fiscalYear: 2025,
      periodEnd: '2025-06-30',
      dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${PREVIOUS}`,
    },
    previousReason: null,
    majorShareholders: {
      current: section(CURRENT, [holder('이재용', '1.67')]),
      previous: section(PREVIOUS, [holder('이재용', '1.65')]),
      changes: [{ type: 'CHANGED', name: '이재용', stockKind: '보통주', field: 'endRatio', before: '1.65', after: '1.67' }],
    },
    executives,
    dividends: {
      current: { rceptNo: CURRENT, sourceRceptNo: null, status: 'NO_DATA', settlementDate: null, rows: [] },
      previous: { rceptNo: PREVIOUS, sourceRceptNo: null, status: 'NO_DATA', settlementDate: null, rows: [] },
      changes: [],
    },
    ...overrides,
  }
}

beforeEach(() => {
  getKeyFacts.mockReset()
})
afterEach(cleanup)

/** 세 묶음은 하나씩 고르므로(#385) 그 묶음 버튼을 누른다 */
function showGroup(title: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }))
}

describe('최대주주·임원·배당 변화', () => {
  it('세 묶음에 바뀐 항목을 기호와 글자로 먼저 보이고, 출처 보고서와 DART 링크를 둔다', async () => {
    getKeyFacts.mockResolvedValue(facts())
    render(<KeyFactsSection corpCode="00126380" />)

    const shareholders = await screen.findByRole('region', { name: '최대주주 현황' })
    const changes = within(shareholders).getByRole('list', { name: '최대주주 현황 바뀐 항목' })
    expect(changes.textContent).toContain('바뀜')
    expect(changes.textContent).toContain('이재용(보통주) 지분 1.65% → 1.67%')
    expect(within(shareholders).getByRole('table').textContent).toContain('1.65')

    expect(screen.getByRole('button', { name: '최대주주 현황 · 바뀜 1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('region', { name: '임원 현황' })).toBeNull()

    showGroup('임원 현황 · 바뀜 2')
    const executives = screen.getByRole('region', { name: '임원 현황' })
    expect(within(executives).getByText('새 임원: 김용관(사장)')).toBeTruthy()
    expect(within(executives).getByText('빠진 임원: 송재혁(사장)')).toBeTruthy()
    expect(within(executives).getByText('전체 보기 (2명)')).toBeTruthy()

    showGroup('배당에 관한 사항')
    const dividends = screen.getByRole('region', { name: '배당에 관한 사항' })
    expect(within(dividends).getByText('공시된 자료가 없어요')).toBeTruthy()

    const link = screen.getByRole('link', { name: '현재 반기보고서 (2026.06) DART 원문 새 창으로 열기' })
    expect(link.getAttribute('href')).toBe(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${CURRENT}`)
    expect(screen.getByRole('link', { name: '이전 반기보고서 (2025.06) DART 원문 새 창으로 열기' })).toBeTruthy()
    expect(getKeyFacts).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))
  })

  it('1년 전 값을 정정 공시에서 받았으면 정정 공시 값과 그 공시의 DART 링크를 보인다', async () => {
    const base = facts()
    const source = '20260324000822'
    getKeyFacts.mockResolvedValue(
      facts({
        majorShareholders: {
          ...base.majorShareholders,
          previous: { ...base.majorShareholders.previous!, sourceRceptNo: source },
        },
      }),
    )
    render(<KeyFactsSection corpCode="00126380" />)

    const shareholders = await screen.findByRole('region', { name: '최대주주 현황' })
    expect(within(shareholders).getByText(/1년 전 보고서: 정정 공시 값/)).toBeTruthy()
    const link = within(shareholders).getByRole('link', { name: `DART 원문 새 창으로 열기(접수번호 ${source})` })
    expect(link.getAttribute('href')).toBe(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${source}`)
    expect(within(shareholders).queryByText(/현재 보고서: 정정 공시 값/)).toBeNull()
    showGroup('임원 현황')
    const executives = screen.getByRole('region', { name: '임원 현황' })
    expect(within(executives).queryByText(/정정 공시 값/)).toBeNull()
  })

  it('1년 전 보고서가 없으면 현재 값만 보이고 비교하지 않은 이유를 적는다', async () => {
    const base = facts()
    getKeyFacts.mockResolvedValue(
      facts({
        previous: null,
        previousReason: { code: 'NO_BASE_REPORT', message: '비교 기준에 맞는 이전 보고서가 목록에 없습니다.' },
        majorShareholders: { ...base.majorShareholders, previous: null, changes: [] },
        executives: { ...base.executives, previous: null, changes: [] },
      }),
    )
    render(<KeyFactsSection corpCode="00126380" />)

    const shareholders = await screen.findByRole('region', { name: '최대주주 현황' })
    expect(within(shareholders).getByText('비교할 1년 전 보고서가 없어요.')).toBeTruthy()
    expect(within(shareholders).queryByRole('columnheader', { name: /1년 전/ })).toBeNull()
    expect(screen.getByText(/비교 기준에 맞는 이전 보고서가 목록에 없습니다/)).toBeTruthy()
  })

  it('받지 못한 묶음은 그 묶음만 안내하고 나머지는 보인다', async () => {
    const base = facts()
    getKeyFacts.mockResolvedValue(
      facts({
        executives: {
          ...base.executives,
          current: { rceptNo: CURRENT, sourceRceptNo: null, status: 'UNAVAILABLE', settlementDate: null, rows: [] },
          changes: [],
        },
      }),
    )
    render(<KeyFactsSection corpCode="00126380" />)

    expect(await screen.findByText('이재용(보통주) 지분 1.65% → 1.67%')).toBeTruthy()
    showGroup('임원 현황')
    const executives = screen.getByRole('region', { name: '임원 현황' })
    expect(within(executives).getByText('지금은 자료를 불러오지 못했어요')).toBeTruthy()
  })

  it('바뀐 항목이 많으면 5개만 먼저 보이고 더 보기로 펼친다', async () => {
    const base = facts()
    const many = Array.from({ length: 7 }, (_, n) => ({
      type: 'CHANGED' as const,
      name: `주주${n}`,
      stockKind: '보통주',
      field: 'endRatio',
      before: '1.00',
      after: '2.00',
    }))
    getKeyFacts.mockResolvedValue(facts({ majorShareholders: { ...base.majorShareholders, changes: many } }))
    render(<KeyFactsSection corpCode="00126380" />)

    const list = await screen.findByRole('list', { name: '최대주주 현황 바뀐 항목' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    const more = screen.getByRole('button', { name: '바뀐 항목 2개 더 보기' })
    expect(more.getAttribute('aria-controls')).toBe(list.id)
    fireEvent.click(more)
    expect(within(list).getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('button', { name: '바뀐 항목 접기' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('불러오지 못하면 오류와 다시 시도를 보인다', async () => {
    getKeyFacts.mockRejectedValue(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: 'OpenDART 호출 실패', traceId: 't1', errors: [] }))
    render(<KeyFactsSection corpCode="00126380" />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('접근성 위반이 없다', async () => {
    getKeyFacts.mockResolvedValue(facts())
    const { container } = render(<KeyFactsSection corpCode="00126380" />)
    await screen.findByRole('region', { name: '최대주주 현황' })
    expect(await axeViolations(container)).toBe('')
  })
})
