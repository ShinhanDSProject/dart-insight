// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOOKUP_DELAY_MS } from '@/shared/hooks/useCompanyLookup'
import { RECENT_ANALYSES_KEY } from '@/shared/lib/recentAnalyses'
import { HeaderSearch } from './HeaderSearch'

const searchCompanies = vi.hoisted(() => vi.fn())
// 좁은 화면에서 검색창을 감싼 메뉴(Layout)의 키 처리
const onParentKeyDown = vi.fn()
vi.mock('@/shared/api/companies', () => ({ searchCompanies }))

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/companies/00149293']}>
      <div onKeyDown={onParentKeyDown}>
        <HeaderSearch companyName="신한은행" />
      </div>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function type(text: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: '회사명 또는 종목코드' }), { target: { value: text } })
  await act(async () => {
    vi.advanceTimersByTime(LOOKUP_DELAY_MS)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  searchCompanies.mockReset()
  onParentKeyDown.mockReset()
  searchCompanies.mockResolvedValue({
    items: [
      { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
      { corpCode: '00126371', corpName: '삼성전기', stockCode: '009150', listed: true },
    ],
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
})

describe('HeaderSearch 기업 목록(#655)', () => {
  it('기업 이름만 넣어 둔 동안은 찾지 않고, 고쳐 치면 목록을 띄워 누르면 그 기업 화면으로 바로 간다', async () => {
    renderSearch()
    expect(searchCompanies).not.toHaveBeenCalled()
    await type('삼성')
    expect(searchCompanies).toHaveBeenCalledWith('삼성', expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('link', { name: /삼성전자/ }))
    expect(screen.getByTestId('where').textContent).toBe('/companies/00126380')
    expect(screen.queryByRole('list', { name: "'삼성' 검색 결과" })).toBeNull()
  })

  it('↓로 목록에 들어가 ↑↓로 옮기고, 첫 기업에서 ↑는 입력칸으로, Esc는 목록만 닫고 감싼 메뉴는 닫지 않는다', async () => {
    renderSearch()
    await type('삼성')
    const input = screen.getByRole('searchbox', { name: '회사명 또는 종목코드' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('삼성전자')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('삼성전기')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('list', { name: "'삼성' 검색 결과" })).toBeNull()
    fireEvent.change(input, { target: { value: '삼성 ' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('list', { name: "'삼성' 검색 결과" })).toBeNull()
    // 목록을 닫는 Esc는 감싼 메뉴까지 닫지 않는다
    expect(onParentKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
  })

  it('글자를 치기 전에 검색창을 누르면 최근 본 분석을 띄우고, 누르면 그 분석 결과로 가며, 치기 시작하면 기업 목록으로 바뀐다', async () => {
    const viewedAt = new Date().toISOString()
    localStorage.setItem(
      RECENT_ANALYSES_KEY,
      JSON.stringify([
        { analysisId: 17, corpName: '신한은행', basisLabel: '전년 동기', previousReportName: '반기보고서 (2025.06)', currentReportName: '반기보고서 (2026.06)', viewedAt },
      ]),
    )
    renderSearch()
    const input = screen.getByRole('searchbox', { name: '회사명 또는 종목코드' })
    fireEvent.focus(input)
    expect(screen.getByRole('list', { name: '최근 본 분석' })).toBeTruthy()
    await type('삼성')
    expect(screen.queryByRole('list', { name: '최근 본 분석' })).toBeNull()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByRole('link', { name: /신한은행/ }))
    expect(screen.getByTestId('where').textContent).toBe('/analyses/17')
  })

  it('입력칸에서 Enter는 지금처럼 첫 화면 검색 결과로 간다', async () => {
    renderSearch()
    await type('삼성')
    fireEvent.submit(screen.getByRole('search', { name: '기업 검색' }))
    expect(screen.getByTestId('where').textContent).toBe('/?q=%EC%82%BC%EC%84%B1')
  })
})
