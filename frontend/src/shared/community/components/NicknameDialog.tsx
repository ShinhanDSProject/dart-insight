import { useId, useState } from 'react'
import { setNickname } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, Dialog, FieldHint, FieldLabel, Input } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { communityErrorMessages, nicknameError } from '../model/community'

/**
 * 닉네임 정하기(FS-58). 처음 글·댓글을 쓸 때 먼저 뜬다. 글에는 닉네임만 보이고 이메일은 보이지 않는다.
 * 규칙에 맞지 않으면 보내지 않고, 다른 사람이 쓰는 닉네임이면 서버 답(409)으로 알린다.
 */
export function NicknameDialog({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const save = useAsyncAction<void>()
  const problem = nicknameError(draft)
  const saving = save.state.status === 'loading'

  return (
    <Dialog titleId={`${id}-title`} title="닉네임 정하기" onClose={onClose} className="community-dialog">
      <form
        className="community-dialog__form"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (problem !== null || saving) return
          void save.run(async () => {
            await setNickname(draft.trim())
            onSaved()
          })
        }}
      >
        <p>글·댓글에는 닉네임만 보여요. 나중에 바꿀 수 있어요.</p>
        <FieldLabel htmlFor={`${id}-nickname`}>닉네임</FieldLabel>
        <Input
          id={`${id}-nickname`}
          value={draft}
          invalid={touched && problem !== null}
          readOnly={saving}
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          onChange={(e) => setDraft(e.target.value)}
        />
        <FieldHint id={`${id}-hint`}>{touched && problem ? problem : '2~12자, 한글·영문·숫자'}</FieldHint>
        {save.state.status === 'error' && <ErrorState error={save.state.error} messages={communityErrorMessages} />}
        <div className="community-dialog__actions">
          <Button onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '정하는 중…' : '정하고 올리기'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
