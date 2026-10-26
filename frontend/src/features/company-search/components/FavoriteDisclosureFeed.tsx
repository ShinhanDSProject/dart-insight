import { useState } from 'react'
import { match } from 'ts-pattern'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button, ButtonLink, Notice } from '@/shared/ui'
import { AlertState, EmptyState } from '@/shared/ui/StateView'
import { useFavoriteDisclosures } from '../hooks/useFavoriteDisclosures'
import { collapseList } from '../model/collapsedList'
import { FEED_DAYS, FEED_INITIAL_COUNT, type FeedCompany, type FeedEntry } from '../model/favoriteFeed'
import { MoreToggle } from './MoreToggle'

const TITLE_ID = 'favorite-disclosures-title'
const LIST_ID = 'favorite-disclosures-list'

/**
 * W-01 ① 검색창 아래 '관심 기업 새 공시'(FS-52, #364). 관심 기업들의 최근 30일 공시를 날짜순으로 합쳐 20건까지 보인다.
 * 처음엔 5건만 한 줄씩 보이고 '더 보기'로 나머지를 펼친다(#374).
 * 지난번에 본 날 이후 접수된 공시에 '새 공시'를 붙이고, 일부 기업이 실패하면 그 기업만 알려 다시 시도하게 한다.
 * 제목 줄·목록·아래 줄 세 칸으로 그려, 첫 화면 두 열에서 옆 열(최근 본 분석)과 줄이 맞는다(#378).
 */
export function FavoriteDisclosureFeed({
  companies,
  signedOut = false,
  waiting = false,
}: {
  companies: readonly FeedCompany[]
  /** 로그인하지 않았으면 관심 기업을 추가할 수 없으므로(관심 기업은 회원별 저장) 로그인을 안내한다 */
  signedOut?: boolean
  /** 관심 기업 목록을 아직 받는 중이면 빈 안내 대신 불러오는 중을 보인다 */
  waiting?: boolean
}) {
  const { view, retryFailed } = useFavoriteDisclosures(companies)
  const [expanded, setExpanded] = useState(false)
  const items = view.status === 'success' ? view.items : []
  const { shown, hiddenCount, toggleable } = collapseList(items, FEED_INITIAL_COUNT, expanded)
  return (
    <section className="home-list favorite-feed" aria-labelledby={TITLE_ID}>
      <div className="home-list__head">
        <h2 className="home-list__title" id={TITLE_ID}>
          관심 기업 새 공시
        </h2>
      </div>
      <div className="home-list__body">
        {match(view)
          .with({ status: 'idle' }, () =>
            match({ waiting, signedOut })
              .with({ waiting: true }, () => <FeedSkeleton />)
              .with({ signedOut: true }, () => (
                <EmptyState title="로그인하면 관심 기업의 새 공시를 모아 볼 수 있어요.">
                  <ButtonLink to="/login" variant="secondary">
                    로그인
                  </ButtonLink>
                </EmptyState>
              ))
              .otherwise(() => <EmptyState title="관심 기업을 추가하면 새 공시를 모아 보여 줘요." />),
          )
          .with({ status: 'loading' }, () => <FeedSkeleton />)
          .with({ status: 'error' }, ({ failed }) => (
            <AlertState title="관심 기업의 공시를 불러오지 못했어요.">
              <p>{failedNames(failed)}</p>
              <Button variant="secondary" onClick={retryFailed}>
                다시 시도
              </Button>
            </AlertState>
          ))
          .with({ status: 'success' }, ({ failed, pending }) => (
            <>
              {failed.length > 0 && (
                <Notice tone="attention" role="status" title="일부 기업의 공시를 불러오지 못했어요.">
                  <p>{failedNames(failed)}</p>
                  <Button variant="secondary" onClick={retryFailed}>
                    다시 시도
                  </Button>
                </Notice>
              )}
              {match({ empty: items.length === 0, waiting: pending > 0 })
                .with({ empty: true, waiting: true }, () => <FeedSkeleton />)
                .with({ empty: true, waiting: false }, () => <EmptyState title={`최근 ${FEED_DAYS}일 공시가 없어요.`} />)
                .with({ empty: false }, () => (
                  <ul className="home-list__rows favorite-feed__list" id={LIST_ID}>
                    {shown.map((entry) => (
                      <FeedRow key={entry.rceptNo} entry={entry} />
                    ))}
                  </ul>
                ))
                .exhaustive()}
            </>
          ))
          .exhaustive()}
      </div>
      <div className="home-list__foot">
        {toggleable && (
          <MoreToggle
            controls={LIST_ID}
            expanded={expanded}
            hiddenCount={hiddenCount}
            unit="건"
            onToggle={() => setExpanded((value) => !value)}
          />
        )}
        {items.length > 0 && (
          <p className="dart-source">출처: DART(OpenDART 공시검색). 공시 이름을 누르면 DART 원문이 새 창으로 열려요.</p>
        )}
      </div>
    </section>
  )
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const url = verifiedDartUrl(entry.rceptNo, entry.dartUrl)
  return (
    <li className="home-list__row favorite-feed__item">
      <div className="home-list__line">
        <span className="home-list__name">{entry.corpName}</span>
        <Badge tone={entry.periodic ? 'accent' : 'neutral'}>{entry.groupLabel}</Badge>
        {entry.isNew && <Badge tone="attention">새 공시</Badge>}
        <time className="home-list__meta" dateTime={entry.receivedDate}>
          {formatDate(entry.receivedDate)}
        </time>
      </div>
      {url === null ? (
        <span className="home-list__main" title={entry.reportName}>
          {entry.reportName} <span className="dart-link__help">(원문 링크 확인 안 됨, 접수번호 {entry.rceptNo})</span>
        </span>
      ) : (
        <a
          className="home-list__main list-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={entry.reportName}
        >
          {entry.reportName} <span aria-hidden="true">↗</span>
          <span className="visually-hidden">(DART 원문 새 창)</span>
        </a>
      )}
    </li>
  )
}

function FeedSkeleton() {
  return (
    <div className="favorite-feed__skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">관심 기업의 최근 공시를 불러오는 중이에요…</span>
      {[0, 1, 2].map((n) => (
        <span key={n} className="favorite-feed__skeleton-row" aria-hidden="true" />
      ))}
    </div>
  )
}

function failedNames(failed: readonly FeedCompany[]): string {
  return `불러오지 못한 기업: ${failed.map((company) => company.corpName).join(', ')}`
}
