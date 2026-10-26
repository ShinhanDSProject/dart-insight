// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './authContext'

const client = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  setAccessToken: vi.fn(),
}))
vi.mock('@/shared/api/client', () => client)

function Status() {
  const auth = useAuth()
  return <p>{auth.state.status}</p>
}

afterEach(cleanup)

describe('AuthProvider 로그인 복구', () => {
  it('개발 모드(StrictMode)에서 effect가 두 번 돌아도 재발급 요청은 한 번만 보낸다', async () => {
    client.apiPost.mockResolvedValue({ userId: 1, accessToken: 'token', expiresIn: 900 })
    render(
      <StrictMode>
        <AuthProvider>
          <Status />
        </AuthProvider>
      </StrictMode>,
    )
    expect(await screen.findByText('authenticated')).toBeTruthy()
    expect(client.apiPost).toHaveBeenCalledTimes(1)
    expect(client.apiPost).toHaveBeenCalledWith('/api/session-refreshes', {})
  })

  it('복구가 끝난 뒤 다시 올라오면 옛 결과를 쓰지 않고 새로 묻는다', async () => {
    client.apiPost.mockReset()
    client.apiPost.mockResolvedValueOnce({ userId: 1, accessToken: 'old', expiresIn: 900 })
    const first = render(<AuthProvider><Status /></AuthProvider>)
    expect(await screen.findByText('authenticated')).toBeTruthy()
    first.unmount()

    client.apiPost.mockRejectedValueOnce(new Error('refresh failed'))
    render(<AuthProvider><Status /></AuthProvider>)
    expect(await screen.findByText('anonymous')).toBeTruthy()
    expect(client.apiPost).toHaveBeenCalledTimes(2)
  })
})
