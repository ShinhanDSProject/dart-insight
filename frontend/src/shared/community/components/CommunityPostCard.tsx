import { useState } from 'react'
import { match } from 'ts-pattern'
import { deletePost, POST_BODY_MAX, updatePost, type Post } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { formatInteger } from '@/shared/lib/numberFormat'
import { Button, Card } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useCommunity } from '../hooks/useCommunityGate'
import { canDelete, canEdit, canReport, communityErrorMessages, contentView, postedAtLabel, type PostsAction } from '../model/community'
import { CommunityBodyForm } from './CommunityBodyForm'
import { CommunityComments } from './CommunityComments'
import { ContentBody, DeleteDialog, LikeButton } from './CommunityContentParts'
import { CommunityMenu, type MenuItem } from './CommunityMenu'
import { CommunityQuoteCard } from './CommunityQuoteCard'
import { CommunityReportDialog } from './CommunityReportDialog'

/** view: 보기, edit: 본문 고치기, report: 신고 대화상자, delete: 지우기 확인 */
type Mode = { kind: 'view' } | { kind: 'edit' } | { kind: 'report' } | { kind: 'delete' }

interface CommunityPostCardProps {
  post: Post
  now: Date
  onChange: (action: Extract<PostsAction, { type: 'replace-post' | 'patch-post' | 'remove-post' }>) => void
}

/**
 * 글 카드(FS-58): 닉네임 · 몇 분 전 · 본문 · 붙인 변경점(#464) · 좋아요 · 댓글 · ⋯ 메뉴(신고, 내 글이면 수정·삭제).
 * 댓글은 '댓글'을 눌러 펼칠 때 불러온다.
 */
export function CommunityPostCard({ post, now, onChange }: CommunityPostCardProps) {
  const gate = useCommunity()
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const edit = useAsyncAction<Post>()
  const view = contentView(post)

  const menu: MenuItem[] = [
    ...(canReport(post)
      ? [{ label: '신고', onSelect: () => gate.requireLogin() && setMode({ kind: 'report' }) }]
      : []),
    ...(canEdit(post) ? [{ label: '수정', onSelect: () => { edit.reset(); setMode({ kind: 'edit' }) } }] : []),
    ...(canDelete(post) ? [{ label: '삭제', onSelect: () => setMode({ kind: 'delete' }) }] : []),
  ]

  return (
    <Card as="article" className="community-card" aria-labelledby={`post-${post.postId}-author`}>
      <header className="community-card__head">
        <p className="community-meta">
          <strong id={`post-${post.postId}-author`}>{post.author.nickname}</strong>
          {post.author.mine && <span className="community-meta__mine">내 글</span>}
          <span aria-hidden="true">·</span>
          <time dateTime={post.createdAt}>{postedAtLabel(post.createdAt, now)}</time>
          {post.editedAt !== null && <span>(수정됨)</span>}
        </p>
        <CommunityMenu label={`${post.author.nickname}님의 글 메뉴`} items={menu} />
      </header>

      {match(mode)
        .with({ kind: 'edit' }, () => (
          <CommunityBodyForm
            label="글 고치기"
            initial={view.kind === 'visible' ? view.body : ''}
            maxLength={POST_BODY_MAX}
            submitLabel="고치기"
            saving={edit.state.status === 'loading'}
            onCancel={() => setMode({ kind: 'view' })}
            onSubmit={async (body) => {
              await edit.run(async () => {
                const updated = await updatePost(post.postId, body)
                onChange({ type: 'replace-post', post: updated })
                setMode({ kind: 'view' })
                return updated
              })
              return false
            }}
            error={
              edit.state.status === 'error' ? <ErrorState error={edit.state.error} messages={communityErrorMessages} /> : undefined
            }
          />
        ))
        .otherwise(() => (
          <ContentBody
            view={view}
            noun="글"
            onRepostRequested={() =>
              post.blind && onChange({ type: 'replace-post', post: { ...post, blind: { ...post.blind, repostRequested: true } } })
            }
          />
        ))}

      {post.quote !== null && <CommunityQuoteCard quote={post.quote} />}

      <div className="community-card__actions">
        <LikeButton
          target={{ type: 'post', postId: post.postId }}
          liked={post.liked}
          likeCount={post.likeCount}
          available={post.state === 'VISIBLE'}
          onChange={(result) => onChange({ type: 'patch-post', postId: post.postId, patch: result })}
        />
        <Button
          variant="link"
          className="community-action"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((open) => !open)}
        >
          댓글 {formatInteger(post.commentCount)}
        </Button>
      </div>

      {commentsOpen && (
        <CommunityComments
          post={post}
          now={now}
          onCountChange={(delta) =>
            onChange({ type: 'patch-post', postId: post.postId, patch: { commentCount: Math.max(0, post.commentCount + delta) } })
          }
        />
      )}

      {match(mode)
        .with({ kind: 'report' }, () => (
          <CommunityReportDialog target={{ type: 'post', postId: post.postId }} noun="글" onClose={() => setMode({ kind: 'view' })} />
        ))
        .with({ kind: 'delete' }, () => (
          <DeleteDialog
            noun="글"
            onClose={() => setMode({ kind: 'view' })}
            onConfirm={async () => {
              await deletePost(post.postId)
              setMode({ kind: 'view' })
              onChange({ type: 'remove-post', postId: post.postId })
            }}
          />
        ))
        .with({ kind: 'view' }, { kind: 'edit' }, () => null)
        .exhaustive()}
    </Card>
  )
}
