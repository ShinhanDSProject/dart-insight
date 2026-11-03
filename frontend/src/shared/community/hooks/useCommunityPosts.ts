import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { getPosts, type PostSort } from '@/shared/api/community'
import { useAuth } from '@/shared/auth/authContext'
import { postsReducer, type PostsAction, type PostsState } from '../model/community'

export interface CommunityPostsController {
  state: PostsState
  reload: () => void
  loadMore: () => void
  /** 쓴 글·고친 글·지운 글을 목록에 반영한다(서버가 답한 뒤) */
  dispatch: (action: Extract<PostsAction, { type: 'add-post' | 'replace-post' | 'patch-post' | 'remove-post' }>) => void
}

/**
 * 기업 게시판 글 목록(FS-58). 정렬이나 로그인한 사람이 바뀌면 첫 쪽부터 다시 받는다(mine·liked가 사람마다 다름).
 * 로그인 확인 중에는 기다렸다가 한 번만 부른다. 다시 부르면 이전 요청을 취소한다(ST-5).
 */
export function useCommunityPosts(corpCode: string, sort: PostSort): CommunityPostsController {
  const auth = useAuth()
  const viewer = auth.state.status === 'authenticated' ? `member:${auth.state.userId}` : auth.state.status
  const [state, dispatch] = useReducer(postsReducer, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const moreController = useRef<AbortController | null>(null)

  useEffect(() => {
    dispatch({ type: 'start' })
    if (viewer === 'loading') return
    const controller = new AbortController()
    moreController.current?.abort()
    getPosts(corpCode, sort, 0, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'reject', error })
      },
    )
    return () => controller.abort()
  }, [corpCode, sort, viewer, attempt])

  useEffect(() => () => moreController.current?.abort(), [])

  const nextPage = state.status === 'success' ? state.nextPage : null
  const loadMore = useCallback(() => {
    if (nextPage === null) return
    moreController.current?.abort()
    const controller = new AbortController()
    moreController.current = controller
    dispatch({ type: 'more-start' })
    getPosts(corpCode, sort, nextPage, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'more-reject', error })
      },
    )
  }, [corpCode, sort, nextPage])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, reload, loadMore, dispatch }
}
