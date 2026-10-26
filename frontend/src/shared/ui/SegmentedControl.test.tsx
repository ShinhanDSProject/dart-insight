// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'

afterEach(cleanup)

type Theme = 'system' | 'light' | 'dark'

const options: SegmentOption<Theme>[] = [
  { value: 'system', label: '시스템', icon: 'monitor' },
  { value: 'light', label: '밝게', icon: 'sun' },
  { value: 'dark', label: '어둡게', icon: 'moon' },
]

describe('SegmentedControl', () => {
  it('아이콘 variant는 글자 대신 아이콘을 보이고 이름은 접근 가능한 이름과 툴팁으로 둔다', () => {
    render(<SegmentedControl variant="icon" aria-label="화면 테마" options={options} value="dark" onChange={() => {}} />)

    const dark = screen.getByRole('button', { name: '어둡게' })
    expect(dark.textContent).toBe('')
    expect(dark.getAttribute('title')).toBe('어둡게')
    expect(dark.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('group', { name: '화면 테마' })).toBeTruthy()
  })

  it('아이콘 variant도 고른 값을 aria-pressed로 알리고 누르면 그 값을 넘긴다', () => {
    const onChange = vi.fn()
    render(<SegmentedControl variant="icon" aria-label="화면 테마" options={options} value="dark" onChange={onChange} />)

    expect(screen.getByRole('button', { name: '어둡게' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '밝게' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: '밝게' }))
    expect(onChange).toHaveBeenCalledWith('light')
  })

  it('글자 variant(기본)는 지금처럼 글자를 보이고 툴팁을 달지 않는다', () => {
    render(<SegmentedControl aria-label="화면 테마" options={options} value="system" onChange={() => {}} />)

    const system = screen.getByRole('button', { name: '시스템' })
    expect(system.textContent).toBe('시스템')
    expect(system.getAttribute('title')).toBeNull()
  })
})
