import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import type { FavoriteCompaniesStatus } from '@/shared/hooks/useFavoriteCompanies'
import { useRevealReady } from '@/shared/hooks/useRevealReady'
import { Skeleton } from '@/shared/ui'
import { useSeasonChanges } from '../hooks/useSeasonChanges'
import { seasonRankList, type HomeRankRow } from '../model/homeLists'
import { seasonName } from '../model/seasonChanges'
import { HomeLists } from './HomeLists'
import { HOME_INTRO, HOME_SOURCE } from './OnboardingGuide'

/** 빈 검색창 안에서 차례로 바뀌는 예시. 화면 읽기 도구에는 입력창의 placeholder를 읽힌다 */
export const ROTATING_EXAMPLES = ['삼성전자', '005930 · 종목코드로도 찾아요', 'ㅅㅅㅈㅈ · 초성만 쳐도 돼요'] as const

interface HomeHeroProps {
  searchForm: ReactNode
  favoritesStatus: FavoriteCompaniesStatus
  favorites: FavoriteCompany[]
  onOpenGuide: () => void
}

/**
 * 검색 전 첫 화면(동적 화면 시안 ①):움직이는 점 격자·선 배경 위에 시즌 배지, 큰 제목, 검색창, 시즌 변화 흐름 띠,
 * 그 아래 세 칸(시즌 변화 · 숫자 · 대표 기업)을 둔다. 시즌 변화는 배지·띠·목록이 한 번 불러온 값을 같이 쓴다.
 */
export function HomeHero({ searchForm, favoritesStatus, favorites, onOpenGuide }: HomeHeroProps) {
  const season = useSeasonChanges(null)
  // 배지·흐름 띠·관심 기업 칸은 응답이 와야 생기므로 보이기 전에 기다린다(#960)
  useRevealReady(season.state.status !== 'loading')
  useRevealReady(favoritesStatus !== 'loading')
  const data = season.state.status === 'success' ? season.state.data : null
  const rows = data === null ? [] : seasonRankList(data).rows
  return (
    <div className="search-hero search-hero--home">
      {data?.season && (
        <p className="home-badge">
          <span className="home-badge__dot" aria-hidden="true" />
          {seasonName(data.season.reportType, data.season.fiscalYear)} 시즌 · 변화가 큰 기업을 모아 봤어요
        </p>
      )}
      <h1 className="home-title">{HOME_INTRO}</h1>
      <p className="home-lead">{HOME_SOURCE}</p>
      {searchForm}
      {rows.length > 0 && <SeasonTicker rows={rows} />}
      <HomeLists season={season} favoritesStatus={favoritesStatus} favorites={favorites} onOpenGuide={onOpenGuide} />
    </div>
  )
}

/** 첫 화면을 보이기 전 잠깐 보이는 모양(#960): 제목·검색창 자리와 세 칸 */
export function HomeHeroSkeleton() {
  return (
    <div className="home-skeleton">
      <Skeleton label="첫 화면을 불러오는 중이에요…" className="home-skeleton__head" />
      <Skeleton label="" shape="block" height="var(--space-7)" className="home-skeleton__search" />
      <div aria-hidden="true">
        <Skeleton label="" shape="card" count={3} height="calc(var(--space-7) * 5)" />
      </div>
    </div>
  )
}

export function RotatingExamples() {
  return (
    <span className="search-bar__examples" aria-hidden="true">
      {ROTATING_EXAMPLES.map((text, index) => (
        <span key={text} style={{ '--i': index } as CSSProperties}>
          {text}
        </span>
      ))}
    </span>
  )
}


/**
 * 시즌 변화가 큰 기업이 옆으로 흐르는 띠. 같은 기업이 아래 목록에 있으므로 꾸밈으로 두고(화면 읽기·Tab에서 빠짐),
 * 마우스를 올리면 멈춰 눌러 볼 수 있다. 끊김 없이 돌도록 같은 줄을 두 번 붙인다.
 */
function SeasonTicker({ rows }: { rows: HomeRankRow[] }) {
  return (
    <div className="home-ticker" aria-hidden="true">
      <div className="home-ticker__track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="home-ticker__list">
            {rows.map((row) => (
              <li key={row.to + row.rank}>
                <Link to={row.to} tabIndex={-1} className="home-ticker__chip">
                  <span className="home-ticker__name">{row.name}</span>
                  {row.meta !== null && <span className="home-ticker__meta">{row.meta}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
