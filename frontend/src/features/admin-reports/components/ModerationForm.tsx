import { useId, useState } from 'react'
import { MODERATION_REASON_MAX, type AdminReport, type ModerationRequest } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { formatInteger } from '@/shared/lib/numberFormat'
import { Button, FieldHint, FieldLabel, Select, TextArea } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import {
  adminErrorMessages,
  blindDayOptions,
  decisionOptions,
  draftError,
  EMPTY_DRAFT,
  moderationRequest,
  type ModerationDraft,
} from '../model/adminReports'

interface ModerationFormProps {
  report: AdminReport
  onSubmit: (reportId: number, request: ModerationRequest) => Promise<void>
}

/**
 * 신고 처리(유지·블라인드·삭제). 결정을 고르고 사유를 적어야 보낸다. 블라인드는 1~30일 중 기간을 고른다.
 * 처리하면 폼을 비운다(다시 처리할 때 이전 사유가 남지 않게).
 */
export function ModerationForm({ report, onSubmit }: ModerationFormProps) {
  const id = useId()
  const [draft, setDraft] = useState<ModerationDraft>(EMPTY_DRAFT)
  const [touched, setTouched] = useState(false)
  const send = useAsyncAction<void>()
  const error = draftError(draft, report)
  const saving = send.state.status === 'loading'
  const reasonLength = draft.reason.trim().length

  return (
    <form
      className="admin-reports__form"
      aria-label={`신고 ${report.reportId} 처리`}
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (error !== null || draft.decision === null) return
        const request = moderationRequest(draft.decision, draft)
        void send.run(async () => {
          await onSubmit(report.reportId, request)
          setDraft(EMPTY_DRAFT)
          setTouched(false)
        })
      }}
    >
      <fieldset className="admin-reports__decisions">
        <legend>처리 방법</legend>
        {decisionOptions.map((option) => (
          <label key={option.value} className="admin-reports__decision">
            <input
              type="radio"
              name={`${id}-decision`}
              value={option.value}
              checked={draft.decision === option.value}
              onChange={() => setDraft({ ...draft, decision: option.value })}
            />
            <span>
              <strong>{option.label}</strong> <FieldHint>{option.hint}</FieldHint>
            </span>
          </label>
        ))}
      </fieldset>

      {draft.decision === 'BLIND' && (
        <div className="admin-reports__field">
          <FieldLabel htmlFor={`${id}-days`}>블라인드 기간</FieldLabel>
          <Select
            id={`${id}-days`}
            value={draft.blindDays}
            onChange={(e) => setDraft({ ...draft, blindDays: Number(e.target.value) })}
          >
            {blindDayOptions.map((days) => (
              <option key={days} value={days}>
                {days}일
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="admin-reports__field">
        <FieldLabel htmlFor={`${id}-reason`}>처리 사유</FieldLabel>
        <TextArea
          id={`${id}-reason`}
          rows={3}
          value={draft.reason}
          invalid={touched && error !== null && reasonLength === 0}
          aria-describedby={`${id}-reason-hint`}
          onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
        />
        <FieldHint id={`${id}-reason-hint`}>
          처리 기록에 남고, 블라인드면 작성자에게 보여요. {formatInteger(reasonLength)}/{formatInteger(MODERATION_REASON_MAX)}자
        </FieldHint>
      </div>

      {touched && error !== null && (
        <p className="admin-reports__form-error" role="alert">
          {error}
        </p>
      )}
      {send.state.status === 'error' && <ErrorState error={send.state.error} messages={adminErrorMessages} />}

      <div className="admin-reports__form-actions">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? '처리하는 중…' : '처리하기'}
        </Button>
      </div>
    </form>
  )
}
