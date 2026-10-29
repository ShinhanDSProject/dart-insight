// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { NotificationSignInLink } from './NotificationSignInLink'

afterEach(cleanup)

describe('NotificationSignInLink(#493)', () => {
  it('로그인이 필요하다는 이름의 알림 링크를 보이고, 누르면 로그인 화면으로 간다', async () => {
    const { container } = render(
      <MemoryRouter>
        <NotificationSignInLink />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '알림(로그인 필요)' })
    expect(link.textContent).toBe('알림')
    expect(link.getAttribute('href')).toBe('/login')
    expect(await axeViolations(container)).toBe('')
  })
})
