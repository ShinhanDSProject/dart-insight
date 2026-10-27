import { describe, expect, it } from 'vitest'
import type { DisclosureItem } from '@/shared/api/disclosures'
import { chartPoints, chartRows, defaultChartView } from './disclosureChart'

function item(overrides: Partial<DisclosureItem>): DisclosureItem {
  return {
    rceptNo: '20260814002000',
    reportName: '반기보고서 (2026.06)',
    filerName: '삼성전자',
    receivedDate: '2026-08-14',
    group: 'PERIODIC',
    groupLabel: '정기보고서',
    periodic: true,
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814002000',
    remarks: null,
    keyItemsKind: null,
    ...overrides,
  }
}

describe('공시 타임라인 차트 자료', () => {
  it('묶음 줄은 서버가 준 순서 그대로이고 0건 줄도 남긴다', () => {
    expect(
      chartRows([
        { group: 'PERIODIC', label: '정기보고서', count: 1 },
        { group: 'OWNERSHIP', label: '지분 변동', count: 0 },
      ]),
    ).toEqual([
      { key: 'PERIODIC', label: '정기보고서', count: 1 },
      { key: 'OWNERSHIP', label: '지분 변동', count: 0 },
    ])
  })

  it('정기보고서는 강조 점이고 툴팁에 이 보고서로 비교하기 주소를 둔다', () => {
    const [point] = chartPoints('00126380', [item({})])
    expect(point).toEqual({
      id: '20260814002000',
      row: 'PERIODIC',
      date: '2026-08-14',
      title: '반기보고서 (2026.06)',
      href: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814002000',
      emphasis: true,
      action: { label: '이 보고서로 비교하기', to: '/companies/00126380?current=20260814002000' },
    })
  })

  it('정기보고서가 아니면 비교 동작이 없고, 원문 주소가 접수번호와 다르면 링크를 걸지 않는다', () => {
    const [point] = chartPoints('00126380', [
      item({
        rceptNo: '20261026000017',
        group: 'OWNERSHIP',
        groupLabel: '지분 변동',
        periodic: false,
        dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20990101000000',
      }),
    ])
    expect(point.href).toBeNull()
    expect(point.emphasis).toBe(false)
    expect(point.action).toBeUndefined()
  })

  it('좁은 화면은 표로 시작한다', () => {
    expect(defaultChartView(true)).toBe('table')
    expect(defaultChartView(false)).toBe('chart')
  })
})
