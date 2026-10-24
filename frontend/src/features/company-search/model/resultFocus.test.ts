import { describe, expect, it } from 'vitest'
import { nextResultFocus } from './resultFocus'

describe('nextResultFocus', () => {
  it('입력창에서 ↓를 누르면 첫 결과로 간다', () => {
    expect(nextResultFocus('input', 'ArrowDown', 3)).toBe(0)
  })

  it('입력창에서 다른 키는 처리하지 않는다', () => {
    expect(nextResultFocus('input', 'ArrowUp', 3)).toBeNull()
    expect(nextResultFocus('input', 'Enter', 3)).toBeNull()
  })

  it('결과가 없으면 아무 키도 처리하지 않는다', () => {
    expect(nextResultFocus('input', 'ArrowDown', 0)).toBeNull()
  })

  it('결과에서 ↓↑로 이웃 결과로 가고 마지막 결과에서는 멈춘다', () => {
    expect(nextResultFocus(0, 'ArrowDown', 3)).toBe(1)
    expect(nextResultFocus(2, 'ArrowDown', 3)).toBe(2)
    expect(nextResultFocus(2, 'ArrowUp', 3)).toBe(1)
  })

  it('첫 결과에서 ↑를 누르거나 Esc를 누르면 입력창으로 돌아간다', () => {
    expect(nextResultFocus(0, 'ArrowUp', 3)).toBe('input')
    expect(nextResultFocus(1, 'Escape', 3)).toBe('input')
  })

  it('Home·End는 처음·끝 결과로 간다', () => {
    expect(nextResultFocus(1, 'Home', 3)).toBe(0)
    expect(nextResultFocus(0, 'End', 3)).toBe(2)
  })

  it('Enter는 링크가 열도록 처리하지 않는다', () => {
    expect(nextResultFocus(1, 'Enter', 3)).toBeNull()
  })
})
