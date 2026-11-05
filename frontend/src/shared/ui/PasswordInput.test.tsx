// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { FieldLabel, PasswordInput } from './index'

afterEach(cleanup)

function renderField(disabled = false) {
  return render(
    <>
      <FieldLabel htmlFor="pw">비밀번호</FieldLabel>
      <PasswordInput id="pw" defaultValue="Sample!password" disabled={disabled} />
    </>,
  )
}

describe('비밀번호 보기 토글(#689)', () => {
  it('처음엔 가려져 있고 눈 버튼을 누르면 보였다가 다시 누르면 가린다', () => {
    renderField()
    const input = screen.getByLabelText('비밀번호')
    const toggle = screen.getByRole('button', { name: '비밀번호 보기' })
    expect(input.getAttribute('type')).toBe('password')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)
    expect(input.getAttribute('type')).toBe('text')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)
    expect(input.getAttribute('type')).toBe('password')
  })

  it('입력이 막혀 있으면 눈 버튼도 막힌다', () => {
    renderField(true)
    expect(screen.getByRole('button', { name: '비밀번호 보기' })).toHaveProperty('disabled', true)
  })

  it('한 화면에 둘을 두면 버튼 이름을 달리 줄 수 있다', () => {
    render(
      <>
        <PasswordInput aria-label="비밀번호" />
        <PasswordInput aria-label="비밀번호 확인" toggleLabel="비밀번호 확인 보기" />
      </>,
    )
    expect(screen.getByRole('button', { name: '비밀번호 보기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '비밀번호 확인 보기' })).toBeTruthy()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = renderField()
    expect(await axeViolations(container)).toBe('')
  })
})
