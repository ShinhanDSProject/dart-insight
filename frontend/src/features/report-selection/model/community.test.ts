import { describe, expect, it } from 'vitest'
import type { Comment, Post, PostList } from '@/shared/api/community'
import {
  blindUntilLabel,
  bodyError,
  canDelete,
  canEdit,
  canReport,
  contentView,
  detailReducer,
  hasMorePosts,
  nicknameError,
  postedAtLabel,
  postsReducer,
  type PostsState,
} from './community'

const blind = { reportId: 8, reason: '확인되지 않은 합병설', blindUntil: '2026-11-03T10:15:00', expired: false, repostRequested: false }

function post(postId: number, overrides: Partial<Post> = {}): Post {
  return {
    postId,
    corpCode: '00126380',
    author: { nickname: '반도체공부중', mine: false },
    state: 'VISIBLE',
    body: `글 ${postId}`,
    quote: null,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    blind: null,
    createdAt: '2026-10-27T10:15:00',
    editedAt: null,
    ...overrides,
  }
}

function comment(commentId: number, overrides: Partial<Comment> = {}): Comment {
  return {
    commentId,
    parentId: null,
    author: { nickname: '댓글러', mine: false },
    state: 'VISIBLE',
    body: `댓글 ${commentId}`,
    likeCount: 0,
    liked: false,
    blind: null,
    createdAt: '2026-10-27T10:20:00',
    editedAt: null,
    replies: [],
    ...overrides,
  }
}

function page(items: Post[], pageNo: number, totalItems: number): PostList {
  return { corpCode: '00126380', sort: 'latest', page: pageNo, size: 20, totalItems, items }
}

function loaded(items: Post[], totalItems = items.length): PostsState {
  return postsReducer({ status: 'loading' }, { type: 'resolve', data: page(items, 0, totalItems) })
}

describe('글·댓글 보이기', () => {
  it('보이는 글은 본문, 지운 글은 삭제 안내다', () => {
    expect(contentView(post(1))).toEqual({ kind: 'visible', body: '글 1' })
    expect(contentView(post(1, { state: 'DELETED', body: null }))).toEqual({ kind: 'deleted' })
  })

  it('가려진 글은 다른 사람에게 안내만, 작성자에게는 본문과 사유를 보인다', () => {
    expect(contentView(post(1, { state: 'BLINDED', body: null }))).toEqual({ kind: 'blinded' })
    expect(contentView(post(1, { state: 'BLINDED', body: '내 글', blind, author: { nickname: '나', mine: true } }))).toEqual({
      kind: 'blinded-mine',
      body: '내 글',
      blind,
    })
  })

  it('수정은 보이는 내 것만, 삭제는 지우지 않은 내 것만, 신고는 보이는 남의 것만 된다', () => {
    const mine = { nickname: '나', mine: true }
    expect(canEdit(post(1, { author: mine }))).toBe(true)
    expect(canEdit(post(1, { author: mine, state: 'BLINDED' }))).toBe(false)
    expect(canEdit(post(1))).toBe(false)
    expect(canDelete(post(1, { author: mine, state: 'BLINDED' }))).toBe(true)
    expect(canDelete(post(1, { author: mine, state: 'DELETED' }))).toBe(false)
    expect(canDelete(post(1))).toBe(false)
    expect(canReport(post(1))).toBe(true)
    expect(canReport(post(1, { author: mine }))).toBe(false)
    expect(canReport(post(1, { state: 'BLINDED' }))).toBe(false)
  })
})

describe('입력 규칙', () => {
  it('닉네임은 앞뒤 공백을 지운 2~12자 한글·영문·숫자다', () => {
    expect(nicknameError(' 반도체공부중 ')).toBeNull()
    expect(nicknameError('ab12')).toBeNull()
    expect(nicknameError('가')).toBe('2~12자로 정해 주세요.')
    expect(nicknameError('가나다라마바사아자차카타파')).toBe('2~12자로 정해 주세요.')
    expect(nicknameError('반도체 공부')).toBe('한글·영문·숫자만 쓸 수 있어요(공백·특수문자 없이).')
    expect(nicknameError('ㅋㅋㅋ')).toBe('한글·영문·숫자만 쓸 수 있어요(공백·특수문자 없이).')
  })

  it('본문은 앞뒤 공백을 지운 1자 이상, 최대 글자 수 이하다', () => {
    expect(bodyError('  의견  ', 500)).toBeNull()
    expect(bodyError('   ', 500)).toBe('내용을 적어 주세요.')
    expect(bodyError('가'.repeat(2001), 2000)).toBe('2,000자까지 쓸 수 있어요.')
  })
})

