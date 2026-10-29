import { useState } from 'react'
import { match } from 'ts-pattern'
import { COMMENT_BODY_MAX, createComment, deleteComment, updateComment, type Comment, type Post } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { useCommunity } from '../hooks/useCommunityGate'
import { usePostDetail } from '../hooks/usePostDetail'
import { canDelete, canEdit, canReport, communityErrorMessages, contentView, postedAtLabel } from '../model/community'
import { CommunityBodyForm } from './CommunityBodyForm'
import { ContentBody, DeleteDialog, LikeButton } from './CommunityContentParts'
import { CommunityMenu, type MenuItem } from './CommunityMenu'
import { CommunityReportDialog } from './CommunityReportDialog'

interface CommunityCommentsProps {
  post: Post
  now: Date
  /** 댓글을 쓰면 +1, 지우면 -1(글 카드의 댓글 수) */
  onCountChange: (delta: number) => void
}

/**
 * 글의 댓글과 답글(한 단계, FS-58). 쓰고 고치고 지운 뒤에는 서버에서 다시 받아 '삭제된 댓글' 규칙을 서버와 맞춘다.
 * 댓글은 보이는 글에만 쓴다.
 */
export function CommunityComments({ post, now, onCountChange }: CommunityCommentsProps) {
  const gate = useCommunity()
  const detail = usePostDetail(post.postId)
  const write = useAsyncAction<void>()

  const submit = async (body: string, parentId: number | null): Promise<void> => {
    await gate.withNickname(() => createComment(post.postId, body, parentId))
    onCountChange(1)
    detail.refresh()
  }
  const handlers: CommentHandlers = {
    now,
    reply: submit,
    changed: (delta) => {
      if (delta !== 0) onCountChange(delta)
      detail.refresh()
    },
    liked: (commentId, patch) => detail.dispatch({ type: 'patch-comment', commentId, patch }),
  }

  return (
    <section className="community-comments" aria-label="댓글">
      {match(detail.state)
        .with({ status: 'loading' }, () => <Skeleton label="댓글을 불러오는 중입니다…" shape="line" count={2} />)
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={detail.refresh} messages={communityErrorMessages} />
        ))
        .with({ status: 'success' }, ({ data }) =>
          data.comments.length === 0 ? (
            <EmptyState title="아직 댓글이 없어요." />
          ) : (
            <ul className="community-comments__list">
              {data.comments.map((comment) => (
                <li key={comment.commentId}>
                  <CommentItem comment={comment} replyable={post.state === 'VISIBLE'} handlers={handlers} />
                </li>
              ))}
            </ul>
          ),
        )
        .exhaustive()}

      {post.state === 'VISIBLE' && (
        <CommunityBodyForm
          label="댓글 쓰기"
          placeholder="댓글을 남겨 보세요"
          maxLength={COMMENT_BODY_MAX}
          submitLabel="댓글 올리기"
          rows={2}
          saving={write.state.status === 'loading'}
          onSubmit={async (body) => {
            if (!gate.requireLogin()) return false
            let done = false
            await write.run(async () => {
              await submit(body, null)
              done = true
            })
            return done
          }}
          error={write.state.status === 'error' ? <ErrorState error={write.state.error} messages={communityErrorMessages} /> : undefined}
        />
      )}
    </section>
  )
}

interface CommentHandlers {
  now: Date
  reply: (body: string, parentId: number) => Promise<void>
  /** 고치거나 지웠다. 지우면 delta -1 */
  changed: (delta: number) => void
  liked: (commentId: number, patch: { liked: boolean; likeCount: number }) => void
}

type Mode = { kind: 'view' } | { kind: 'edit' } | { kind: 'reply' } | { kind: 'report' } | { kind: 'delete' }

