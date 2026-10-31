// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import { axeViolations } from '@/test/axe'
import { PeriodDisclosures } from './PeriodDisclosures'

const disclosuresApi = vi.hoisted(() => ({ listDisclosures: vi.fn() }))
vi.mock('@/shared/api/disclosures', () => disclosuresApi)

const analysis: Analysis = {
  analysisId: 10,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  fsDiv: 'CFS',
  current: {
    rceptNo: '20260814000123',
    reportName: '반기보고서 (2026.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2026,
    periodEnd: '2026-06-30',
    receivedAt: '2026-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000123',
  },
  previous: {
    rceptNo: '20250814000001',
    reportName: '반기보고서 (2025.06)',
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: 2025,
    periodEnd: '2025-06-30',
    receivedAt: '2025-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000001',
  },
  status: 'COMPLETED',
  step: 'DONE',
  steps: [],
  error: null,
  createdAt: '2026-08-15T09:00:00Z',
  completedAt: '2026-08-15T09:02:00Z',
  textStatus: 'COMPLETED',
  textMessage: null,
  summaryStatus: 'COMPLETED',
  summaryMessage: null,
  analysisVersion: 'm2-15',
  outdated: false,
}

afterEach(cleanup)

function disclosure(reportName: string, receivedDate: string, group: string, rceptNo: string) {
  return {
    rceptNo,
    reportName,
    filerName: null,
    receivedDate,
    group,
    groupLabel: group,
    periodic: false,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
    keyItemsKind: null,
  }
}

describe('요약 탭 이 기간 수시공시(시안)', () => {
  it('기간 안 수시공시 건수와 많이 낸 제목, 지분 변동을 뺀 사실과 원문 링크를 보인다', async () => {
    disclosuresApi.listDisclosures.mockResolvedValue({
      corpCode: '00126380',
      days: 365,
      from: '2025-11-01',
      to: '2026-11-01',
      fetchedAt: null,
      refreshError: null,
      groups: [],
      items: [
        disclosure('연결재무제표기준영업(잠정)실적(공정공시)', '2026-07-07', 'BUSINESS', '20260707000001'),
        disclosure('연결재무제표기준영업(잠정)실적(공정공시)', '2026-04-07', 'BUSINESS', '20260407000001'),
        disclosure('임원ㆍ주요주주특정증권등소유상황보고서', '2026-05-02', 'OWNERSHIP', '20260502000001'),
      ],
    })
    const { container } = render(
      <MemoryRouter>
        <PeriodDisclosures analysis={analysis} />
      </MemoryRouter>,
    )
    const box = await screen.findByRole('region', { name: '이 기간 수시공시 2건' })
    const link = within(box).getByRole('link', { name: /연결재무제표기준영업\(잠정\)실적/ })
    expect(link.getAttribute('href')).toContain('rcpNo=20260707000001')
    expect(within(box).getByText('2건')).toBeTruthy()
    // 이전 보고서(2025-08-14)가 최근 1년 밖이라 받은 기간부터 셌다고 알린다
    expect(box.textContent).toContain('최근 1년만 셌어요')
    expect(box.textContent).toContain('지분 변동 1건은 빼고 셌어요')
    expect(box.textContent).toContain('인과관계는 확인되지 않았어요')
    expect(within(box).getByRole('link', { name: '기업 개요에서 공시 타임라인 보기' }).getAttribute('href')).toBe(
      '/companies/00126380?view=overview',
    )
    expect(await axeViolations(container)).toBe('')
  })

  it('공시 목록을 받지 못하면 다시 시도를 둔다', async () => {
    disclosuresApi.listDisclosures.mockRejectedValue(new Error('network'))
    render(
      <MemoryRouter>
        <PeriodDisclosures analysis={analysis} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
  })
})
