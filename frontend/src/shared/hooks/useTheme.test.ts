// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { THEME_KEY } from '@/shared/lib/theme'
import { RESULT_TOUR_SEEN_KEY } from '@/shared/lib/resultTour'
import { useResultTour } from './useResultTour'
import { useTheme } from './useTheme'

afterEach(() => window.localStorage.clear())

/** 다른 탭이 저장소를 바꾼 것처럼 저장하고 storage 이벤트를 보낸다 */
function changeInOtherTab(key: string, value: string | null) {
  if (value === null) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, value)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
}

describe('다른 탭과 맞추기(#856)', () => {
  it('이 탭에서 테마를 고른 뒤에도 다른 탭에서 바꾼 테마를 따라간다', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setChoice('dark'))
    expect(result.current.choice).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => changeInOtherTab(THEME_KEY, 'light'))
    expect(result.current.choice).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('이 탭에서 둘러보기를 끝낸 뒤에도 다른 탭의 다시 보기를 따라간다', () => {
    const { result } = renderHook(() => useResultTour())
    act(() => result.current.finish())
    expect(result.current.visible).toBe(false)

    act(() => changeInOtherTab(RESULT_TOUR_SEEN_KEY, null))
    expect(result.current.visible).toBe(true)
  })
})
