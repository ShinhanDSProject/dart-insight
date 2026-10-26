import { useEffect, useReducer, type ReactNode } from 'react'
import { apiDelete, apiPost, setAccessToken } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'
import { AuthContext, type AuthState } from './authContext'

interface SessionResponse {
  userId: number
  accessToken: string
  expiresIn: number
}

type AuthAction =
  | { type: 'anonymous' }
  | { type: 'authenticated'; session: SessionResponse }

function reducer(_state: AuthState, action: AuthAction): AuthState {
  if (action.type === 'authenticated') {
    setAccessToken(action.session.accessToken)
    return { status: 'authenticated', userId: action.session.userId }
  }
  setAccessToken(null)
  return { status: 'anonymous' }
}

// 재발급은 Refresh Token을 회전시키고, 이미 쓴 토큰이 다시 오면 서버가 재사용으로 보고 그 로그인을 모두 끊는다(ADR-0020).
// 개발 모드(StrictMode)는 effect를 곧바로 두 번 돌리고, 취소(abort)해도 요청은 서버에 닿을 수 있으므로 겹친 요청은 하나로 함께 쓴다.
// 끝나면 비워서, 나중에 다시 올라온 AuthProvider(로그아웃 뒤 등)가 옛 결과를 쓰지 않고 새로 묻게 한다.
let restoring: Promise<SessionResponse> | null = null

function restoreSession(): Promise<SessionResponse> {
  restoring ??= apiPost<SessionResponse>(endpoints.sessionRefreshes(), {}).finally(() => {
    restoring = null
  })
  return restoring
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'loading' })

  useEffect(() => {
    let active = true
    restoreSession()
      .then((session) => {
        if (active) dispatch({ type: 'authenticated', session })
      })
      .catch(() => {
        if (active) dispatch({ type: 'anonymous' })
      })
    return () => {
      active = false
    }
  }, [])

  async function login(email: string, password: string) {
    const session = await apiPost<SessionResponse>(endpoints.sessions(), { email, password })
    dispatch({ type: 'authenticated', session })
  }

  async function logout() {
    try {
      await apiDelete(endpoints.currentSession())
    } finally {
      dispatch({ type: 'anonymous' })
    }
  }

  return <AuthContext.Provider value={{ state, login, logout }}>{children}</AuthContext.Provider>
}
