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

// 다른 영역은 자기 테스트가 따로 있다. 여기서는 자리와 순서만 본다.
vi.mock('./CompanyBriefingSection', () => ({
  CompanyBriefingSection: ({ corpCode }: { corpCode: string }) => (
    <section aria-label="AI 기업 브리핑" data-section="briefing" data-corp-code={corpCode} />
  ),
}))
vi.mock('./CompanyAskSection', () => ({
  CompanyAskSection: ({ corpCode }: { corpCode: string }) => (
    <section aria-label="AI에게 묻기" data-section="ask" data-corp-code={corpCode} />
  ),
}))
vi.mock('./FinancialTrendSection', () => ({
  FinancialTrendSection: ({ corpCode }: { corpCode: string }) => (
    <section aria-label="주요 재무 흐름" data-section="financial-trends" data-corp-code={corpCode} />
  ),
}))
vi.mock('./KeyFactsSection', () => ({
  KeyFactsSection: ({ corpCode }: { corpCode: string }) => (
    <section aria-label="최대주주·임원·배당 변화" data-section="key-facts" data-corp-code={corpCode} />
  ),
}))
vi.mock('./DisclosureTimelineSection', () => ({
  DisclosureTimelineSection: ({ corpCode }: { corpCode: string }) => (
    <section aria-label="최근 공시" data-section="disclosures" data-corp-code={corpCode} />
  ),
}))

const company: Company = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }

function renderTab() {
  return render(
    <MemoryRouter>
      <CompanyOverviewTab corpCode="00126380" company={company} />
    </MemoryRouter>,
  )
}

function regionName(region: HTMLElement): string | null {
  const labelledBy = region.getAttribute('aria-labelledby')
  return region.getAttribute('aria-label') ?? (labelledBy ? document.getElementById(labelledBy)?.textContent ?? null : null)
}

function factValue(label: string): string | null {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? null
}

beforeEach(() => {
  getCompanyOverview.mockReset()
})
afterEach(cleanup)

describe('기업 개요 탭의 영역 순서', () => {
  it('정해 둔 순서대로 영역을 쌓고 각 영역에 고유번호를 넘긴다', async () => {
    getCompanyOverview.mockResolvedValue(samsungOverview)
    const { container } = renderTab()

    await screen.findByRole('region', { name: '기업 개황' })
    const names = screen.getAllByRole('region').map(regionName)
    expect(names).toEqual(['AI 기업 브리핑', '기업 개황', 'AI에게 묻기', '주요 재무 흐름', '최대주주·임원·배당 변화', '최근 공시'])
    const stubs = Array.from(container.querySelectorAll('[data-section]'))
    expect(stubs.every((el) => el.getAttribute('data-corp-code') === '00126380')).toBe(true)
  })
})

describe('기업 개요 바로 가기(#385)', () => {
  it('영역마다 바로 가기 링크를 같은 순서로 두고 처음엔 첫 영역을 지금 위치로 표시한다', async () => {
    getCompanyOverview.mockResolvedValue(samsungOverview)
    renderTab()
    await screen.findByRole('region', { name: '기업 개황' })

    const nav = screen.getByRole('navigation', { name: '기업 개요 바로 가기' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['AI 브리핑', '기업 개황', 'AI에게 묻기', '재무 흐름', '주주·임원·배당', '최근 공시'])
    expect(links[0].getAttribute('aria-current')).toBe('location')
    for (const link of links) {
      const id = link.getAttribute('href')!.slice(1)
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('바로 가기를 누르면 주소를 바꾸지 않고 그 영역으로 옮겨 초점을 둔다', async () => {
    getCompanyOverview.mockResolvedValue(samsungOverview)
    renderTab()
    await screen.findByRole('region', { name: '기업 개황' })
    const target = document.getElementById('overview-disclosures')!
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView

    const link = screen.getByRole('link', { name: '최근 공시' })
    const event = fireEvent.click(link)
    expect(event).toBe(false)
    expect(scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(target)
  })
})

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
