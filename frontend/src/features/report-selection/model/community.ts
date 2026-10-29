import { match } from 'ts-pattern'
import type { Blind, Comment, ContentState, Post, PostDetail, PostList, PostSort } from '@/shared/api/community'
import { formatInteger } from '@/shared/lib/numberFormat'
import { viewedAtLabel } from '@/shared/lib/recentAnalyses'
import type { SegmentOption } from '@/shared/ui'

/** 커뮤니티 탭 맨 위에 고정하는 문구(FS-58). 이용자 글을 서비스의 분석과 섞어 보이지 않게 한다 */
export const COMMUNITY_DISCLAIMER = '이용자 의견이며 서비스의 분석이 아닙니다.'

export const sortOptions: readonly SegmentOption<PostSort>[] = [
  { value: 'popular', label: '인기순' },
  { value: 'latest', label: '최신순' },
]

/** 서버 에러 코드별 안내(API-3). 없는 코드는 서버 message를 그대로 쓴다 */
export const communityErrorMessages: Record<string, string> = {
  AUTH_UNAUTHORIZED: '로그인이 끝났어요. 다시 로그인해 주세요.',
  COMMUNITY_FORBIDDEN: '내 글·댓글만 고치거나 지울 수 있고, 내 글·댓글은 신고할 수 없어요.',
  COMMUNITY_POST_NOT_FOUND: '지워진 글이에요.',
  COMMUNITY_COMMENT_NOT_FOUND: '지워진 댓글이에요.',
  COMMUNITY_TARGET_UNAVAILABLE: '가려지거나 지워진 글·댓글이라 할 수 없어요.',
  COMMUNITY_NICKNAME_REQUIRED: '닉네임을 정해야 글·댓글을 쓸 수 있어요.',
  COMMUNITY_NICKNAME_TAKEN: '이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.',
  COMMUNITY_ALREADY_REPORTED: '이미 신고했어요. 관리자가 확인하고 처리해요.',
  COMMUNITY_REPOST_ALREADY_REQUESTED: '이미 재게시를 청구했어요. 관리자가 다시 판단해요.',
  COMMUNITY_REPOST_NOT_ALLOWED: '지금은 재게시를 청구할 수 없어요.',
}

/**
 * 글·댓글을 어떻게 보일지(FS-58). 가려진 글은 다른 사람에게 한 줄 안내만, 작성자에게는 본문·사유·기한을 보인다.
 * 지운 글·댓글은 '삭제된 …입니다'만 남는다(달린 댓글·답글은 그대로).
 */
export type ContentView =
  | { kind: 'visible'; body: string }
  | { kind: 'blinded' }
  | { kind: 'blinded-mine'; body: string; blind: Blind }
  | { kind: 'deleted' }

export function contentView(content: { state: ContentState; body: string | null; blind: Blind | null }): ContentView {
  return match(content)
    .with({ state: 'VISIBLE' }, ({ body }): ContentView => ({ kind: 'visible', body: body ?? '' }))
    .with({ state: 'BLINDED' }, ({ body, blind }): ContentView =>
      blind !== null && body !== null ? { kind: 'blinded-mine', body, blind } : { kind: 'blinded' },
    )
    .with({ state: 'DELETED' }, (): ContentView => ({ kind: 'deleted' }))
    .exhaustive()
}

/** 쓴 시각 표시('3분 전', 7일이 넘으면 날짜). 서버 시각은 한국 시간이고 시간대 표시가 없어 +09:00을 붙여 읽는다 */
export function postedAtLabel(kstDateTime: string, now: Date): string {
  return viewedAtLabel(`${kstDateTime}+09:00`, now)
}

/** 내 글·댓글이고 보이는 상태일 때만 고칠 수 있다(서버도 VISIBLE만 고친다) */
export function canEdit(content: { state: ContentState; author: { mine: boolean } }): boolean {
  return content.author.mine && content.state === 'VISIBLE'
}

/** 내 것이면 지울 수 있다(가려진 내 글도 지울 수 있음). 이미 지운 것은 빼고 */
export function canDelete(content: { state: ContentState; author: { mine: boolean } }): boolean {
  return content.author.mine && content.state !== 'DELETED'
}

/** 남의 것이고 보이는 상태일 때만 신고할 수 있다 */
export function canReport(content: { state: ContentState; author: { mine: boolean } }): boolean {
  return !content.author.mine && content.state === 'VISIBLE'
}

/** 닉네임 규칙(api-spec): 앞뒤 공백을 지운 2~12자, 한글 완성형·영문·숫자만. 맞으면 null */
export function nicknameError(raw: string): string | null {
  const nickname = raw.trim()
  if (nickname.length < 2 || nickname.length > 12) return '2~12자로 정해 주세요.'
  if (!/^[가-힣A-Za-z0-9]+$/.test(nickname)) return '한글·영문·숫자만 쓸 수 있어요(공백·특수문자 없이).'
  return null
}

/** 본문 길이(앞뒤 공백을 지운 1~max자). 맞으면 null */
export function bodyError(raw: string, max: number): string | null {
  const body = raw.trim()
  if (body.length === 0) return '내용을 적어 주세요.'
  if (body.length > max) return `${formatInteger(max)}자까지 쓸 수 있어요.`
  return null
}

