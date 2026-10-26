/**
 * '관심 기업 새 공시'(FS-52, #364). 관심 기업마다 받은 최근 공시를 날짜순으로 합치고,
 * 이 브라우저에서 피드를 마지막으로 본 날 이후 접수된 공시에 '새 공시'를 붙인다.
 */
import { match } from 'ts-pattern'
import type { DisclosureItem } from '@/shared/api/disclosures'

/** 관심 기업을 이만큼까지만 부른다(요청 수 제한) */
export const FEED_COMPANY_LIMIT = 10
/** 동시에 보내는 요청 수 */
export const FEED_CONCURRENCY = 3
/** 기업당 최근 며칠 공시 */
export const FEED_DAYS = 30
/** 합친 뒤 보여 줄 공시 수 */
export const FEED_ITEM_LIMIT = 20
/** 처음에 펼쳐 두는 공시 수. 나머지는 '더 보기'로 펼친다(#374) */
export const FEED_INITIAL_COUNT = 5

export const FEED_SEEN_AT_KEY = 'dart-insight:favorite-feed-seen-at'

export interface FeedCompany {
  corpCode: string
  corpName: string
}

export interface FeedEntry extends DisclosureItem {
  corpCode: string
  corpName: string
  /** 마지막으로 본 날 이후 접수됐는지 */
  isNew: boolean
}

/** 기업 하나의 불러오기 결과 */
export type CompanyFeedResult =
  | { status: 'loading' }
  | { status: 'success'; items: DisclosureItem[] }
  | { status: 'error' }

/** 기업 고유번호별 결과. 없으면 아직 부르지 않은 것(불러오는 중으로 본다) */
export type FeedResults = Readonly<Record<string, CompanyFeedResult>>

export type FeedAction =
  /** reset이면 이전 결과를 모두 버린다(관심 기업 목록이 바뀜), 아니면 실패한 기업만 다시 부른다 */
  | { type: 'start'; corpCodes: string[]; reset: boolean }
  | { type: 'resolve'; corpCode: string; items: DisclosureItem[] }
  | { type: 'reject'; corpCode: string }

export function feedReducer(state: FeedResults, action: FeedAction): FeedResults {
  return match<FeedAction, FeedResults>(action)
    .with({ type: 'start' }, ({ corpCodes, reset }) => {
      const next: Record<string, CompanyFeedResult> = reset ? {} : { ...state }
      corpCodes.forEach((corpCode) => (next[corpCode] = { status: 'loading' }))
      return next
    })
    .with({ type: 'resolve' }, ({ corpCode, items }) =>
      state[corpCode]?.status === 'loading' ? { ...state, [corpCode]: { status: 'success', items } } : state,
    )
    .with({ type: 'reject' }, ({ corpCode }) =>
      state[corpCode]?.status === 'loading' ? { ...state, [corpCode]: { status: 'error' } } : state,
    )
    .exhaustive()
}

/** 화면 상태. idle: 관심 기업 없음, loading: 아직 받은 기업이 없음, error: 모든 기업이 실패 */
export type FeedView =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; failed: FeedCompany[] }
  | { status: 'success'; items: FeedEntry[]; failed: FeedCompany[]; pending: number }

export function feedView(companies: readonly FeedCompany[], results: FeedResults, lastSeen: string | null): FeedView {
  if (companies.length === 0) return { status: 'idle' }
  const loaded: { company: FeedCompany; items: DisclosureItem[] }[] = []
  const failed: FeedCompany[] = []
  let pending = 0
  for (const company of companies) {
    match(results[company.corpCode] ?? { status: 'loading' })
      .with({ status: 'loading' }, () => (pending += 1))
      .with({ status: 'error' }, () => failed.push(company))
      .with({ status: 'success' }, ({ items }) => loaded.push({ company, items }))
      .exhaustive()
  }
  if (loaded.length === 0) return pending > 0 ? { status: 'loading' } : { status: 'error', failed }
  return { status: 'success', items: mergeFeed(loaded, lastSeen), failed, pending }
}

/** 모든 기업을 다 받았고 한 곳이라도 성공했으면 피드를 본 것으로 친다 */
export function isFeedSeen(view: FeedView): boolean {
  return view.status === 'success' && view.pending === 0
}

/**
 * 기업마다 받은 공시를 합친다. 접수일 최신순, 같은 날이면 접수번호 큰 순으로 놓고,
 * 같은 접수번호는 하나만 남겨 limit건까지 돌려준다.
 */
export function mergeFeed(
  loaded: readonly { company: FeedCompany; items: readonly DisclosureItem[] }[],
  lastSeen: string | null,
  limit: number = FEED_ITEM_LIMIT,
): FeedEntry[] {
  const seen = new Set<string>()
  const all: FeedEntry[] = []
  for (const { company, items } of loaded) {
    for (const item of items) {
      if (seen.has(item.rceptNo)) continue
      seen.add(item.rceptNo)
      all.push({
        ...item,
        corpCode: company.corpCode,
        corpName: company.corpName,
        isNew: isNewDisclosure(item.receivedDate, lastSeen),
      })
    }
  }
  all.sort((a, b) => compareDesc(a.receivedDate, b.receivedDate) || compareDesc(a.rceptNo, b.rceptNo))
  return all.slice(0, limit)
}

function compareDesc(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? 1 : -1
}

/** 마지막으로 본 날(YYYY-MM-DD)보다 뒤에 접수됐으면 새 공시. 본 적이 없으면 표시하지 않는다 */
export function isNewDisclosure(receivedDate: string, lastSeen: string | null): boolean {
  return lastSeen !== null && receivedDate > lastSeen
}

const KST_OFFSET = 9 * 60 * 60 * 1000

/** 한국 시간 오늘 날짜(YYYY-MM-DD) */
export function kstDate(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET).toISOString().slice(0, 10)
}

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type FeedStorage = Pick<Storage, 'getItem' | 'setItem'>

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** 마지막으로 본 날. 없거나 깨졌거나 저장소를 쓸 수 없으면 null */
export function loadFeedSeenAt(storage: FeedStorage | null): string | null {
  if (storage === null) return null
  try {
    const raw = storage.getItem(FEED_SEEN_AT_KEY)
    return raw !== null && DATE.test(raw) ? raw : null
  } catch {
    return null
  }
}

/** 본 날을 남긴다. 저장하지 못하면(용량·권한) 그냥 넘어간다 */
export function saveFeedSeenAt(storage: FeedStorage | null, date: string): void {
  if (storage === null) return
  try {
    storage.setItem(FEED_SEEN_AT_KEY, date)
  } catch {
    // 저장을 쓸 수 없으면 '새 공시' 표시만 빠지고 피드는 그대로 보인다
  }
}
