// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Company } from '@/shared/api/companies'
import { axeViolations } from '@/test/axe'
import { SearchPage } from './SearchPage'

const companies: Company[] = [
  { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
  { corpCode: '00126371', corpName: '삼성전기', stockCode: '009150', listed: true },
  { corpCode: '00999999', corpName: '삼성 전자서비스', stockCode: null, listed: false },
]

vi.mock('@/shared/api/companies', () => ({
  searchCompanies: () => Promise.resolve({ items: companies }),
}))

afterEach(cleanup)

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/?q=${encodeURIComponent(query)}`]}>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/companies/:corpCode" element={<p>기업 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 결과 링크(접근 가능한 이름이 회사명으로 시작) */
function resultLink(name: RegExp) {
  return screen.getByRole('link', { name })
}

describe('검색 결과 키보드 이동(FS-32)', () => {
  it('입력창에서 ↓로 첫 결과로 가고 ↑↓로 옮기고 첫 결과의 ↑로 입력창에 돌아온다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' })
    input.focus()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성전자/))

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성전기/))

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성 전자서비스/))

    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(input)
  })

  it('결과에서 Esc를 누르면 입력창으로 돌아온다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.activeElement).toBe(input)
  })

  it('고른 결과는 실제 링크라 Enter로 기업 화면을 연다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: '회사명 또는 종목코드' }), { key: 'ArrowDown' })
    const link = document.activeElement as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/companies/00126380')
    // jsdom은 링크의 Enter를 클릭으로 바꾸지 않으므로 브라우저가 하는 클릭을 대신 보낸다
    fireEvent.click(link)
    expect(await screen.findByText('기업 화면')).toBeTruthy()
  })
})

describe('검색어와 맞는 부분 강조(FS-32)', () => {
  it('초성 검색어면 삼성전자의 네 글자를 강조한다', async () => {
    renderAt('ㅅㅅㅈㅈ')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const marks = resultLink(/^삼성전자/).querySelectorAll('mark')
    expect(Array.from(marks, (m) => m.textContent)).toEqual(['삼성전자'])
  })

  it('띄어 쓴 검색어도 붙여 쓴 이름을 강조한다', async () => {
    renderAt('삼성 전자')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(Array.from(resultLink(/^삼성전자/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['삼성전자'])
    expect(Array.from(resultLink(/^삼성 전자서비스/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['삼성 전자'])
  })

  it('종목코드 검색어면 종목코드를 강조한다', async () => {
    renderAt('005930')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(Array.from(resultLink(/^삼성전자/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['005930'])
  })

  it('검색 결과와 입력 안내에 접근성 위반이 없다', async () => {
    const { container } = renderAt('ㅅㅅㅈㅈ')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(await axeViolations(container)).toBe('')
  })
})