/** 글 목록 상태(ST-1). 처음 쪽을 받은 뒤 '더 보기'로 다음 쪽을 이어 붙인다 */
export type PostsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; items: Post[]; totalItems: number; nextPage: number; more: MoreState }

/** '더 보기' 요청 상태 */
export type MoreState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown }

export type PostsAction =
  | { type: 'start' }
  | { type: 'resolve'; data: PostList }
  | { type: 'reject'; error: unknown }
  | { type: 'more-start' }
  | { type: 'more-resolve'; data: PostList }
  | { type: 'more-reject'; error: unknown }
  /** 새로 쓴 글을 맨 위에 */
  | { type: 'add-post'; post: Post }
  /** 서버가 돌려준 글(고친 글)로 바꾼다 */
  | { type: 'replace-post'; post: Post }
  /** 글 하나의 값만 바꾼다(좋아요·댓글 수) */
  | { type: 'patch-post'; postId: number; patch: Partial<Pick<Post, 'liked' | 'likeCount' | 'commentCount'>> }
  /** 지운 글. 댓글이 남아 있으면 '삭제된 글'로 두고, 없으면 뺀다(서버 목록과 같은 규칙) */
  | { type: 'remove-post'; postId: number }

export function postsReducer(state: PostsState, action: PostsAction): PostsState {
  return match<PostsAction, PostsState>(action)
    .with({ type: 'start' }, () => ({ status: 'loading' }))
    .with({ type: 'resolve' }, ({ data }) =>
      state.status === 'loading'
        ? { status: 'success', items: data.items, totalItems: data.totalItems, nextPage: data.page + 1, more: { status: 'idle' } }
        : state,
    )
    .with({ type: 'reject' }, ({ error }) => (state.status === 'loading' ? { status: 'error', error } : state))
    .with({ type: 'more-start' }, () => (state.status === 'success' ? { ...state, more: { status: 'loading' } } : state))
    .with({ type: 'more-resolve' }, ({ data }) =>
      state.status === 'success' && state.more.status === 'loading'
        ? {
            ...state,
            // 그사이 새 글이 생겨 밀려 온 글은 한 번만 보인다
            items: [...state.items, ...data.items.filter((post) => !state.items.some((p) => p.postId === post.postId))],
            totalItems: data.totalItems,
            nextPage: data.page + 1,
            more: { status: 'idle' },
          }
        : state,
    )
    .with({ type: 'more-reject' }, ({ error }) =>
      state.status === 'success' && state.more.status === 'loading' ? { ...state, more: { status: 'error', error } } : state,
    )
    .with({ type: 'add-post' }, ({ post }) =>
      state.status === 'success' ? { ...state, items: [post, ...state.items], totalItems: state.totalItems + 1 } : state,
    )
    .with({ type: 'replace-post' }, ({ post }) => mapPosts(state, post.postId, () => post))
    .with({ type: 'patch-post' }, ({ postId, patch }) => mapPosts(state, postId, (current) => ({ ...current, ...patch })))
    .with({ type: 'remove-post' }, ({ postId }) => {
      if (state.status !== 'success') return state
      const target = state.items.find((post) => post.postId === postId)
      if (!target) return state
      if (target.commentCount > 0) return mapPosts(state, postId, deletedPost)
      return { ...state, items: state.items.filter((post) => post.postId !== postId), totalItems: state.totalItems - 1 }
    })
    .exhaustive()
}

function mapPosts(state: PostsState, postId: number, update: (post: Post) => Post): PostsState {
  if (state.status !== 'success') return state
  return { ...state, items: state.items.map((post) => (post.postId === postId ? update(post) : post)) }
}

function deletedPost(post: Post): Post {
  return { ...post, state: 'DELETED', body: null, quote: null, blind: null, liked: false }
}

/** 더 볼 글이 남았는지 */
export function hasMorePosts(state: Extract<PostsState, { status: 'success' }>): boolean {
  return state.items.length < state.totalItems
}

/** 글 상세(댓글) 상태. 댓글 쓰기·고치기·지우기 뒤에는 서버에서 다시 받고, 좋아요는 그 자리에서 바꾼다 */
export type DetailState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: PostDetail }

export type DetailAction =
  | { type: 'start' }
  | { type: 'resolve'; data: PostDetail }
  | { type: 'reject'; error: unknown }
  | { type: 'patch-comment'; commentId: number; patch: Partial<Pick<Comment, 'liked' | 'likeCount'>> }

export function detailReducer(state: DetailState, action: DetailAction): DetailState {
  return match<DetailAction, DetailState>(action)
    .with({ type: 'start' }, () => (state.status === 'success' ? state : { status: 'loading' }))
    .with({ type: 'resolve' }, ({ data }) => ({ status: 'success', data }))
    .with({ type: 'reject' }, ({ error }) => (state.status === 'success' ? state : { status: 'error', error }))
    .with({ type: 'patch-comment' }, ({ commentId, patch }) => {
      if (state.status !== 'success') return state
      const update = (comment: Comment): Comment => ({
        ...(comment.commentId === commentId ? { ...comment, ...patch } : comment),
        replies: comment.replies.map((reply) => (reply.commentId === commentId ? { ...reply, ...patch } : reply)),
      })
      return { status: 'success', data: { ...state.data, comments: state.data.comments.map(update) } }
    })
    .exhaustive()
}