describe('시각 표시', () => {
  it('한국 시간 시각을 몇 분 전으로 보인다', () => {
    const now = new Date('2026-10-27T01:20:00Z') // 한국 10:20
    expect(postedAtLabel('2026-10-27T10:15:00', now)).toBe('5분 전')
    expect(postedAtLabel('2026-10-10T10:15:00', now)).toBe('2026.10.10')
  })

  it('블라인드 기한은 날짜와 시각으로 보인다', () => {
    expect(blindUntilLabel('2026-11-03T10:15:00')).toBe('2026.11.03 10:15')
  })
})

describe('글 목록 상태', () => {
  it('더 보기는 다음 쪽을 이어 붙이고, 이미 있는 글은 다시 넣지 않는다', () => {
    const first = loaded([post(3), post(2)], 4)
    expect(first.status === 'success' && hasMorePosts(first)).toBe(true)

    const loading = postsReducer(first, { type: 'more-start' })
    const next = postsReducer(loading, { type: 'more-resolve', data: page([post(2), post(1)], 1, 4) })

    expect(next.status === 'success' && next.items.map((p) => p.postId)).toEqual([3, 2, 1])
    expect(next.status === 'success' && next.nextPage).toBe(2)
  })

  it('더 보기가 실패하면 받은 글은 그대로 두고 실패만 알린다', () => {
    const state = postsReducer(postsReducer(loaded([post(1)], 2), { type: 'more-start' }), { type: 'more-reject', error: 'x' })
    expect(state.status === 'success' && state.items).toHaveLength(1)
    expect(state.status === 'success' && state.more).toEqual({ status: 'error', error: 'x' })
  })

  it('새 글은 맨 위에 더하고 전체 수를 늘린다', () => {
    const state = postsReducer(loaded([post(1)]), { type: 'add-post', post: post(2) })
    expect(state.status === 'success' && state.items.map((p) => p.postId)).toEqual([2, 1])
    expect(state.status === 'success' && state.totalItems).toBe(2)
  })

  it('지운 글은 댓글이 있으면 삭제된 글로 남고, 없으면 빠진다', () => {
    const state = loaded([post(1, { commentCount: 2, liked: true }), post(2)])
    const removedWithComments = postsReducer(state, { type: 'remove-post', postId: 1 })
    const removed = postsReducer(removedWithComments, { type: 'remove-post', postId: 2 })

    expect(removed.status === 'success' && removed.items).toEqual([
      { ...post(1, { commentCount: 2 }), state: 'DELETED', body: null, liked: false },
    ])
    expect(removed.status === 'success' && removed.totalItems).toBe(1)
  })

  it('좋아요·댓글 수는 그 글만 바꾼다', () => {
    const state = postsReducer(loaded([post(1), post(2)]), {
      type: 'patch-post',
      postId: 2,
      patch: { liked: true, likeCount: 4 },
    })
    expect(state.status === 'success' && state.items.map((p) => [p.liked, p.likeCount])).toEqual([
      [false, 0],
      [true, 4],
    ])
  })

  it('목록을 받기 전에는 바꾸지 않는다', () => {
    expect(postsReducer({ status: 'loading' }, { type: 'add-post', post: post(1) })).toEqual({ status: 'loading' })
  })
})

describe('댓글 상태', () => {
  const detail = { post: post(1), comments: [comment(10, { replies: [comment(11, { parentId: 10 })] })] }

  it('답글의 좋아요도 그 자리에서 바꾼다', () => {
    const state = detailReducer({ status: 'success', data: detail }, {
      type: 'patch-comment',
      commentId: 11,
      patch: { liked: true, likeCount: 1 },
    })
    expect(state.status === 'success' && state.data.comments[0].replies[0].liked).toBe(true)
    expect(state.status === 'success' && state.data.comments[0].liked).toBe(false)
  })

  it('다시 받는 동안과 다시 받다 실패해도 지금 댓글은 그대로 보인다', () => {
    const success = { status: 'success', data: detail } as const
    expect(detailReducer(success, { type: 'start' })).toBe(success)
    expect(detailReducer(success, { type: 'reject', error: 'x' })).toBe(success)
    expect(detailReducer({ status: 'loading' }, { type: 'reject', error: 'x' })).toEqual({ status: 'error', error: 'x' })
  })
})
