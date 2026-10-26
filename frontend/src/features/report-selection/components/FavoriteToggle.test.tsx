// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FavoriteCompaniesController } from '@/shared/hooks/useFavoriteCompanies'
import { FavoriteToggle } from './FavoriteToggle'

const hook = vi.hoisted(() => ({ current: null as FavoriteCompaniesController | null }))
vi.mock('@/shared/hooks/useFavoriteCompanies', () => ({ useFavoriteCompanies: () => hook.current }))

const samsung = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }

function controller(overrides: Partial<FavoriteCompaniesController>): FavoriteCompaniesController {
  return {
    status: 'ready', items: [], isFavorite: () => false,
    toggle: vi.fn().mockResolvedValue(undefined), remove: vi.fn(), reload: vi.fn(),
    ...overrides,
  }
}

function renderToggle(overrides: Partial<FavoriteCompaniesController>) {
  hook.current = controller(overrides)
  render(<MemoryRouter><FavoriteToggle company={samsung} /></MemoryRouter>)
}

afterEach(cleanup)

describe('FavoriteToggle(#36)', () => {
  it('로그인하지 않았으면 별 버튼 대신 로그인 화면으로 가는 링크를 보인다', () => {
    renderToggle({ status: 'anonymous' })
    const link = screen.getByRole('link', { name: '로그인하고 관심 기업에 추가' })
    expect(link.getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('목록을 받는 중에는 별 버튼을 누를 수 없다', () => {
    renderToggle({ status: 'loading' })
    expect(screen.getByRole('button', { name: '삼성전자 관심 기업에 추가' })).toHaveProperty('disabled', true)
  })

  it('바꾸기가 실패하면 안내를 보인다', async () => {
    renderToggle({ toggle: vi.fn().mockRejectedValue(new Error('network')) })
    fireEvent.click(screen.getByRole('button', { name: '삼성전자 관심 기업에 추가' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('바꾸지 못했어요'))
  })

  it('목록 받기가 실패했으면 다시 불러오는 버튼을 보인다', () => {
    const reload = vi.fn()
    renderToggle({ status: 'error', reload })
    fireEvent.click(screen.getByRole('button', { name: '관심 기업 다시 불러오기' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