/** 댓글 하나와 그 답글. 답글에는 다시 답글을 달 수 없다 */
function CommentItem({ comment, replyable, handlers }: { comment: Comment; replyable: boolean; handlers: CommentHandlers }) {
  const gate = useCommunity()
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const action = useAsyncAction<void>()
  const view = contentView(comment)
  const isReply = comment.parentId !== null
  const noun = isReply ? '답글' : '댓글'

  const menu: MenuItem[] = [
    ...(canReport(comment) ? [{ label: '신고', onSelect: () => gate.requireLogin() && setMode({ kind: 'report' }) }] : []),
    ...(canEdit(comment) ? [{ label: '수정', onSelect: () => { action.reset(); setMode({ kind: 'edit' }) } }] : []),
    ...(canDelete(comment) ? [{ label: '삭제', onSelect: () => setMode({ kind: 'delete' }) }] : []),
  ]
  const formError = action.state.status === 'error'
    ? <ErrorState error={action.state.error} messages={communityErrorMessages} />
    : undefined

  return (
    <article className={isReply ? 'community-comment community-comment--reply' : 'community-comment'} aria-label={`${comment.author.nickname}님의 ${noun}`}>
      <header className="community-card__head">
        <p className="community-meta">
          <strong>{comment.author.nickname}</strong>
          {comment.author.mine && <span className="community-meta__mine">내 {noun}</span>}
          <span aria-hidden="true">·</span>
          <time dateTime={comment.createdAt}>{postedAtLabel(comment.createdAt, handlers.now)}</time>
          {comment.editedAt !== null && <span>(수정됨)</span>}
        </p>
        <CommunityMenu label={`${comment.author.nickname}님의 ${noun} 메뉴`} items={menu} />
      </header>

      {match(mode)
        .with({ kind: 'edit' }, () => (
          <CommunityBodyForm
            label={`${noun} 고치기`}
            initial={view.kind === 'visible' ? view.body : ''}
            maxLength={COMMENT_BODY_MAX}
            submitLabel="고치기"
            rows={2}
            saving={action.state.status === 'loading'}
            onCancel={() => setMode({ kind: 'view' })}
            onSubmit={async (body) => {
              await action.run(async () => {
                await updateComment(comment.commentId, body)
                setMode({ kind: 'view' })
                handlers.changed(0)
              })
              return false
            }}
            error={formError}
          />
        ))
        .otherwise(() => <ContentBody view={view} noun="댓글" onRepostRequested={() => handlers.changed(0)} />)}

      <div className="community-card__actions">
        <LikeButton
          target={{ type: 'comment', commentId: comment.commentId }}
          liked={comment.liked}
          likeCount={comment.likeCount}
          available={comment.state === 'VISIBLE'}
          onChange={(result) => handlers.liked(comment.commentId, result)}
        />
        {!isReply && replyable && comment.state === 'VISIBLE' && (
          <Button
            variant="link"
            className="community-action"
            aria-expanded={mode.kind === 'reply'}
            onClick={() => {
              if (!gate.requireLogin()) return
              action.reset()
              setMode(mode.kind === 'reply' ? { kind: 'view' } : { kind: 'reply' })
            }}
          >
            답글
          </Button>
        )}
      </div>

      {mode.kind === 'reply' && (
        <CommunityBodyForm
          label={`${comment.author.nickname}님에게 답글 쓰기`}
          maxLength={COMMENT_BODY_MAX}
          submitLabel="답글 올리기"
          rows={2}
          saving={action.state.status === 'loading'}
          onCancel={() => setMode({ kind: 'view' })}
          onSubmit={async (body) => {
            await action.run(async () => {
              await handlers.reply(body, comment.commentId)
              setMode({ kind: 'view' })
            })
            return false
          }}
          error={formError}
        />
      )}

      {comment.replies.length > 0 && (
        <ul className="community-comments__replies">
          {comment.replies.map((reply) => (
            <li key={reply.commentId}>
              <CommentItem comment={reply} replyable={false} handlers={handlers} />
            </li>
          ))}
        </ul>
      )}

      {match(mode)
        .with({ kind: 'report' }, () => (
          <CommunityReportDialog
            target={{ type: 'comment', commentId: comment.commentId }}
            noun="댓글"
            onClose={() => setMode({ kind: 'view' })}
          />
        ))
        .with({ kind: 'delete' }, () => (
          <DeleteDialog
            noun="댓글"
            onClose={() => setMode({ kind: 'view' })}
            onConfirm={async () => {
              await deleteComment(comment.commentId)
              setMode({ kind: 'view' })
              handlers.changed(-1)
            }}
          />
        ))
        .with({ kind: 'view' }, { kind: 'edit' }, { kind: 'reply' }, () => null)
        .exhaustive()}
    </article>
  )
}
