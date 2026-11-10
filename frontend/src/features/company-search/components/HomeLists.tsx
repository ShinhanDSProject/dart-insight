import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import type { LoadState } from '@/shared/hooks/asyncState'
import type { FavoriteCompaniesStatus } from '@/shared/hooks/useFavoriteCompanies'
import { Button } from '@/shared/ui'
import { AlertState, LoadingState } from '@/shared/ui/StateView'
import { useFeaturedCompanies } from '../hooks/useFeaturedCompanies'
import { useSeasonChanges } from '../hooks/useSeasonChanges'
import { useWideScreen } from '../hooks/useWideScreen'
import { featuredRankList, homeListFirst, seasonRankList, type HomeRankList } from '../model/homeLists'
import { FavoriteDisclosureFeed } from './FavoriteDisclosureFeed'

/**
 * 첫 화면 사용 순서 아래 두 칸 짧은 목록(#686 → #848): 왼쪽 대표 기업, 오른쪽 이번 시즌 변화가 큰 기업 Top 10.
 * 접지 않고 처음부터 5개씩 보여 바로 누를 수 있게 하고, '더 보기'로 10개까지 연다. 기준·출처 안내는 목록 아래 작게.
 * 관심 기업이 있는 회원이면 관심 기업 새 공시(FS-52)를 그 아래 한 줄 전체로 둔다.
 */
export function HomeLists({ favoritesStatus, favorites }: { favoritesStatus: FavoriteCompaniesStatus; favorites: FavoriteCompany[] }) {
  return (
    <div className="home-lists">
      <HomePanel id="home-featured" title="대표 기업" tag="시가총액 순">
        <Featured />
      </HomePanel>
      <HomePanel id="home-season" title="이번 시즌 변화가 큰 기업" tag="Top 10">
        <Season />
      </HomePanel>
      {favoritesStatus === 'ready' && favorites.length > 0 && (
        <HomePanel id="home-favorites" title="관심 기업 새 공시" wide>
          <FavoritesOnDemand companies={favorites} />
        </HomePanel>
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
  const [expanded, setExpanded] = useState(false)
  // 넓은 화면은 7줄, 그 밖에는 5줄을 먼저 보인다(#852)
  const first = homeListFirst(useWideScreen())
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
      const rows = expanded ? list.rows : list.rows.slice(0, first)
      const hidden = list.rows.length - first
      return (
        <>
          {list.rows.length > 0 && (
            <ol className="home-rank" aria-label={label}>
              {rows.map((row, index) => (
                <li
                  key={row.to + row.rank}
                  className="home-rank__item"
                  // 처음 줄은 위에서부터, '더 보기'로 연 줄은 연 줄부터 차례로 나타난다(#858)
                  style={{ '--row': index < first ? index : index - first } as CSSProperties}
                >
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
          {hidden > 0 && (
            <Button variant="link" className="home-rank__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? '접기' : `더 보기 (${hidden}개)`}
            </Button>
          )}
          <p className="home-rank__caption">{list.caption}</p>
        </>
      )
    })
    .exhaustive()
}

/** 관심 기업 새 공시는 기업마다 공시를 불러와 무거우므로 누를 때만 불러온다(#686의 접는 동작을 이 칸에만 남김) */
function FavoritesOnDemand({ companies }: { companies: FavoriteCompany[] }) {
  const [open, setOpen] = useState(false)
  if (open) return <FavoriteDisclosureFeed companies={companies} />
  return (
    <Button variant="link" className="home-rank__more" onClick={() => setOpen(true)}>
      관심 기업 {companies.length}곳의 최근 공시 보기
    </Button>
  )
}

/** 첫 화면 목록 한 칸: 제목과 작은 기준 꼬리표, 그 아래 내용. 접지 않는다(#848) */
function HomePanel({ id, title, tag, wide = false, children }: { id: string; title: string; tag?: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={wide ? 'home-panel home-panel--wide' : 'home-panel'} aria-labelledby={`${id}-title`}>
      <h2 className="home-panel__title" id={`${id}-title`}>
        {title}
        {tag && <span className="home-panel__tag">{tag}</span>}
      </h2>
      {children}
    </section>
  )
}
