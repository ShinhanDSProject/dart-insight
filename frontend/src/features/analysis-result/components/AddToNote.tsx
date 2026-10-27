import { useState } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import { createNote, NOTE_MEMO_MAX, type NoteItem, type NoteTarget } from '@/shared/api/notes'
import { useAuth } from '@/shared/auth/authContext'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, MemoForm, Notice } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'

interface AddToNoteProps {
  /** 담을 근거(종류와 변경 ID, 또는 AI 답의 질문 ID·인용 번호) */
  target: NoteTarget
  analysisId: number
  /** 화면 읽기용 이름(계정명·섹션). 버튼 이름에 붙인다 */
  label: string
}

/** closed: 버튼만, login: 로그인 안내, editing: 메모 칸, saved: 담음 */
type View = { status: 'closed' } | { status: 'login' } | { status: 'editing' } | { status: 'saved' }

/**
 * '노트에 담기'(FS-57 AC1·AC2). 누르면 메모 칸이 열리고, 저장하면 기업 노트에 담는다.
 * 로그인하지 않았으면 서버를 부르지 않고 로그인 안내만 보인다.
 * 담는 값·문장은 서버가 분석 ID와 변경 ID(AI 답 인용은 질문 ID·인용 번호)로 저장된 근거에서 만든다(화면이 글을 보내지 않음).
 */
export function AddToNote({ target, analysisId, label }: AddToNoteProps) {
  const auth = useAuth()
  const [view, setView] = useState<View>({ status: 'closed' })
  const save = useAsyncAction<NoteItem>()

  const open = () => {
    save.reset()
    setView(auth.state.status === 'authenticated' ? { status: 'editing' } : { status: 'login' })
  }
  const submit = (memo: string | null) => {
    void save.run(async () => {
      const item = await createNote({ ...target, analysisId, memo })
      setView({ status: 'saved' })
      return item
    })
  }

  return (
    <div className="note-add">
      {match(view)
        .with({ status: 'closed' }, { status: 'saved' }, ({ status }) => (
          <>
            <Button
              variant="secondary"
              className="note-add__button"
              disabled={auth.state.status === 'loading'}
              aria-label={`노트에 담기: ${label}`}
              onClick={open}
            >
              노트에 담기
            </Button>
            {status === 'saved' && (
              <p className="note-add__done" role="status">
                노트에 담았어요. <Link to="/notes">내 판단 노트 보기</Link>
              </p>
            )}
          </>
        ))
        .with({ status: 'login' }, () => (
          <Notice as="div" role="status" className="note-add__login">
            로그인하면 근거를 노트에 담고 메모를 남길 수 있어요. <Link to="/login">로그인하기</Link>{' '}
            <Button variant="link" onClick={() => setView({ status: 'closed' })}>
              닫기
            </Button>
          </Notice>
        ))
        .with({ status: 'editing' }, () => (
          <MemoForm
            label="메모(선택)"
            submitLabel="노트에 저장"
            maxLength={NOTE_MEMO_MAX}
            saving={save.state.status === 'loading'}
            onSave={submit}
            onCancel={() => setView({ status: 'closed' })}
            error={
              save.state.status === 'error' ? (
                <ErrorState
                  error={save.state.error}
                  messages={{ AUTH_UNAUTHORIZED: '로그인이 끝났어요. 다시 로그인한 뒤 담아 주세요.' }}
                />
              ) : undefined
            }
          />
        ))
        .exhaustive()}
    </div>
  )
}
