// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { Comment, Post, PostDetail, PostList } from '@/shared/api/community'
import { AuthContext, type AuthContextValue, type AuthState } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { CommunityTab } from './CommunityTab'

const getPosts = vi.fn<(corpCode: string, sort: string, page: number) => Promise<PostList>>()
const getPostDetail = vi.fn<(postId: number) => Promise<PostDetail>>()
const createPost = vi.fn<(corpCode: string, body: string, quote?: unknown) => Promise<Post>>()
const setNickname = vi.fn<(nickname: string) => Promise<{ nickname: string }>>()
const reportContent = vi.fn<(target: unknown, reason: string) => Promise<void>>()
const requestRepost = vi.fn<(reportId: number, message: string | null) => Promise<unknown>>()

vi.mock('@/shared/api/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/community')>()),
  getPosts: (corpCode: string, sort: string, page: number) => getPosts(corpCode, sort, page),
  getPostDetail: (postId: number) => getPostDetail(postId),
  createPost: (corpCode: string, body: string, quote?: unknown) => createPost(corpCode, body, quote),
  setNickname: (nickname: string) => setNickname(nickname),
  reportContent: (target: unknown, reason: string) => reportContent(target, reason),
  requestRepost: (reportId: number, message: string | null) => requestRepost(reportId, message),
}))

const other = { nickname: '반도체공부중', mine: false }
const me = { nickname: '나', mine: true }

function post(postId: number, overrides: Partial<Post> = {}): Post {
  return {
    postId,
    corpCode: '00126380',
    author: other,
    state: 'VISIBLE',
    body: `HBM 이야기 ${postId}`,
    quote: null,
    likeCount: 1,
    commentCount: 0,
    liked: false,
    blind: null,
    createdAt: '2026-10-27T10:15:00',
    editedAt: null,
    ...overrides,
  }
}

function list(items: Post[]): PostList {
  return { corpCode: '00126380', sort: 'latest', page: 0, size: 20, totalItems: items.length, items }
}

