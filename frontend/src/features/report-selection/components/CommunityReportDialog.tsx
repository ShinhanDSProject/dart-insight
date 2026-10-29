import { useId, useState } from 'react'
import { match } from 'ts-pattern'
import { reportContent, type LikeTarget, type ReportReason } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, Dialog } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { communityErrorMessages, reportReasonOptions } from '../model/community'

/**
 * 신고(FS-58). 네 사유 중 하나를 고른다. 신고만으로는 글이 가려지지 않고 관리자가 확인한다는 것을 알린다.
 */
export function CommunityReportDialog({ target, noun, onClose }: { target: LikeTarget; noun: '글' | '댓글'; onClose: () => void }) {
  const id = useId()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const send = useAsyncAction<void>()

  return (
    <Dialog titleId={`${id}-title`} title={`${noun} 신고`} onClose={onClose} className="community-dialog">
      {match(send.state)
        .with({ status: 'success' }, () => (
          <>
            <p role="status">신고했어요. 관리자가 확인하고 처리해요. 처리하기 전까지 {noun}은 그대로 보여요.</p>
            <div className="community-dialog__actions">
              <Button variant="primary" onClick={onClose}>
                닫기
              </Button>
            </div>
          </>
        ))
        .with({ status: 'idle' }, { status: 'loading' }, { status: 'error' }, (state) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (reason === null) return
              void send.run(() => reportContent(target, reason))
            }}
          >
            <fieldset className="community-dialog__reasons">
              <legend>신고 사유를 골라 주세요</legend>
              {reportReasonOptions.map((option) => (
                <label key={option.value} className="community-dialog__reason">
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {state.status === 'error' && <ErrorState error={state.error} messages={communityErrorMessages} />}
            <div className="community-dialog__actions">
              <Button onClick={onClose}>취소</Button>
              <Button type="submit" variant="primary" disabled={reason === null || state.status === 'loading'}>
                {state.status === 'loading' ? '신고하는 중…' : '신고하기'}
              </Button>
            </div>
          </form>
        ))
        .exhaustive()}
    </Dialog>
  )
}
