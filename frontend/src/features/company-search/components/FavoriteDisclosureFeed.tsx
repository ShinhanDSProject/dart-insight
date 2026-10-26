import { match } from 'ts-pattern'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button, ButtonLink, Notice } from '@/shared/ui'
import { AlertState, EmptyState } from '@/shared/ui/StateView'
import { useFavoriteDisclosures } from '../hooks/useFavoriteDisclosures'
import { FEED_DAYS, type FeedCompany, type FeedEntry } from '../model/favoriteFeed'

const TITLE_ID = 'favorite-disclosures-title'

/**
 * W-01 ① 검색창 아래 '관심 기업 새 공시'(FS-52, #364). 관심 기업들의 최근 30일 공시를 날짜순으로 합쳐 20건까지 보인다.
 * 지난번에 본 날 이후 접수된 공시에 '새 공시'를 붙이고, 일부 기업이 실패하면 그 기업만 알려 다시 시도하게 한다.
 */
export function FavoriteDisclosureFeed({
  companies,
  signedOut = false,
}: {
  companies: readonly FeedCompany[]
  /** 로그인하지 않았으면 관심 기업을 추가할 수 없으므로(관심 기업은 회원별 저장) 로그인을 안내한다 */
  signedOut?: boolean
}) {
  const { view, retryFailed } = useFavoriteDisclosures(companies)
  return (
    <section className="favorite-feed" aria-labelledby={TITLE_ID}>
      <h2 className="favorite-feed__title" id={TITLE_ID}>
        관심 기업 새 공시
      </h2>
      {match(view)
        .with({ status: 'idle' }, () =>
          signedOut ? (
            <EmptyState title="로그인하면 관심 기업의 새 공시를 모아 볼 수 있어요.">
              <ButtonLink to="/login" variant="secondary">
                로그인
              </ButtonLink>
            </EmptyState>
          ) : (
            <EmptyState title="관심 기업을 추가하면 새 공시를 모아 보여 줘요." />
          ),
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
        .with({ status: 'success' }, ({ items, failed, pending }) => (
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
                <ul className="favorite-feed__list">
                  {items.map((entry) => (
                    <FeedRow key={entry.rceptNo} entry={entry} />
                  ))}
                </ul>
              ))
              .exhaustive()}
          </>
        ))
        .exhaustive()}
    </section>
  )
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const url = verifiedDartUrl(entry.rceptNo, entry.dartUrl)
  return (
    <li className="favorite-feed__item">
      <div className="favorite-feed__head">
        <span className="favorite-feed__company">{entry.corpName}</span>
        <Badge tone={entry.periodic ? 'accent' : 'neutral'}>{entry.groupLabel}</Badge>
        {entry.isNew && (
          <Badge tone="attention" className="favorite-feed__new">
            새 공시
          </Badge>
        )}
      </div>
      {url === null ? (
        <span className="favorite-feed__name">
          {entry.reportName} <span className="dart-link__help">(원문 링크 확인 안 됨, 접수번호 {entry.rceptNo})</span>
        </span>
      ) : (
        <a className="favorite-feed__name" href={url} target="_blank" rel="noopener noreferrer">
          {entry.reportName} <span aria-hidden="true">↗</span>
          <span className="visually-hidden">(DART 원문 새 창)</span>
        </a>
      )}
      <time className="favorite-feed__date" dateTime={entry.receivedDate}>
        {formatDate(entry.receivedDate)}
      </time>
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
