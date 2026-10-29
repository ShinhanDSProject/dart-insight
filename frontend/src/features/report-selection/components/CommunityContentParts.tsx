import { useId, useState } from 'react'
import { match } from 'ts-pattern'
import { REPOST_MESSAGE_MAX, requestRepost, setLike, type Blind, type LikeResult, type LikeTarget } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { dateTimeLabel } from '@/shared/lib/communityLabels'
import { formatInteger } from '@/shared/lib/numberFormat'
import { Button, Dialog, FieldHint, FieldLabel, Notice, TextArea } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useCommunity } from '../hooks/useCommunityGate'
import { communityErrorMessages, type ContentView } from '../model/community'

/** 글·댓글 본문 자리. 가려지거나 지운 것은 안내 한 줄, 가려진 내 것은 본문과 사유·기한·재게시 청구 */
export function ContentBody({ view, noun, onRepostRequested }: { view: ContentView; noun: '글' | '댓글'; onRepostRequested: () => void }) {
  return match(view)
    .with({ kind: 'visible' }, ({ body }) => <p className="community-body">{body}</p>)
    .with({ kind: 'blinded' }, () => <p className="community-body community-body--muted">신고로 가려진 {noun}입니다</p>)
    .with({ kind: 'deleted' }, () => <p className="community-body community-body--muted">삭제된 {noun}입니다</p>)
    .with({ kind: 'blinded-mine' }, ({ body, blind }) => (
      <>
        <BlindNotice blind={blind} noun={noun} onRequested={onRepostRequested} />
        <p className="community-body community-body--hidden">{body}</p>
      </>
    ))
    .exhaustive()
}

/**
 * 가려진 내 글·댓글 안내(FS-58). 다른 사람에게는 본문 없이 '신고로 가려진 …입니다'만 보인다는 것과 처리 사유·기한을 알리고,
 * 부당하면 재게시를 청구한다(블라인드마다 한 번).
 */
function BlindNotice({ blind, noun, onRequested }: { blind: Blind; noun: '글' | '댓글'; onRequested: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Notice tone="attention" title={`신고로 가려진 ${noun}입니다`} className="community-blind">
      <p>다른 사람에게는 본문 없이 이 안내만 보여요.</p>
      <dl className="community-blind__facts">
        <dt>처리 사유</dt>
        <dd>{blind.reason}</dd>
        <dt>가리는 기한</dt>
        <dd>
          {dateTimeLabel(blind.blindUntil)}까지
          {blind.expired && ' · 기한이 지나 관리자가 다시 확인할 때까지 가려 둬요'}
        </dd>
      </dl>
      {match({ requested: blind.repostRequested, open })
        .with({ requested: true }, () => <p role="status">재게시를 청구했어요. 관리자가 다시 판단해요.</p>)
        .with({ requested: false, open: false }, () => (
          <Button onClick={() => setOpen(true)}>재게시 청구</Button>
        ))
        .with({ requested: false, open: true }, () => (
          <RepostForm reportId={blind.reportId} onDone={onRequested} onCancel={() => setOpen(false)} />
        ))
        .exhaustive()}
    </Notice>
  )
}

function RepostForm({ reportId, onDone, onCancel }: { reportId: number; onDone: () => void; onCancel: () => void }) {
  const id = useId()
  const [message, setMessage] = useState('')
  const send = useAsyncAction<void>()
  const over = message.trim().length > REPOST_MESSAGE_MAX
  const saving = send.state.status === 'loading'
  return (
    <form
      className="community-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (over || saving) return
        const trimmed = message.trim()
        void send.run(async () => {
          await requestRepost(reportId, trimmed === '' ? null : trimmed)
          onDone()
        })
      }}
    >
      <FieldLabel htmlFor={`${id}-message`}>관리자에게 남길 말(선택)</FieldLabel>
      <TextArea
        id={`${id}-message`}
        rows={2}
        value={message}
        invalid={over}
        readOnly={saving}
        aria-describedby={`${id}-count`}
        onChange={(e) => setMessage(e.target.value)}
      />
      <FieldHint id={`${id}-count`}>
        {formatInteger(message.trim().length)} / {formatInteger(REPOST_MESSAGE_MAX)}자
      </FieldHint>
      {send.state.status === 'error' && <ErrorState error={send.state.error} messages={communityErrorMessages} />}
      <div className="community-form__actions">
        <Button onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={over || saving}>
          {saving ? '청구하는 중…' : '재게시 청구하기'}
        </Button>
      </div>
    </form>
  )
}

interface LikeButtonProps {
  target: LikeTarget
  liked: boolean
  likeCount: number
  /** 보이는 글·댓글만 누를 수 있다(취소는 언제든) */
  available: boolean
  onChange: (result: LikeResult) => void
}

/** 좋아요(FS-58). 누름 상태는 aria-pressed와 글자로도 알린다. 로그인하지 않았으면 로그인 안내를 띄운다 */
export function LikeButton({ target, liked, likeCount, available, onChange }: LikeButtonProps) {
  const gate = useCommunity()
  const action = useAsyncAction<LikeResult>()
  const saving = action.state.status === 'loading'
  return (
    <>
      <Button
        variant="link"
        className="community-action"
        aria-pressed={liked}
        disabled={saving || (!liked && !available)}
        onClick={() => {
          if (!gate.requireLogin()) return
          void action.run(async () => {
            const result = await setLike(target, !liked)
            onChange(result)
            return result
          })
        }}
      >
        {liked ? '좋아요 취소' : '좋아요'} {formatInteger(likeCount)}
      </Button>
      {action.state.status === 'error' && (
        <ErrorState error={action.state.error} messages={communityErrorMessages} />
      )}
    </>
  )
}

/** 지우기 전에 한 번 묻는다. 댓글·답글이 남으면 '삭제된 …입니다'로 남는다는 것을 알린다 */
export function DeleteDialog({ noun, onConfirm, onClose }: { noun: '글' | '댓글'; onConfirm: () => Promise<void>; onClose: () => void }) {
  const id = useId()
  const action = useAsyncAction<void>()
  const saving = action.state.status === 'loading'
  return (
    <Dialog titleId={`${id}-title`} title={`${noun}을 지울까요?`} onClose={onClose} className="community-dialog">
      <p>
        {noun === '글' ? '댓글이 있으면' : '답글이 있으면'} &lsquo;삭제된 {noun}입니다&rsquo;로 남고 {noun === '글' ? '댓글' : '답글'}은
        그대로 보여요.
      </p>
      {action.state.status === 'error' && <ErrorState error={action.state.error} messages={communityErrorMessages} />}
      <div className="community-dialog__actions">
        <Button onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => void action.run(onConfirm)}>
          {saving ? '지우는 중…' : '지우기'}
        </Button>
      </div>
    </Dialog>
  )
}