function comment(commentId: number, overrides: Partial<Comment> = {}): Comment {
  return {
    commentId,
    parentId: null,
    author: other,
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

function auth(state: AuthState): AuthContextValue {
  return { state, login: vi.fn(), logout: vi.fn() }
}

function renderTab(state: AuthState = { status: 'authenticated', userId: 1 }) {
  return render(
    <AuthContext.Provider value={auth(state)}>
      <MemoryRouter>
        <CommunityTab corpCode="00126380" />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  getPosts.mockReset().mockResolvedValue(list([post(1)]))
  getPostDetail.mockReset()
  createPost.mockReset()
  setNickname.mockReset()
  reportContent.mockReset()
  requestRepost.mockReset()
})
afterEach(cleanup)

describe('커뮤니티 탭', () => {
  it('맨 위에 고정 문구가 있고 글 카드에 닉네임·본문·좋아요·댓글 수를 보인다', async () => {
    const { container } = renderTab({ status: 'anonymous' })

    expect(screen.getByText('이용자 의견이며 서비스의 분석이 아닙니다.')).toBeTruthy()
    const card = await screen.findByRole('article', { name: '반도체공부중' })
    expect(within(card).getByText('HBM 이야기 1')).toBeTruthy()
    expect(within(card).getByRole('button', { name: '좋아요 1' })).toBeTruthy()
    expect(within(card).getByRole('button', { name: '댓글 0' })).toBeTruthy()
    expect(getPosts).toHaveBeenCalledWith('00126380', 'latest', 0)
    expect(await axeViolations(container)).toBe('')
  })

  it('인기순을 고르면 인기순으로 다시 받는다', async () => {
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '인기순' }))

    await waitFor(() => expect(getPosts).toHaveBeenLastCalledWith('00126380', 'popular', 0))
  })

  it('글이 없으면 첫 의견을 남기라고 안내한다', async () => {
    getPosts.mockResolvedValue(list([]))
    renderTab()

    expect(await screen.findByText('아직 글이 없습니다. 첫 의견을 남겨 보세요')).toBeTruthy()
  })

  it('불러오지 못하면 안내와 다시 시도를 보이고, 다시 시도하면 다시 받는다', async () => {
    getPosts.mockRejectedValueOnce(
      new ApiError(500, { code: 'COMMON_INTERNAL_ERROR', message: '서버에서 오류가 발생했습니다.', traceId: 't-1', errors: [] }),
    )
    renderTab()

    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('HBM 이야기 1')).toBeTruthy()
    expect(getPosts).toHaveBeenCalledTimes(2)
  })

  it('로그인하지 않으면 읽기만 되고, 올리기·좋아요·신고를 누르면 로그인 안내가 뜬다', async () => {
    renderTab({ status: 'anonymous' })
    await screen.findByText('HBM 이야기 1')

    fireEvent.change(screen.getByLabelText('글쓰기'), { target: { value: '의견' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))
    expect(screen.getByRole('dialog', { name: '로그인이 필요해요' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
    fireEvent.click(screen.getByRole('button', { name: '계속 읽기' }))

    fireEvent.click(screen.getByRole('button', { name: '좋아요 1' }))
    expect(screen.getByRole('dialog', { name: '로그인이 필요해요' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '계속 읽기' }))

    fireEvent.click(screen.getByRole('button', { name: '반도체공부중님의 글 메뉴' }))
    fireEvent.click(screen.getByRole('button', { name: '신고' }))
    expect(screen.getByRole('dialog', { name: '로그인이 필요해요' })).toBeTruthy()
    expect(createPost).not.toHaveBeenCalled()
  })

  it('닉네임이 없으면 올릴 때 닉네임 정하기가 먼저 뜨고, 정하면 같은 글을 올린다', async () => {
    createPost
      .mockRejectedValueOnce(
        new ApiError(409, { code: 'COMMUNITY_NICKNAME_REQUIRED', message: '닉네임 필요', traceId: null, errors: [] }),
      )
      .mockResolvedValueOnce(post(2, { author: { nickname: '새닉네임', mine: true }, body: '첫 의견' }))
    setNickname
      .mockRejectedValueOnce(new ApiError(409, { code: 'COMMUNITY_NICKNAME_TAKEN', message: '중복', traceId: null, errors: [] }))
      .mockResolvedValueOnce({ nickname: '새닉네임' })
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.change(screen.getByLabelText('글쓰기'), { target: { value: '  첫 의견 ' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))

    const dialog = await screen.findByRole('dialog', { name: '닉네임 정하기' })
    fireEvent.change(within(dialog).getByLabelText('닉네임'), { target: { value: '반도체공부중' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '정하고 올리기' }))
    expect(await within(dialog).findByText('이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.')).toBeTruthy()

    fireEvent.change(within(dialog).getByLabelText('닉네임'), { target: { value: '새닉네임' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '정하고 올리기' }))

    expect(await screen.findByText('첫 의견')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(createPost).toHaveBeenNthCalledWith(2, '00126380', '첫 의견', null)
    expect((screen.getByLabelText('글쓰기') as HTMLTextAreaElement).value).toBe('')
  })

  it('닉네임을 정하는 사이 대화상자를 닫으면 정한 뒤에도 글을 올리지 않는다', async () => {
    createPost.mockRejectedValue(
      new ApiError(409, { code: 'COMMUNITY_NICKNAME_REQUIRED', message: '닉네임 필요', traceId: null, errors: [] }),
    )
    let finish: (value: { nickname: string }) => void = () => {}
    setNickname.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.change(screen.getByLabelText('글쓰기'), { target: { value: '첫 의견' } })
    fireEvent.click(screen.getByRole('button', { name: '올리기' }))
    const dialog = await screen.findByRole('dialog', { name: '닉네임 정하기' })
    fireEvent.change(within(dialog).getByLabelText('닉네임'), { target: { value: '새닉네임' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '정하고 올리기' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    finish({ nickname: '새닉네임' })

    expect(await screen.findByText('닉네임을 정해야 글·댓글을 쓸 수 있어요.')).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(createPost).toHaveBeenCalledTimes(1)
  })

  it('내 글에만 수정·삭제가 있고, 남의 글에는 신고만 있다', async () => {
    getPosts.mockResolvedValue(list([post(1, { author: me }), post(2)]))
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '나님의 글 메뉴' }))
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '삭제' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '신고' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '나님의 글 메뉴' }))

    fireEvent.click(screen.getByRole('button', { name: '반도체공부중님의 글 메뉴' }))
    expect(screen.getByRole('button', { name: '신고' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
  })

  it('사유를 골라 신고하면 접수 안내를 보인다', async () => {
    reportContent.mockResolvedValue(undefined)
    renderTab()
    await screen.findByText('HBM 이야기 1')

    fireEvent.click(screen.getByRole('button', { name: '반도체공부중님의 글 메뉴' }))
    fireEvent.click(screen.getByRole('button', { name: '신고' }))
    const dialog = screen.getByRole('dialog', { name: '글 신고' })
    fireEvent.click(within(dialog).getByLabelText('허위 풍문'))
    fireEvent.click(within(dialog).getByRole('button', { name: '신고하기' }))

    expect(await within(dialog).findByText(/신고했어요/)).toBeTruthy()
    expect(reportContent).toHaveBeenCalledWith({ type: 'post', postId: 1 }, 'FALSE_RUMOR')
  })

  it('가려진 글은 안내만 보이고, 작성자에게는 사유·기한과 재게시 청구가 있다', async () => {
    const blind = { reportId: 8, reason: '확인되지 않은 합병설', blindUntil: '2026-11-03T10:15:00', expired: false, repostRequested: false }
    getPosts.mockResolvedValue(
      list([
        post(1, { state: 'BLINDED', body: null }),
        post(2, { state: 'BLINDED', body: '내가 쓴 글', blind, author: me }),
        post(3, { state: 'DELETED', body: null, commentCount: 1 }),
      ]),
    )
    requestRepost.mockResolvedValue({ reportId: 8, createdAt: '2026-10-28T09:00:00' })
    const { container } = renderTab()

    expect(await screen.findAllByText('신고로 가려진 글입니다')).toHaveLength(2)
    expect(screen.getByText('삭제된 글입니다')).toBeTruthy()
    expect(screen.getByText('확인되지 않은 합병설')).toBeTruthy()
    expect(screen.getByText('2026.11.03 10:15까지')).toBeTruthy()
    expect(screen.getByText('내가 쓴 글')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '재게시 청구' }))
    fireEvent.change(screen.getByLabelText('관리자에게 남길 말(선택)'), { target: { value: '출처를 붙였어요' } })
    fireEvent.click(screen.getByRole('button', { name: '재게시 청구하기' }))

    expect(await screen.findByText('재게시를 청구했어요. 관리자가 다시 판단해요.')).toBeTruthy()
    expect(requestRepost).toHaveBeenCalledWith(8, '출처를 붙였어요')
  })

  it('댓글을 펼치면 댓글과 답글을 보이고, 삭제된 글에 남은 댓글도 보인다', async () => {
    const deleted = post(3, { state: 'DELETED', body: null, commentCount: 1 })
    getPosts.mockResolvedValue(list([deleted]))
    getPostDetail.mockResolvedValue({
      post: deleted,
      comments: [
        comment(10, {
          state: 'DELETED',
          body: null,
          replies: [comment(11, { parentId: 10, author: me, body: '남은 답글' })],
        }),
      ],
    })
    const { container } = renderTab()

    fireEvent.click(await screen.findByRole('button', { name: '댓글 1' }))

    expect(await screen.findByText('삭제된 댓글입니다')).toBeTruthy()
    expect(screen.getByText('남은 답글')).toBeTruthy()
    // 지운 글에는 댓글을 더 쓸 수 없다
    expect(screen.queryByLabelText('댓글 쓰기')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '나님의 답글 메뉴' }))
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})
