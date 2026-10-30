// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { NotFoundPage } from './NotFoundPage'

afterEach(cleanup)

describe('NotFoundPage', () => {
  it('화면 머리(위치·제목·부제)와 기업 검색으로 돌아가는 버튼 링크를 보인다', async () => {
    const { container } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: '찾는 화면이 없어요' })).toBeTruthy()
    const crumb = screen.getByRole('navigation', { name: '현재 위치' })
    expect(within(crumb).getByRole('link', { name: '기업 검색' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: '기업 검색으로 돌아가기' }).getAttribute('href')).toBe('/')
    expect(await axeViolations(container)).toBe('')
  })
})
