// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { KIOSK_STORAGE_KEY } from '../model/kioskIdle'
import { useKioskMode } from './useKioskMode'

function renderAt(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  return renderHook(() => ({ seconds: useKioskMode(), location: useLocation() }), { wrapper })
}

describe('useKioskMode', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('?kiosk로 들어오면 켜고, 이 탭에 기억한 뒤 주소에서 지운다', async () => {
    const { result } = renderAt('/?kiosk=60')
    expect(result.current.seconds).toBe(60)
    await waitFor(() => expect(result.current.location.search).toBe(''))
    expect(sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBe('60')
  })

  it('주소에 없어도 이 탭에서 켰으면 화면을 옮겨도 유지한다', () => {
    sessionStorage.setItem(KIOSK_STORAGE_KEY, '120')
    const { result } = renderAt('/companies/00126380')
    expect(result.current.seconds).toBe(120)
  })

  it('?kiosk=off면 끄고 기억한 값을 지운다', async () => {
    sessionStorage.setItem(KIOSK_STORAGE_KEY, '120')
    const { result } = renderAt('/?kiosk=off')
    expect(result.current.seconds).toBeNull()
    await waitFor(() => expect(result.current.location.search).toBe(''))
    expect(sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBeNull()
  })

  it('켠 적 없는 탭에서는 켜지지 않는다', () => {
    const { result } = renderAt('/')
    expect(result.current.seconds).toBeNull()
  })
})
