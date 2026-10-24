// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { glossary } from '@/shared/lib/glossary'
import { axeViolations } from '@/test/axe'
import { Term } from './Term'

afterEach(cleanup)

function renderTerm() {
  return render(
    <div>
      <p>
        수치 기준: <Term name="fsDiv">연결</Term> 재무제표
      </p>
      <button type="button">다른 버튼</button>
    </div>,
  )
}

function termButton() {
  return screen.getByRole('button', { name: /연결/ })
}

describe('Term', () => {
  it('처음에는 닫혀 있고 원래 문구를 그대로 보여 준다', () => {
    renderTerm()
    expect(termButton()).toHaveProperty('textContent', '연결ⓘ')
    expect(termButton().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('누르면 용어 풀이와 도메인 가이드의 뜻이 열린다', () => {
    renderTerm()
    fireEvent.click(termButton())
    const tooltip = screen.getByRole('tooltip')
    expect(termButton().getAttribute('aria-expanded')).toBe('true')
    expect(termButton().getAttribute('aria-controls')).toBe(tooltip.id)
    expect(tooltip.textContent).toContain('용어 풀이')
    expect(tooltip.textContent).toContain(glossary.fsDiv.definition)
  })

  it('다시 누르면 닫힌다', () => {
    renderTerm()
    fireEvent.click(termButton())
    fireEvent.click(termButton())
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('Esc를 누르면 닫히고 초점이 용어 버튼으로 돌아온다', () => {
    renderTerm()
    termButton().focus()
    fireEvent.click(termButton())
    fireEvent.keyDown(screen.getByRole('tooltip'), { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(document.activeElement).toBe(termButton())
  })

  it('바깥을 누르면 닫힌다', () => {
    renderTerm()
    fireEvent.click(termButton())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('안쪽을 누르면 열린 채로 둔다', () => {
    renderTerm()
    fireEvent.click(termButton())
    fireEvent.pointerDown(screen.getByRole('tooltip'))
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('초점이 밖으로 나가면 닫힌다', () => {
    renderTerm()
    fireEvent.click(termButton())
    fireEvent.blur(termButton(), { relatedTarget: screen.getByRole('button', { name: '다른 버튼' }) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('닫혔을 때와 열렸을 때 모두 접근성 위반이 없다', async () => {
    const { container } = renderTerm()
    expect(await axeViolations(container)).toBe('')
    fireEvent.click(termButton())
    expect(await axeViolations(container)).toBe('')
  })
})
