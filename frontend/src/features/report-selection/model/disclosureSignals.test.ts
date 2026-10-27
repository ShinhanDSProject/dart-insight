import { describe, expect, it } from 'vitest'
import type { DisclosureSignalKindCount, DisclosureSignals } from '@/shared/api/disclosureSignals'
import { kindLine, signalsView, unavailableLabels } from './disclosureSignals'

function kinds(overrides: Partial<Record<string, Pick<DisclosureSignalKindCount, 'status' | 'count'>>> = {}) {
  const base: [DisclosureSignalKindCount['kind'], string][] = [
    ['LARGEST_SHAREHOLDER_CHANGE', '최대주주 변경'],
    ['AUDITOR_CHANGE', '감사인 변경'],
  ]
  return base.map(([kind, label]) => ({ kind, label, status: 'CHECKED' as const, count: 0, ...overrides[kind] }))
}

function signals(overrides: Partial<DisclosureSignals> = {}): DisclosureSignals {
  return { corpCode: '00000001', from: '2025-10-27', to: '2026-10-27', kinds: kinds(), items: [], ...overrides }
}

describe('kindLine', () => {
  it('건수가 있으면 found, 0건이면 none으로 둔다', () => {
    expect(kindLine({ kind: 'LITIGATION', label: '소송 등 제기', status: 'CHECKED', count: 2 })).toEqual({
      status: 'found',
      kind: 'LITIGATION',
      label: '소송 등 제기',
      count: 2,
    })
    expect(kindLine({ kind: 'LITIGATION', label: '소송 등 제기', status: 'CHECKED', count: 0 }).status).toBe('none')
  })

  it('확인하지 못한 종류는 0건과 구분해 unavailable로 둔다', () => {
    expect(kindLine({ kind: 'AUDITOR_CHANGE', label: '감사인 변경', status: 'UNAVAILABLE', count: null }).status).toBe(
      'unavailable',
    )
  })
})

describe('signalsView', () => {
  it('해당 공시가 있으면 목록에 종류 이름을 붙인다', () => {
    const view = signalsView(
      signals({
        kinds: kinds({ LARGEST_SHAREHOLDER_CHANGE: { status: 'CHECKED', count: 1 } }),
        items: [
          {
            kind: 'LARGEST_SHAREHOLDER_CHANGE',
            rceptNo: '20261020900001',
            reportName: '최대주주변경',
            receivedDate: '2026-10-20',
            sentence: '최대주주가 바뀌었다고 공시했어요.',
            dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261020900001',
          },
        ],
      }),
    )
    expect(view.kind).toBe('list')
    expect(view.kind === 'list' && view.items[0].label).toBe('최대주주 변경')
  })

  it('모두 확인했고 해당 공시가 없으면 empty다', () => {
    expect(signalsView(signals()).kind).toBe('empty')
  })

  it('해당 공시가 없어도 확인하지 못한 종류가 있으면 없다고 하지 않는다', () => {
    const view = signalsView(signals({ kinds: kinds({ AUDITOR_CHANGE: { status: 'UNAVAILABLE', count: null } }) }))
    expect(view.kind).toBe('unchecked')
    expect(unavailableLabels(view.lines)).toEqual(['감사인 변경'])
  })
})
