// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
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
  return { rceptNo, status: 'AVAILABLE', settlementDate: '2026-06-30', rows }
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
      current: { rceptNo: CURRENT, status: 'NO_DATA', settlementDate: null, rows: [] },
      previous: { rceptNo: PREVIOUS, status: 'NO_DATA', settlementDate: null, rows: [] },
      changes: [],
    },
    ...overrides,
  }
}

beforeEach(() => {
  getKeyFacts.mockReset()
})
afterEach(cleanup)

describe('최대주주·임원·배당 변화', () => {
  it('세 묶음에 바뀐 항목을 기호와 글자로 먼저 보이고, 출처 보고서와 DART 링크를 둔다', async () => {
    getKeyFacts.mockResolvedValue(facts())
    render(<KeyFactsSection corpCode="00126380" />)

    const shareholders = await screen.findByRole('region', { name: '최대주주 현황' })
    const changes = within(shareholders).getByRole('list', { name: '최대주주 현황 바뀐 항목' })
    expect(changes.textContent).toContain('바뀜')
    expect(changes.textContent).toContain('이재용(보통주) 지분 1.65% → 1.67%')
    expect(within(shareholders).getByRole('table').textContent).toContain('1.65')

    const executives = screen.getByRole('region', { name: '임원 현황' })
    expect(within(executives).getByText('새 임원: 김용관(사장)')).toBeTruthy()
    expect(within(executives).getByText('빠진 임원: 송재혁(사장)')).toBeTruthy()
    expect(within(executives).getByText('전체 보기 (2명)')).toBeTruthy()

    const dividends = screen.getByRole('region', { name: '배당에 관한 사항' })
    expect(within(dividends).getByText('공시된 자료가 없어요')).toBeTruthy()

    const link = screen.getByRole('link', { name: '현재 반기보고서 (2026.06) DART 원문 새 창으로 열기' })
    expect(link.getAttribute('href')).toBe(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${CURRENT}`)
    expect(screen.getByRole('link', { name: '이전 반기보고서 (2025.06) DART 원문 새 창으로 열기' })).toBeTruthy()
    expect(getKeyFacts).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))
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
          current: { rceptNo: CURRENT, status: 'UNAVAILABLE', settlementDate: null, rows: [] },
          changes: [],
        },
      }),
    )
    render(<KeyFactsSection corpCode="00126380" />)

    const executives = await screen.findByRole('region', { name: '임원 현황' })
    expect(within(executives).getByText('지금은 자료를 불러오지 못했어요')).toBeTruthy()
    expect(screen.getByText('이재용(보통주) 지분 1.65% → 1.67%')).toBeTruthy()
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
