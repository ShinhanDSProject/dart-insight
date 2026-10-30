// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import { axeViolations } from '@/test/axe'
import { FavoriteCompanies } from './FavoriteCompanies'

afterEach(cleanup)

function fav(corpCode: string, corpName: string, listed = true): FavoriteCompany {
  return { corpCode, corpName, stockCode: listed ? '005930' : null, listed, addedAt: '2026-10-20T10:00:00' }
}

describe('첫 화면 관심 기업(#534)', () => {
  it('관심 기업이 1곳뿐이면 나란히 보기 링크를 두지 않는다', () => {
    render(
      <MemoryRouter>
        <FavoriteCompanies items={[fav('00126380', '삼성전자')]} onRemove={vi.fn(() => Promise.resolve())} onAdd={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /삼성전자/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /나란히 보기/ })).toBeNull()
  })

  it('관심 기업이 2~4곳이면 나란히 보기 링크로 모두 연결하고 접근성 위반이 없다', async () => {
    const { container } = render(
      <MemoryRouter>
        <FavoriteCompanies
          items={[fav('00126380', '삼성전자'), fav('00164779', 'SK하이닉스')]}
          onRemove={vi.fn(() => Promise.resolve())}
          onAdd={vi.fn()}
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: '관심 기업 나란히 보기' })
    expect(link.getAttribute('href')).toBe('/compare/companies?corps=00126380,00164779')
    expect(link.textContent).toBe('나란히 보기')
    expect(await axeViolations(container)).toBe('')
  })

  it('관심 기업이 5곳 이상이면 최근 4곳 나란히 보기 링크로 앞의 4곳만 넘긴다', () => {
    render(
      <MemoryRouter>
        <FavoriteCompanies
          items={[
            fav('00126380', '삼성전자'),
            fav('00164779', 'SK하이닉스'),
            fav('00000003', '셋째기업', false),
            fav('00000004', '넷째기업', false),
            fav('00000005', '다섯째기업', false),
          ]}
          onRemove={vi.fn(() => Promise.resolve())}
          onAdd={vi.fn()}
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: '관심 기업 최근 4곳 나란히 보기' })
    expect(link.getAttribute('href')).toBe('/compare/companies?corps=00126380,00164779,00000003,00000004')
    expect(link.textContent).toBe('최근 4곳 나란히 보기')
  })
})
