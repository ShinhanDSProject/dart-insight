// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { Company, CompanyOverview } from '@/shared/api/companies'
import { axeViolations } from '@/test/axe'
import { samsungOverview } from '@/test/fixtures/companyOverview'
import { CompanyOverviewTab } from './CompanyOverviewTab'

const getCompanyOverview = vi.fn<(corpCode: string, signal?: AbortSignal) => Promise<CompanyOverview>>()

vi.mock('@/shared/api/companies', () => ({
  getCompanyOverview: (corpCode: string, signal?: AbortSignal) => getCompanyOverview(corpCode, signal),
}))

const company: Company = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }

function renderTab() {
  return render(
    <MemoryRouter>
      <CompanyOverviewTab corpCode="00126380" company={company} />
    </MemoryRouter>,
  )
}

function factValue(label: string): string | null {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? null
}

beforeEach(() => {
  getCompanyOverview.mockReset()
})
afterEach(cleanup)

describe('기업 개요 탭의 기업 개황 카드', () => {
  it('OpenDART 개황 값을 그대로 보여 주고 출처와 받은 날짜를 적는다', async () => {
    getCompanyOverview.mockResolvedValue(samsungOverview)
    const { container } = renderTab()

    const card = await screen.findByRole('region', { name: '기업 개황' })
    expect(factValue('정식명칭')).toBe('삼성전자(주)')
    expect(factValue('대표자')).toBe('전영현, 노태문')
    expect(factValue('법인구분')).toBe('유가증권시장')
    expect(factValue('설립일')).toBe('1969.01.13')
    expect(factValue('결산월')).toBe('12월')
    expect(factValue('주소')).toBe('경기도 수원시 영통구  삼성로 129 (매탄동)')
    expect(factValue('IR 홈페이지')).toBe('공시에 없음')
    const homepage = within(card).getByRole('link', { name: /www\.samsung\.com\/sec/ })
    expect(homepage.getAttribute('href')).toBe('http://www.samsung.com/sec')
    expect(homepage.getAttribute('target')).toBe('_blank')
    expect(within(card).getByText('출처: OpenDART 기업개황 · 2026.10.26 받음')).toBeTruthy()
    expect(getCompanyOverview).toHaveBeenCalledWith('00126380', expect.any(AbortSignal))
    expect(await axeViolations(container)).toBe('')
  })

  it('다시 받지 못해 저장된 개황을 보여 주면 그 사실과 받은 날짜를 알린다', async () => {
    getCompanyOverview.mockResolvedValue({ ...samsungOverview, refreshError: 'DART_RATE_LIMITED' })
    renderTab()

    const notice = await screen.findByText(/OpenDART 호출 한도를 넘었어요/)
    expect(notice.textContent).toBe('OpenDART 호출 한도를 넘었어요. 2026.10.26에 받아 둔 개황을 보여 줘요.')
    expect(notice.getAttribute('role')).toBe('status')
    expect(factValue('대표자')).toBe('전영현, 노태문')
  })

  it('OpenDART에 자료가 없으면(013) 빈 결과 안내를 보여 준다', async () => {
    getCompanyOverview.mockResolvedValue({
      ...samsungOverview,
      available: false,
      corpName: null,
      ceoName: null,
      corpClass: null,
      establishedDate: null,
      accountingMonth: null,
      homepageUrl: null,
      address: null,
      phoneNumber: null,
    })
    const { container } = renderTab()

    expect(await screen.findByText('OpenDART에 이 기업의 개황 자료가 없어요.')).toBeTruthy()
    expect(screen.queryByText('대표자')).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('OpenDART 오류면 코드별 안내와 다시 시도 버튼을 보여 주고, 다시 시도하면 다시 부른다', async () => {
    getCompanyOverview
      .mockRejectedValueOnce(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: 'x', traceId: 'trace-1', errors: [] }))
      .mockResolvedValueOnce(samsungOverview)
    const { container } = renderTab()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('OpenDART에서 기업 개황을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('전영현, 노태문')).toBeTruthy()
    expect(getCompanyOverview).toHaveBeenCalledTimes(2)
  })
})
