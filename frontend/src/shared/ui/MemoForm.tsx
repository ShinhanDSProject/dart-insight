import { useId, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { FieldHint, FieldLabel, TextArea } from './Field'

interface MemoFormProps {
  /** 처음 채울 메모. 없으면 빈 칸 */
  initial?: string | null
  /** 최대 글자 수. 넘으면 저장하지 않는다 */
  maxLength: number
  submitLabel: string
  /** 보이는 이름 옆에 붙일 설명(예: 선택) */
  label?: string
  saving: boolean
  /** 앞뒤 공백을 지우고, 비었으면 null을 넘긴다 */
  onSave: (memo: string | null) => void
  onCancel: () => void
  /** 저장 실패 안내 */
  error?: ReactNode
}

/**
 * 메모 한 칸과 저장·취소(판단 노트 FS-57). 글자 수를 함께 보이고, 넘으면 저장 버튼을 끈다.
 * 저장하는 동안 고치지 못하게 하되 포커스는 그대로 둔다.
 */
export function MemoForm({ initial = null, maxLength, submitLabel, label = '메모', saving, onSave, onCancel, error }: MemoFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(initial ?? '')
  const over = draft.length > maxLength
  return (
    <form
      className="memo-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (over || saving) return
        const memo = draft.trim()
        onSave(memo === '' ? null : memo)
      }}
    >
      <FieldLabel htmlFor={`${id}-memo`}>{label}</FieldLabel>
      <TextArea
        id={`${id}-memo`}
        rows={3}
        value={draft}
        invalid={over}
        readOnly={saving}
        aria-describedby={`${id}-count`}
        onChange={(e) => setDraft(e.target.value)}
      />
      <FieldHint id={`${id}-count`}>
        {draft.length.toLocaleString('ko-KR')} / {maxLength.toLocaleString('ko-KR')}자{over ? ' · 글자 수를 줄여 주세요.' : ''}
      </FieldHint>
      {error}
      <div className="memo-form__actions">
        <Button type="submit" variant="primary" disabled={over || saving}>
          {saving ? '저장하는 중…' : submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          취소
        </Button>
      </div>
    </form>
  )
}
