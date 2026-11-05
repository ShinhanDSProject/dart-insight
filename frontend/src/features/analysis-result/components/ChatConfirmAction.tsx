import { Link } from 'react-router'
import { match } from 'ts-pattern'
import { addFavoriteCompany } from '@/shared/api/favoriteCompanies'
import { createNote } from '@/shared/api/notes'
import { useAuth } from '@/shared/auth/authContext'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, Notice } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import type { ChatActionTarget } from '../model/chatLinks'
import { useLoginHref } from '@/shared/hooks/useLoginHref'

export type ConfirmTarget = Extract<ChatActionTarget, { kind: 'save-note' } | { kind: 'favorite' }>

const errorMessages: Record<string, string> = {
  AUTH_UNAUTHORIZED: '로그인이 끝났어요. 다시 로그인한 뒤 눌러 주세요.',
}

interface ChatConfirmActionProps {
  target: ConfirmTarget
  label: string
  /** 이 버튼으로 이미 저장했다(채팅 상태에 남아 패널을 다시 열어도 유지) */
  done: boolean
  /** 저장이 끝났을 때 */
  onDone: () => void
}

/**
 * 채팅의 쓰기 확인 버튼(AC9·AC10). 에이전트는 쓰지 않고 버튼만 보내며, 사용자가 누를 때만 저장한다.
 * 로그인하지 않았으면 버튼 대신 로그인 안내를 보이고 서버를 부르지 않는다.
 * 저장을 마친 버튼은 다시 저장하지 않는다(노트는 같은 근거로 두 번 담기지 않게).
 */
export function ChatConfirmAction({ target, label, done, onDone }: ChatConfirmActionProps) {
  const loginHref = useLoginHref()
  const auth = useAuth()
  const save = useAsyncAction<unknown>()

  const confirm = () => {
    void save.run(async () => {
      const saved = await match(target)
        .with({ kind: 'save-note' }, ({ note }): Promise<unknown> => createNote(note))
        .with({ kind: 'favorite' }, ({ corpCode }): Promise<unknown> => addFavoriteCompany(corpCode))
        .exhaustive()
      onDone()
      return saved
    })
  }
  const state = done ? ({ status: 'success', data: null } as const) : save.state

  return match(auth.state)
    .with({ status: 'anonymous' }, () => (
      <Notice as="div" role="status" className="chat-panel__login">
        {match(target)
          .with({ kind: 'save-note' }, () => '로그인하면 이 근거를 노트에 담을 수 있어요.')
          .with({ kind: 'favorite' }, () => '로그인하면 이 기업을 관심 기업에 추가할 수 있어요.')
          .exhaustive()}{' '}
        <Link to={loginHref}>로그인하기</Link>
      </Notice>
    ))
    .with({ status: 'loading' }, { status: 'authenticated' }, ({ status }) => (
      <div className="chat-panel__confirm">
        {match(state)
          .with({ status: 'success' }, () => (
            <p className="chat-panel__done" role="status">
              {match(target)
                .with({ kind: 'save-note' }, () => (
                  <>
                    노트에 담았어요. <Link to="/notes">내 판단 노트 보기</Link>
                  </>
                ))
                .with({ kind: 'favorite' }, () => '관심 기업에 추가했어요.')
                .exhaustive()}
            </p>
          ))
          .with({ status: 'idle' }, { status: 'loading' }, { status: 'error' }, (state) => (
            <>
              <Button
                variant="secondary"
                disabled={status === 'loading' || state.status === 'loading'}
                aria-busy={state.status === 'loading'}
                onClick={confirm}
              >
                {state.status === 'loading' ? '저장하는 중…' : label}
              </Button>
              {state.status === 'error' && <ErrorState error={state.error} messages={errorMessages} />}
            </>
          ))
          .exhaustive()}
      </div>
    ))
    .exhaustive()
}
