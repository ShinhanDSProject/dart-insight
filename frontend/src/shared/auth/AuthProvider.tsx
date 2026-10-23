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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    apiPost<SessionResponse>(endpoints.sessionRefreshes(), {}, { signal: controller.signal })
      .then((session) => dispatch({ type: 'authenticated', session }))
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: 'anonymous' })
      })
    return () => controller.abort()
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
