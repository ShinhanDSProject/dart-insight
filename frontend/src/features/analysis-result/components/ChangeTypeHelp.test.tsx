// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axeViolations } from '@/test/axe'
import { changeTypeHelp } from '../model/textLabels'
import { ChangeTypeHelp } from './ChangeTypeHelp'

afterEach(cleanup)

describe('문장 변경 유형 설명', () => {
  it('초점을 받은 버튼을 키보드로 누르면 6개 유형의 뜻이 펼쳐지고, 다시 누르면 접힌다', () => {
    const { container } = render(<ChangeTypeHelp />)
    const button = screen.getByRole('button', { name: '유형 설명' })
    const list = container.querySelector('dl')
    expect(list).not.toBeNull()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe(list?.id)
    expect(list?.hidden).toBe(true)

    // 기본 <button>은 Enter·Space를 click으로 바꿔 준다(jsdom은 이 변환을 하지 않아 click으로 대신한다)
    button.focus()
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.textContent).toBe('유형 설명 접기')
    expect(list?.hidden).toBe(false)
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual([
      '추가',
      '삭제',
      '수정',
      '숫자만 바뀜',
      '위치 이동',
      '검토 필요',
    ])
    expect(screen.getByText(changeTypeHelp.MOVED)).not.toBeNull()
    expect(document.activeElement).toBe(button)

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(list?.hidden).toBe(true)
  })

  it('접힌 상태와 펼친 상태 모두 접근성 위반이 없다', async () => {
    const { container } = render(<ChangeTypeHelp />)
    expect(await axeViolations(container)).toBe('')
    fireEvent.click(screen.getByRole('button'))
    expect(await axeViolations(container)).toBe('')
  })
})
