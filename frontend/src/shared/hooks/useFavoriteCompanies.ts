import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Company } from '@/shared/api/companies'
import {
  addFavoriteCompany,
  getFavoriteCompanies,
  removeFavoriteCompany,
  type FavoriteCompany,
} from '@/shared/api/favoriteCompanies'
import { useAuth } from '@/shared/auth/authContext'

/** anonymous: 로그인 안 함, loading: 목록을 받는 중, ready: 바꿀 수 있음, error: 목록을 받지 못함 */
export type FavoriteCompaniesStatus = 'anonymous' | 'loading' | 'ready' | 'error'

export interface FavoriteCompaniesController {
  status: FavoriteCompaniesStatus
  /** 최근 추가 순(최대 12). ready가 아니면 빈 목록 */
  items: FavoriteCompany[]
  isFavorite: (corpCode: string) => boolean
  /** 관심 기업이면 빼고, 아니면 더한다. ready일 때만 서버를 부르고, 실패하면 거부된 Promise를 돌려준다 */
  toggle: (company: Company) => Promise<void>
  remove: (corpCode: string) => Promise<void>
  /** 목록 받기가 실패했을 때 다시 받는다 */
  reload: () => void
}

interface Snapshot {
  userId: number | null
  status: FavoriteCompaniesStatus
  items: FavoriteCompany[]
}

const EMPTY: FavoriteCompany[] = []
const ANONYMOUS: Snapshot = { userId: null, status: 'anonymous', items: EMPTY }

// 검색 화면의 목록·검색 결과 별 표시·보고서 선택 화면 별 버튼이 같은 목록을 보도록 한 곳에 둔다
let snapshot: Snapshot = ANONYMOUS
// 로그인·로그아웃·다시 받기마다 올린다. 앞선 세션이나 앞선 요청의 응답이 지금 목록을 덮지 못하게 한다
let generation = 0
const listeners = new Set<() => void>()

function setSnapshot(next: Snapshot): void {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function load(userId: number): void {
  const ticket = ++generation
  setSnapshot({ userId, status: 'loading', items: EMPTY })
  getFavoriteCompanies()
    .then((list) => {
      if (ticket === generation) setSnapshot({ userId, status: 'ready', items: list.items })
    })
    .catch(() => {
      if (ticket === generation) setSnapshot({ userId, status: 'error', items: EMPTY })
    })
}

/** 로그인한 회원이 바뀌면 그 회원의 목록을 받는다. 같은 회원이면 받아 둔 목록을 쓰고, 실패했던 목록만 다시 받는다 */
export function syncFavoriteCompanies(userId: number | null): void {
  if (userId === null) {
    if (snapshot.userId !== null) {
      generation += 1
      setSnapshot(ANONYMOUS)
    }
    return
  }
  if (snapshot.userId !== userId || snapshot.status === 'error') load(userId)
}

/** 목록을 다 받은 뒤에만 바꾼다. 늦게 온 첫 목록이 방금 바꾼 것을 덮지 않게 하려는 것이다 */
async function change(apply: (userId: number, items: FavoriteCompany[]) => Promise<FavoriteCompany[]>): Promise<void> {
  if (snapshot.status !== 'ready' || snapshot.userId === null) return
  const ticket = generation
  const userId = snapshot.userId
  const next = await apply(userId, snapshot.items)
  if (ticket === generation) setSnapshot({ userId, status: 'ready', items: next })
}

function removeFavorite(corpCode: string): Promise<void> {
  return change(async (_userId, items) => {
    await removeFavoriteCompany(corpCode)
    return (snapshot.status === 'ready' ? snapshot.items : items).filter((item) => item.corpCode !== corpCode)
  })
}

function toggleFavorite(company: Company): Promise<void> {
  if (snapshot.items.some((item) => item.corpCode === company.corpCode)) return removeFavorite(company.corpCode)
  return change(async (_userId, items) => {
    const added = await addFavoriteCompany(company.corpCode)
    const latest = snapshot.status === 'ready' ? snapshot.items : items
    // 서버와 같은 규칙: 맨 앞에 더하고 12곳까지만
    return [added, ...latest.filter((item) => item.corpCode !== added.corpCode)].slice(0, 12)
  })
}

function reloadFavorites(): void {
  if (snapshot.userId !== null) load(snapshot.userId)
}

/**
 * 로그인한 회원의 관심 기업(#36). 서버에 회원별로 저장하고, 로그인하지 않았으면 빈 목록이다.
 * 보고서 선택 화면의 별 버튼, 검색 화면의 '관심 기업'과 검색 결과 별 표시가 같은 값을 본다.
 */
export function useFavoriteCompanies(): FavoriteCompaniesController {
  const auth = useAuth()
  const userId = auth.state.status === 'authenticated' ? auth.state.userId : null
  useEffect(() => syncFavoriteCompanies(userId), [userId])
  const current = useSyncExternalStore(subscribe, () => snapshot)
  const mine = current.userId === userId ? current : ANONYMOUS
  const items = mine.status === 'ready' ? mine.items : EMPTY
  const isFavorite = useCallback((corpCode: string) => items.some((item) => item.corpCode === corpCode), [items])
  const status: FavoriteCompaniesStatus = userId === null ? 'anonymous' : mine.userId === null ? 'loading' : mine.status
  return { status, items, isFavorite, toggle: toggleFavorite, remove: removeFavorite, reload: reloadFavorites }
}
