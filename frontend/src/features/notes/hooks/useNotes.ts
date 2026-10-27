import { useCallback, useEffect, useReducer, useState } from 'react'
import { deleteNote, getNotes, updateNoteMemo } from '@/shared/api/notes'
import { useAuth } from '@/shared/auth/authContext'
import { notesReducer, type NotesState } from '../model/notes'

export interface NotesController {
  /** 로그인 확인 중이면 loading */
  state: NotesState
  reload: () => void
  /** 메모를 고친다. 실패하면 거부된 Promise */
  saveMemo: (itemId: number, memo: string | null) => Promise<void>
  /** 항목 하나를 지운다. 실패하면 거부된 Promise */
  remove: (itemId: number) => Promise<void>
}

/**
 * 내 판단 노트 목록(FS-57). 로그인하지 않았으면 서버를 부르지 않고 anonymous다.
 * 회원이 바뀌거나 다시 불러오면 이전 요청을 취소한다(ST-5). 메모·삭제는 서버가 답한 뒤 목록에 반영한다.
 */
export function useNotes(): NotesController {
  const auth = useAuth()
  const userId = auth.state.status === 'authenticated' ? auth.state.userId : null
  const checking = auth.state.status === 'loading'
  const [state, dispatch] = useReducer(notesReducer, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (checking) {
      dispatch({ type: 'start' })
      return
    }
    if (userId === null) {
      dispatch({ type: 'set-anonymous' })
      return
    }
    const controller = new AbortController()
    dispatch({ type: 'start' })
    getNotes(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'reject', error })
      },
    )
    return () => controller.abort()
  }, [checking, userId, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const saveMemo = useCallback(async (itemId: number, memo: string | null) => {
    const item = await updateNoteMemo(itemId, memo)
    dispatch({ type: 'replace-item', item })
  }, [])
  const remove = useCallback(async (itemId: number) => {
    await deleteNote(itemId)
    dispatch({ type: 'remove-item', itemId })
  }, [])

  return { state, reload, saveMemo, remove }
}
