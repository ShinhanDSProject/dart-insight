import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import type { LoadState } from '@/shared/hooks/asyncState'
import type { FavoriteCompaniesStatus } from '@/shared/hooks/useFavoriteCompanies'
import { Button } from '@/shared/ui'
import { AlertState, LoadingState } from '@/shared/ui/StateView'
import { useFeaturedCompanies } from '../hooks/useFeaturedCompanies'
import { useSeasonChanges } from '../hooks/useSeasonChanges'
import { featuredRankList, seasonRankList, type HomeRankList } from '../model/homeLists'
import { FavoriteDisclosureFeed } from './FavoriteDisclosureFeed'

/**
 * 첫 화면 검색창 바로 아래 좌우로 나란한 접는 목록(#686): 대표 기업, 이번 시즌 변화가 큰 기업 Top 10,
 * 관심 기업이 있는 회원이면 관심 기업 새 공시(FS-52).
 * 처음엔 접혀 있어 첫 화면은 로고와 검색창만 눈에 들어오고(FS-67), 펼칠 때 목록을 불러온다.
 * 대표 기업·시즌 변화는 같은 모양(안내 한 줄·순위 줄 10개)으로 그린다.
 */
export function HomeLists({ favoritesStatus, favorites }: { favoritesStatus: FavoriteCompaniesStatus; favorites: FavoriteCompany[] }) {
  return (
    <div className="home-lists">
      <HomeToggle label="대표 기업">
        <Featured />
      </HomeToggle>
      <HomeToggle label="이번 시즌 변화가 큰 기업 Top 10">
        <Season />
      </HomeToggle>
      {favoritesStatus === 'ready' && favorites.length > 0 && (
        <HomeToggle label="관심 기업 새 공시">
          <FavoriteDisclosureFeed companies={favorites} />
        </HomeToggle>
      )}
    </div>
  )
}

function Featured() {
  const { state, reload } = useFeaturedCompanies()
  return <RankBody state={state} toList={featuredRankList} onRetry={reload} label="대표 기업" />
}

function Season() {
  const { state, reload } = useSeasonChanges(null)
  return <RankBody state={state} toList={seasonRankList} onRetry={reload} label="이번 시즌 변화가 큰 기업" />
}

interface RankBodyProps<T> {
  state: LoadState<T>
  toList: (data: T) => HomeRankList
  onRetry: () => void
  label: string
}

function RankBody<T>({ state, toList, onRetry, label }: RankBodyProps<T>) {
  return match(state)
    .with({ status: 'loading' }, () => <LoadingState message="불러오는 중이에요…" />)
    .with({ status: 'error' }, () => (
      <AlertState title={`${label}을 불러오지 못했어요.`}>
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      </AlertState>
    ))
    .with({ status: 'success' }, ({ data }) => {
      const list = toList(data)
      return (
        <>
          <p className="home-rank__caption">{list.caption}</p>
          {list.rows.length > 0 && (
            <ol className="home-rank" aria-label={label}>
              {list.rows.map((row) => (
                <li key={row.to + row.rank} className="home-rank__item">
                  <Link to={row.to} className="home-rank__link">
                    <span className="home-rank__rank" aria-hidden="true">
                      {row.rank}
                    </span>
                    <span className="visually-hidden">{row.rank}위 </span>
                    <span className="home-rank__name">{row.name}</span>
                    {row.meta !== null && <span className="home-rank__meta">{row.meta}</span>}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      )
    })
    .exhaustive()
}

function HomeToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="home-toggle" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="home-toggle__summary">
        <span>{label}</span>
        <span className="home-toggle__caret" aria-hidden="true">
          ▼
        </span>
      </summary>
      {/* 접힌 동안에는 그리지 않아 API를 부르지 않는다 */}
      {open && <div className="home-toggle__body">{children}</div>}
    </details>
  )
}
