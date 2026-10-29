import { useId, useState, type ReactNode } from 'react'
import { formatInteger } from '@/shared/lib/numberFormat'
import { Button, FieldHint, FieldLabel, TextArea } from '@/shared/ui'
import { bodyError } from '../model/community'

interface CommunityBodyFormProps {
  /** 입력칸 이름. 화면에 보이지 않을 때는 labelHidden */
  label: string
  labelHidden?: boolean
  placeholder?: string
  initial?: string
  maxLength: number
  submitLabel: string
  saving: boolean
  /** 앞뒤 공백을 지운 본문을 넘긴다. 성공하면 true를 돌려주어 칸을 비운다 */
  onSubmit: (body: string) => Promise<boolean>
  onCancel?: () => void
  rows?: number
  /** 저장 실패 안내 */
  error?: ReactNode
  /** 입력칸 아래에 붙는 것(글쓰기의 '변경점 붙이기', #464) */
  attachment?: ReactNode
}

/**
 * 글·댓글 본문 칸과 올리기(FS-58). 글자 수를 함께 보이고, 비었거나 넘으면 올리지 않고 이유를 알린다.
 * 올리는 동안 고치지 못하게 하되 초점은 그대로 둔다.
 */
export function CommunityBodyForm({
  label,
  labelHidden = false,
  placeholder,
  initial = '',
  maxLength,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
  rows = 3,
  error,
  attachment,
}: CommunityBodyFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(initial)
  const [touched, setTouched] = useState(false)
  const problem = bodyError(draft, maxLength)
  const over = draft.trim().length > maxLength
  const shownProblem = touched || over ? problem : null

  return (
    <form
      className="community-form"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (problem !== null || saving) return
        void onSubmit(draft.trim()).then((done) => {
          if (done) {
            setDraft('')
            setTouched(false)
          }
        })
      }}
    >
      <FieldLabel htmlFor={`${id}-body`} className={labelHidden ? 'visually-hidden' : undefined}>
        {label}
      </FieldLabel>
      <TextArea
        id={`${id}-body`}
        rows={rows}
        value={draft}
        placeholder={placeholder}
        invalid={shownProblem !== null}
        readOnly={saving}
        aria-describedby={`${id}-count`}
        onChange={(e) => setDraft(e.target.value)}
      />
      {attachment}
      <div className="community-form__foot">
        <FieldHint id={`${id}-count`}>
          {formatInteger(draft.trim().length)} / {formatInteger(maxLength)}자{shownProblem ? ` · ${shownProblem}` : ''}
        </FieldHint>
        <div className="community-form__actions">
          {onCancel && (
            <Button onClick={onCancel} disabled={saving}>
              취소
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={saving || over}>
            {saving ? '올리는 중…' : submitLabel}
          </Button>
        </div>
      </div>
      {error}
    </form>
  )
}
