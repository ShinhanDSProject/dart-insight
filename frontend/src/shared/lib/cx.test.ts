import { describe, expect, it } from 'vitest'
import { cx } from './cx'

describe('cx', () => {
  it('클래스 이름을 공백으로 잇는다', () => {
    expect(cx('button', 'button--primary')).toBe('button button--primary')
  })

  it('false·null·undefined·빈 문자열은 뺀다', () => {
    expect(cx('badge', false, null, undefined, '', 'badge--accent')).toBe('badge badge--accent')
  })

  it('남는 것이 없으면 빈 문자열을 돌려준다', () => {
    expect(cx(false, undefined)).toBe('')
  })
})
