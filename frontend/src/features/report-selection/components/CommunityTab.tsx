import { useId, useReducer, useState } from 'react'
import { match } from 'ts-pattern'
import { createPost, POST_BODY_MAX, type Post, type PostSort } from '@/shared/api/community'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, ButtonLink, Dialog, Notice, SegmentedControl, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { CommunityGateContext, useCommunityGate } from '../hooks/useCommunityGate'
import { useCommunityPosts } from '../hooks/useCommunityPosts'
import { COMMUNITY_DISCLAIMER, communityErrorMessages, hasMorePosts, sortOptions } from '../model/community'
import { EMPTY_COMPOSER, quoteComposerReducer } from '../model/postQuote'
import { CommunityBodyForm } from './CommunityBodyForm'
import { CommunityPostCard } from './CommunityPostCard'
import { QuotePreview } from './CommunityQuoteCard'
import { NicknameDialog } from './NicknameDialog'
import { QuotePickerDialog } from './QuotePickerDialog'

/**
 * 기업 화면의 커뮤니티 탭(FS-58, W-01 ②). 위에서부터 고정 문구, 글쓰기(변경점 붙이기 #464), 정렬, 글 카드.
 * 읽기는 로그인 없이 되고, 쓰기·좋아요·신고를 누르면 로그인 안내가 뜬다. 닉네임이 없으면 처음 쓸 때 닉네임 정하기가 먼저 뜬다.
 * 글을 불러오지 못해도 이 탭 안에서만 안내하므로 다른 탭은 그대로 쓴다.
 */
export function CommunityTab({ corpCode }: { corpCode: string }) {
  const gate = useCommunityGate()
  const [sort, setSort] = useState<PostSort>('latest')
  const posts = useCommunityPosts(corpCode, sort)
  const write = useAsyncAction<Post>()
  // 글에 붙일 변경점(#464)과 고르기 대화상자
  const [composer, dispatchQuote] = useReducer(quoteComposerReducer, EMPTY_COMPOSER)
  const quote = composer.pick
  // 몇 분 전 표시의 기준. 그릴 때마다 정해 방금 쓴 글도 '방금 전'으로 보인다
  const now = new Date()
  const sortLabelId = useId()

  return (
    <CommunityGateContext.Provider value={gate}>
      <div className="community">
        <Notice as="p" className="community__disclaimer">
          {COMMUNITY_DISCLAIMER}
        </Notice>

        <CommunityBodyForm
          label="글쓰기"
          labelHidden
          placeholder="이 기업 어떻게 보세요?"
          maxLength={POST_BODY_MAX}
          submitLabel="올리기"
          saving={write.state.status === 'loading'}
          attachment={
            quote === null ? (
              <Button variant="link" className="community-form__attach" onClick={() => dispatchQuote({ type: 'open-picker' })}>
                변경점 붙이기
              </Button>
            ) : (
              <QuotePreview pick={quote} onRemove={() => dispatchQuote({ type: 'remove' })} disabled={write.state.status === 'loading'} />
            )
          }
          onSubmit={async (body) => {
            if (!gate.requireLogin()) return false
            let done = false
            await write.run(async () => {
              const post = await gate.withNickname(() => createPost(corpCode, body, quote?.request ?? null))
              posts.dispatch({ type: 'add-post', post })
              dispatchQuote({ type: 'remove' })
              done = true
              return post
            })
            return done
          }}
          error={write.state.status === 'error' ? <ErrorState error={write.state.error} messages={communityErrorMessages} /> : undefined}
        />

        <div className="community__toolbar">
          <span id={sortLabelId} className="visually-hidden">
            글 정렬
          </span>
          <SegmentedControl aria-labelledby={sortLabelId} options={sortOptions} value={sort} onChange={setSort} />
        </div>

        {match(posts.state)
          .with({ status: 'loading' }, () => <Skeleton label="글을 불러오는 중입니다…" shape="line" count={4} />)
          .with({ status: 'error' }, ({ error }) => (
            <ErrorState error={error} onRetry={posts.reload} messages={communityErrorMessages} />
          ))
          .with({ status: 'success' }, (state) =>
            state.items.length === 0 ? (
              <EmptyState title="아직 글이 없습니다. 첫 의견을 남겨 보세요" />
            ) : (
              <>
                <ul className="community__list" aria-label="글 목록">
                  {state.items.map((post) => (
                    <li key={post.postId}>
                      <CommunityPostCard post={post} now={now} onChange={posts.dispatch} />
                    </li>
                  ))}
                </ul>
                {hasMorePosts(state) && (
                  <div className="community__more">
                    {state.more.status === 'error' && (
                      <ErrorState error={state.more.error} messages={communityErrorMessages} />
                    )}
                    <Button onClick={posts.loadMore} disabled={state.more.status === 'loading'}>
                      {state.more.status === 'loading' ? '불러오는 중…' : '글 더 보기'}
                    </Button>
                  </div>
                )}
              </>
            ),
          )
          .exhaustive()}
      </div>

      {match(gate.dialog)
        .with({ kind: 'login' }, () => <LoginDialog onClose={gate.closeDialog} />)
        .with({ kind: 'nickname' }, () => <NicknameDialog onSaved={gate.nicknameSaved} onClose={gate.closeDialog} />)
        .with({ kind: 'none' }, () => null)
        .exhaustive()}
      {composer.picking && (
        <QuotePickerDialog
          corpCode={corpCode}
          onClose={() => dispatchQuote({ type: 'close-picker' })}
          onPick={(pick) => dispatchQuote({ type: 'pick', pick })}
        />
      )}
    </CommunityGateContext.Provider>
  )
}

function LoginDialog({ onClose }: { onClose: () => void }) {
  const id = useId()
  return (
    <Dialog titleId={`${id}-title`} title="로그인이 필요해요" onClose={onClose} className="community-dialog">
      <p>글·댓글을 쓰고 좋아요·신고를 하려면 로그인해 주세요. 글은 로그인하지 않아도 읽을 수 있어요.</p>
      <div className="community-dialog__actions">
        <Button onClick={onClose}>계속 읽기</Button>
        <ButtonLink variant="primary" to="/login">
          로그인하기
        </ButtonLink>
      </div>
    </Dialog>
  )
}
