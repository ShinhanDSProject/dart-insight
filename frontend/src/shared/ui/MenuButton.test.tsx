// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '@/test/axe'
import { MenuButton, MenuItem } from './MenuButton'

afterEach(cleanup)

function renderMenu(onPick = vi.fn()) {
  const view = render(
    <>
      <MenuButton label="그 밖의 표" trigger="chip" selected>
        {(close) => (
          <MenuItem
            aria-pressed
            onClick={() => {
              onPick()
              close()
            }}
          >
            자본변동표
          </MenuItem>
        )}
      </MenuButton>
      <p data-testid="outside">바깥</p>
    </>,
  )
  return { onPick, ...view }
}

describe('MenuButton', () => {
  it('누르면 펼치고 aria-expanded·aria-controls로 상자를 가리킨다', () => {
    renderMenu()
    const button = screen.getByRole('button', { name: '그 밖의 표' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: '자본변동표' })).toBeNull()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(panel?.hidden).toBe(false)
    expect(button.className).toContain('chip--selected')
  })

  it('항목을 고르면 닫는 함수로 닫고, 바깥을 누르거나 Esc로도 닫는다(Esc면 초점이 버튼으로 돌아온다)', () => {
    const { onPick } = renderMenu()
    const button = screen.getByRole('button', { name: '그 밖의 표' })
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: '자본변동표' }))
    expect(onPick).toHaveBeenCalled()
    expect(button.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(button)
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(button.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(button)
    fireEvent.keyDown(screen.getByRole('button', { name: '자본변동표' }), { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('펼친 상태에 접근성 위반이 없다', async () => {
    const { container } = renderMenu()
    fireEvent.click(screen.getByRole('button', { name: '그 밖의 표' }))
    expect(await axeViolations(container)).toBe('')
  })
})
