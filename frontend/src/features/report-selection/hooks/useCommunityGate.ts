import { createContext, useCallback, useContext, useState } from 'react'
import { ApiError } from '@/shared/api/client'
import { useAuth } from '@/shared/auth/authContext'

/** 닉네임을 정한 뒤 다시 할 일. 닫으면 처음 에러로 끝낸다 */
interface PendingNickname {
  retry: () => void
  cancel: () => void
}

/** 지금 띄울 대화상자. login: 로그인 안내, nickname: 닉네임 정하기 */
export type GateDialog = { kind: 'none' } | { kind: 'login' } | { kind: 'nickname'; pending: PendingNickname }

export interface CommunityGate {
  /** 로그인 확인 중이거나 로그인하지 않았으면 false */
  signedIn: boolean
  /** 로그인했으면 true. 아니면 로그인 안내를 띄우고 false(쓰기·좋아요·신고 버튼이 먼저 부른다) */
  requireLogin: () => boolean
  /**
   * 글·댓글 쓰기. 서버가 닉네임이 없다고 답하면(COMMUNITY_NICKNAME_REQUIRED) 닉네임 정하기를 먼저 띄우고,
   * 정하면 같은 요청을 다시 보낸다. 닫으면 처음 에러로 끝난다.
   */
  withNickname: <T>(task: () => Promise<T>) => Promise<T>
  dialog: GateDialog
  closeDialog: () => void
  /** 닉네임을 정했다. 기다리던 요청을 다시 보낸다 */
  nicknameSaved: () => void
}

/**
 * 커뮤니티 탭의 로그인·닉네임 확인(FS-58). 닉네임은 미리 묻지 않고 처음 쓸 때 서버 답으로 안다
 * (회원 정보를 따로 받지 않아도 되고, 다른 탭에서 정한 닉네임도 바로 맞는다).
 */
export function useCommunityGate(): CommunityGate {
  const auth = useAuth()
  const signedIn = auth.state.status === 'authenticated'
  const [dialog, setDialog] = useState<GateDialog>({ kind: 'none' })

  const requireLogin = useCallback(() => {
    if (signedIn) return true
    setDialog({ kind: 'login' })
    return false
  }, [signedIn])

  const withNickname = useCallback(<T,>(task: () => Promise<T>): Promise<T> =>
    task().catch((error: unknown) => {
      if (!(error instanceof ApiError && error.code === 'COMMUNITY_NICKNAME_REQUIRED')) throw error
      return new Promise<T>((resolve, reject) => {
        setDialog({
          kind: 'nickname',
          pending: { retry: () => task().then(resolve, reject), cancel: () => reject(error) },
        })
      })
    }), [])

  const closeDialog = () => {
    if (dialog.kind === 'nickname') dialog.pending.cancel()
    setDialog({ kind: 'none' })
  }

  const nicknameSaved = () => {
    setDialog({ kind: 'none' })
    if (dialog.kind === 'nickname') dialog.pending.retry()
  }

  return { signedIn, requireLogin, withNickname, dialog, closeDialog, nicknameSaved }
}

export const CommunityGateContext = createContext<CommunityGate | null>(null)

/** 커뮤니티 탭 안의 카드·댓글이 로그인·닉네임 확인을 함께 쓴다 */
export function useCommunity(): CommunityGate {
  const value = useContext(CommunityGateContext)
  if (!value) throw new Error('CommunityGateContext가 필요합니다.')
  return value
}
