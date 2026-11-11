import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import type { SeasonChangeList } from '@/shared/api/seasonChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import type { AsyncResult } from '@/shared/hooks/useAsync'
import type { FavoriteCompaniesStatus } from '@/shared/hooks/useFavoriteCompanies'
import { cx } from '@/shared/lib/cx'
import { formatInteger } from '@/shared/lib/numberFormat'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'
import { Button, ButtonLink, StatNumber } from '@/shared/ui'
import { AlertState, LoadingState } from '@/shared/ui/StateView'
import { useFeaturedCompanies } from '../hooks/useFeaturedCompanies'
import { useServiceStats } from '../hooks/useServiceStats'
import { useWideScreen } from '../hooks/useWideScreen'
import { featuredRankList, homeListFirst, seasonRankList, type HomeRankList } from '../model/homeLists'
import { FavoriteDisclosureFeed } from './FavoriteDisclosureFeed'

/** 대표 기업 칸에 칩으로 보이는 수 */
export const FEATURED_CHIPS = 8

interface HomeListsProps {
  season: AsyncResult<LoadState<SeasonChangeList>>
  favoritesStatus: FavoriteCompaniesStatus
  favorites: FavoriteCompany[]
  onOpenGuide: () => void
}

/**
 * 첫 화면 검색창 아래 세 칸(#686 → #848 → 동적 화면 시안): 이번 시즌 변화가 큰 기업 Top 10(막대),
 * 숫자로 보는 서비스 규모(GET /api/stats, 올라가며 나타남), 대표 기업 칩과 사용법 안내.
 * 관심 기업이 있는 회원이면 관심 기업 새 공시(FS-52)를 그 아래 한 줄 전체로 둔다.
 */
export function HomeLists({ season, favoritesStatus, favorites, onOpenGuide }: HomeListsProps) {
  return (
    <div className="home-lists">
      <HomePanel id="home-season" title="이번 시즌 변화가 큰 기업" tag="Top 10">
        <RankBody state={season.state} toList={seasonRankList} onRetry={season.reload} label="이번 시즌 변화가 큰 기업" />
      </HomePanel>
      <HomePanel id="home-stats" title="숫자로 보는 DART Insight" tone="subtle">
        <ServiceStatsBody />
      </HomePanel>
      <HomePanel id="home-featured" title="대표 기업" tag="시가총액 순">
        <Featured onOpenGuide={onOpenGuide} />
      </HomePanel>
      {favoritesStatus === 'ready' && favorites.length > 0 && (
        <HomePanel id="home-favorites" title="관심 기업 새 공시" wide>
          <FavoritesOnDemand companies={favorites} />
        </HomePanel>
      )}
    </div>
  )
}

/** 숫자를 못 불러오면 숫자 칸만 숨기고 원문 위치 안내와 예시 버튼은 남긴다 */
function ServiceStatsBody() {
  const { state } = useServiceStats()
  return (
    <>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="불러오는 중이에요…" />)
        .with({ status: 'error' }, () => null)
        .with({ status: 'success' }, ({ data }) => (
          <div className="home-stats">
            <StatNumber label="비교할 수 있는 상장 기업" value={data.listedCompanies} format={formatInteger} unit="곳" />
            <StatNumber label="끝난 분석" value={data.completedAnalyses} format={formatInteger} unit="건" />
            <StatNumber label="찾아낸 문장 변화" value={data.textChanges} format={formatInteger} unit="개" />
          </div>
        ))
        .exhaustive()}
      <p className="home-rank__caption">모든 변화에 접수번호와 원문 위치를 붙여 보여 줘요.</p>
      <ButtonLink variant="secondary" className="home-stats__try" to={`/companies/${ONBOARDING_EXAMPLE_CORP_CODE}`}>
        삼성전자로 바로 비교해 보기 →
      </ButtonLink>
    </>
  )
}

function Featured({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { state, reload } = useFeaturedCompanies()
  return (
    <>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="불러오는 중이에요…" />)
        .with({ status: 'error' }, () => (
          <AlertState title="대표 기업을 불러오지 못했어요.">
            <Button variant="secondary" onClick={reload}>
              다시 시도
            </Button>
          </AlertState>
        ))
        .with({ status: 'success' }, ({ data }) => {
          const list = featuredRankList(data)
          return (
            <>
              {list.rows.length > 0 && (
                <ul className="home-chips" aria-label="대표 기업">
                  {list.rows.slice(0, FEATURED_CHIPS).map((row, index) => (
                    <li key={row.to} style={{ '--row': index } as CSSProperties}>
                      <Link to={row.to} className="home-chip">
                        {row.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="home-rank__caption">{list.caption}</p>
            </>
          )
        })
        .exhaustive()}
      <p className="home-guide">
        처음이신가요? 기업 찾기부터 결과 보기까지 순서를 안내해 드려요.{' '}
        <Button variant="link" className="home-guide__button" onClick={onOpenGuide}>
          사용법 보기
        </Button>
      </p>
    </>
  )
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
                  <Link to={row.to} className={cx('home-rank__link', row.share !== null && 'home-rank__link--bar')}>
                    <span className="home-rank__rank" aria-hidden="true">
                      {row.rank}
                    </span>
                    <span className="visually-hidden">{row.rank}위 </span>
                    <span className="home-rank__name">{row.name}</span>
                    {row.meta !== null && <span className="home-rank__meta">{row.meta}</span>}
                    {/* 바뀐 양의 크기만 보인다. 좋고 나쁨이 아니라 중립 보라 하나다 */}
                    {row.share !== null && (
                      <span className="home-rank__bar" aria-hidden="true">
                        <span style={{ '--share': row.share } as CSSProperties} />
                      </span>
                    )}
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

interface HomePanelProps {
  id: string
  title: string
  tag?: string
  wide?: boolean
  tone?: 'default' | 'subtle'
  children: ReactNode
}

/** 첫 화면 칸 하나: 테두리 카드 안에 제목과 작은 기준 꼬리표, 그 아래 내용 */
function HomePanel({ id, title, tag, wide = false, tone = 'default', children }: HomePanelProps) {
  return (
    <section className={cx('home-panel', wide && 'home-panel--wide', tone === 'subtle' && 'home-panel--subtle')} aria-labelledby={`${id}-title`}>
      <h2 className="home-panel__title" id={`${id}-title`}>
        {title}
        {tag && <span className="home-panel__tag">{tag}</span>}
      </h2>
      {children}
    </section>
  )
}
