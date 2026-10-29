import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type RequestOptions } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md '커뮤니티 — 기업별 게시판'(6.6, FS-58). 읽기는 로그인 없이, 쓰기는 로그인한 회원만 */

/** 글 1~2,000자, 댓글 1~500자(앞뒤 공백을 지운 길이) */
export const POST_BODY_MAX = 2000
export const COMMENT_BODY_MAX = 500
/** 재게시 청구에 남길 말 */
export const REPOST_MESSAGE_MAX = 500

/** VISIBLE 보임, BLINDED 신고로 가려짐, DELETED 지워짐(댓글이 있어 남음) */
export type ContentState = 'VISIBLE' | 'BLINDED' | 'DELETED'

export type PostSort = 'latest' | 'popular'

export type ReportReason = 'DEFAMATION' | 'FALSE_RUMOR' | 'PAID_LEADING' | 'PERSONAL_INFO'

export interface Author {
  nickname: string
  /** 요청한 사용자가 작성자. 로그인하지 않았으면 false */
  mine: boolean
}

/** 가려진 내 글·댓글에만 있다. 다른 사람에게는 null */
export interface Blind {
  reportId: number
  reason: string
  blindUntil: string
  /** 기한이 지났지만 관리자가 아직 다시 처리하지 않음(가린 채 둠) */
  expired: boolean
  repostRequested: boolean
}

export type QuoteKind = 'FINANCIAL_CHANGE' | 'TEXT_CHANGE'

/** 붙인 변경점 인용(#464). label·text·reportPair는 backend가 저장된 분석 결과로 만든 사본이다 */
export interface PostQuote {
  kind: QuoteKind
  label: string
  text: string
  changeType: string | null
  sjDiv: string | null
  reportPair: { previous: string; current: string }
  source: { analysisId: number; changeId: number; rceptNo: string; sectionNo: number | null; blockNo: number | null }
  outdated: boolean
}

export interface Post {
  postId: number
  corpCode: string
  author: Author
  state: ContentState
  /** DELETED면 null, BLINDED면 작성자에게만 있다 */
  body: string | null
  quote: PostQuote | null
  likeCount: number
  /** 지우지 않은 댓글·답글 수 */
  commentCount: number
  liked: boolean
  blind: Blind | null
  createdAt: string
  editedAt: string | null
}

export interface Comment {
  commentId: number
  /** 답글이면 부모 댓글 ID */
  parentId: number | null
  author: Author
  state: ContentState
  body: string | null
  likeCount: number
  liked: boolean
  blind: Blind | null
  createdAt: string
  editedAt: string | null
  /** 댓글에만 있고 한 단계다(답글은 빈 배열) */
  replies: Comment[]
}

export interface PostList {
  corpCode: string
  sort: PostSort
  page: number
  size: number
  totalItems: number
  items: Post[]
}

export interface PostDetail {
  post: Post
  /** 오래된 순. 답글도 부모 아래에서 오래된 순 */
  comments: Comment[]
}

export interface LikeResult {
  liked: boolean
  likeCount: number
}

/** 로그인한 회원 정보(GET /api/sessions/current). 닉네임을 정하지 않았으면 null */
export interface CurrentMember {
  userId: number
  nickname: string | null
  admin: boolean
}

export type LikeTarget = { type: 'post'; postId: number } | { type: 'comment'; commentId: number }

export function getPosts(corpCode: string, sort: PostSort, page: number, options?: RequestOptions): Promise<PostList> {
  return apiGet<PostList>(endpoints.companyPosts(corpCode), { sort, page }, options)
}

/** 글에 붙일 변경점(#464). 종류와 원래 위치만 보내고, 이름·글은 backend가 만든다 */
export interface QuoteRequest {
  kind: QuoteKind
  analysisId: number
  changeId: number
}

export function createPost(corpCode: string, body: string, quote: QuoteRequest | null = null): Promise<Post> {
  return apiPost<Post>(endpoints.companyPosts(corpCode), quote === null ? { body } : { body, quote })
}

export function getPostDetail(postId: number, options?: RequestOptions): Promise<PostDetail> {
  return apiGet<PostDetail>(endpoints.post(postId), undefined, options)
}

export function updatePost(postId: number, body: string): Promise<Post> {
  return apiPatch<Post>(endpoints.post(postId), { body })
}

