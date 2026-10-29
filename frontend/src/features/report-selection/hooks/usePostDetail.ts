import { useCallback, useEffect, useReducer, useState } from 'react'
import { getPostDetail } from '@/shared/api/community'
import { useAuth } from '@/shared/auth/authContext'
import { detailReducer, type DetailAction, type DetailState } from '../model/community'

export interface PostDetailController {
  state: DetailState
  /** 댓글을 쓰거나 고치거나 지운 뒤 다시 받는다. 받는 동안에도 지금 댓글은 그대로 보인다 */
  refresh: () => void
  dispatch: (action: Extract<DetailAction, { type: 'patch-comment' }>) => void
}

/**
 * 글 하나의 댓글·답글(FS-58). 댓글을 펼쳤을 때만 부른다. 로그인한 사람이 바뀌면 다시 받는다(mine·liked).
 * 다시 부르거나 닫으면 이전 요청을 취소한다(ST-5).
 */
export function usePostDetail(postId: number): PostDetailController {
  const auth = useAuth()
  const viewer = auth.state.status === 'authenticated' ? `member:${auth.state.userId}` : auth.state.status
  const [state, dispatch] = useReducer(detailReducer, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (viewer === 'loading') return
    const controller = new AbortController()
    dispatch({ type: 'start' })
    getPostDetail(postId, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'reject', error })
      },
    )
    return () => controller.abort()
  }, [postId, viewer, attempt])

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, refresh, dispatch }
}
