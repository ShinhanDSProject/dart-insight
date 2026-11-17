// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '@/test/axe'
import { BoothGuide } from './BoothGuide'

afterEach(cleanup)

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function show(path: string, view: 'open' | 'folded' = 'open') {
  const onViewChange = vi.fn()
  const view_ = render(
    <MemoryRouter initialEntries={[path]}>
      <BoothGuide view={view} onViewChange={onViewChange} />
      <Where />
    </MemoryRouter>,
  )
  return { ...view_, onViewChange }
}

describe('전시 부스 따라 해 보기', () => {
  it('첫 화면에서는 기업 찾기 단계를 보이고, 예시 버튼으로 삼성전자 화면에 간다', async () => {
    const { container } = show('/')
    expect(screen.getByRole('heading', { name: '회사를 찾아 보세요' })).toBeTruthy()
    expect(screen.getByText('기업 찾기').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '삼성전자로 해 보기' }))
    expect(screen.getByTestId('where').textContent).toBe('/companies/00126380')
    expect(screen.getByRole('heading', { name: '비교할 보고서를 고르세요' })).toBeTruthy()
  })

  it('결과 화면에서는 해 볼 일을 누르면 그 탭을 열고, 연 탭은 해 본 일로 표시한다', async () => {
    const { container } = show('/analyses/214')
    expect(await axeViolations(container)).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /재무 수치/ }))
    expect(screen.getByTestId('where').textContent).toBe('/analyses/214?tab=financial')
    expect(screen.getByRole('button', { name: /^재무 수치\s*\(해 봤어요\)/ })).toBeTruthy()
    expect(screen.getAllByText(/해 봤어요/)).toHaveLength(1)
  })

  it('처음부터를 누르면 첫 화면으로 가고, 접으면 접힌 보기를 알린다', () => {
    const { onViewChange } = show('/notes')
    expect(screen.getByRole('heading', { name: '기업 찾기부터 해 보세요' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '처음부터' }))
    expect(screen.getByTestId('where').textContent).toBe('/')
    fireEvent.click(screen.getByRole('button', { name: '안내 접기' }))
    expect(onViewChange).toHaveBeenCalledWith('folded')
  })

  it('접혀 있으면 따라 해 보기 버튼만 보이고, 누르면 펼친다', () => {
    const { onViewChange } = show('/', 'folded')
    expect(screen.queryByRole('heading')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '따라 해 보기' }))
    expect(onViewChange).toHaveBeenCalledWith('open')
  })
})