export function deletePost(postId: number): Promise<void> {
  return apiDelete(endpoints.post(postId))
}

export function createComment(postId: number, body: string, parentId: number | null): Promise<Comment> {
  return apiPost<Comment>(endpoints.postComments(postId), { body, parentId })
}

export function updateComment(commentId: number, body: string): Promise<Comment> {
  return apiPatch<Comment>(endpoints.comment(commentId), { body })
}

export function deleteComment(commentId: number): Promise<void> {
  return apiDelete(endpoints.comment(commentId))
}

function likePath(target: LikeTarget): string {
  return target.type === 'post' ? endpoints.postLike(target.postId) : endpoints.commentLike(target.commentId)
}

/** 누르기(PUT)와 취소(DELETE). 둘 다 지금 상태를 돌려준다 */
export function setLike(target: LikeTarget, liked: boolean): Promise<LikeResult> {
  return liked
    ? apiPut<LikeResult>(likePath(target), undefined)
    : apiDelete<LikeResult>(likePath(target))
}

export function reportContent(target: LikeTarget, reason: ReportReason): Promise<void> {
  const path = target.type === 'post' ? endpoints.postReports(target.postId) : endpoints.commentReports(target.commentId)
  return apiPost<void>(path, { reason })
}

export function requestRepost(reportId: number, message: string | null): Promise<{ reportId: number; createdAt: string }> {
  return apiPost(endpoints.repostRequests(reportId), { message })
}

export function getCurrentMember(options?: RequestOptions): Promise<CurrentMember> {
  return apiGet<CurrentMember>(endpoints.currentSession(), undefined, options)
}

export function setNickname(nickname: string): Promise<{ nickname: string }> {
  return apiPut<{ nickname: string }>(endpoints.currentNickname(), { nickname })
}

/** 관리자 신고 목록(GET /api/admin/reports, 관리자만). todo: 처리할 것, all: 처리한 것 포함 전체 */
export type ReportQueue = 'todo' | 'all'

/** OPEN 대기, KEPT 유지, BLINDED 블라인드, DELETED 삭제 */
export type ReportStatus = 'OPEN' | 'KEPT' | 'BLINDED' | 'DELETED'

/** 처리할 이유. PENDING 새 신고, REPOST_REQUESTED 재게시 청구, EXPIRED 블라인드 기한 지남 */
export type ReportTodo = 'PENDING' | 'REPOST_REQUESTED' | 'EXPIRED'

export type ModerationDecision = 'KEEP' | 'BLIND' | 'DELETE'

export interface ReportTarget {
  type: 'POST' | 'COMMENT'
  postId: number
  /** 댓글이면 댓글 ID, 글이면 null */
  commentId: number | null
  corpCode: string
  corpName: string
  author: { nickname: string }
  /** 가렸거나 지운 것도 본문 전체 */
  body: string
  state: ContentState
}

export interface Moderation {
  decision: ModerationDecision
  reason: string
  blindDays: number | null
  blindUntil: string | null
  /** 관리자가 닉네임을 정하지 않았으면 null */
  admin: { nickname: string | null }
  createdAt: string
}

export interface AdminReport {
  reportId: number
  status: ReportStatus
  todo: ReportTodo | null
  target: ReportTarget
  reportCount: number
  reasonCounts: Record<ReportReason, number>
  lastReportedAt: string
  blindUntil: string | null
  repostRequest: { message: string | null; createdAt: string } | null
  /** 처리 기록, 최근 순 */
  moderations: Moderation[]
}

export interface AdminReportList {
  queue: ReportQueue
  page: number
  size: number
  totalItems: number
  items: AdminReport[]
}

/** 처리 사유 1~500자(앞뒤 공백을 지운 길이), 블라인드 1~30일 */
export const MODERATION_REASON_MAX = 500
export const BLIND_DAYS_MAX = 30

/** blindDays는 BLIND일 때만 보낸다 */
export interface ModerationRequest {
  decision: ModerationDecision
  reason: string
  blindDays?: number
}

export function getAdminReports(queue: ReportQueue, page: number, options?: RequestOptions): Promise<AdminReportList> {
  return apiGet<AdminReportList>(endpoints.adminReports(), { queue, page }, options)
}

export function moderateReport(reportId: number, request: ModerationRequest): Promise<AdminReport> {
  return apiPatch<AdminReport>(endpoints.adminReport(reportId), request)
}
