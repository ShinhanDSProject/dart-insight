import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { FeaturedCompanyListResponse } from '@/shared/api/featuredCompanies'
import type { LoadState } from '@/shared/hooks/asyncState'
import { formatDate } from '@/shared/lib/reportLabels'
import { Button } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { MoreToggle } from './MoreToggle'

/** 처음에 보이는 대표 기업 수. 나머지는 '더 보기'로 펼친다 */
export const FEATURED_VISIBLE = 10

const LIST_ID = 'featured-companies-list'

/**
 * W-01 ① 검색창 바로 아래 '대표 기업'(#399, ADR-0033). 유가증권시장 시가총액 순이지만 숫자는 보이지 않고,
 * 누르면 그 기업의 보고서 선택 화면으로 간다. 기준일과 출처를 함께 보인다(공공누리 출처표시).
 * 불러오는 중에는 자리를 비워 두고, 실패하면 다시 시도를, 아직 받지 못했으면 짧은 안내를 보인다.
 */
export function FeaturedCompanies({ state, onRetry }: { state: LoadState<FeaturedCompanyListResponse>; onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return match(state)
    .with({ status: 'loading' }, () => null)
    .with({ status: 'error' }, () => (
      <AlertState title="대표 기업을 불러오지 못했어요.">
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      </AlertState>
    ))
    .with({ status: 'success' }, ({ data }) => {
      const visible = expanded ? data.items : data.items.slice(0, FEATURED_VISIBLE)
      return (
        <section className="featured-companies" aria-labelledby="featured-companies-title">
          <h2 className="favorite-companies__title" id="featured-companies-title">
            대표 기업
          </h2>
          {data.items.length === 0 || data.baseDate === null ? (
            <p className="featured-companies__note">대표 기업 목록을 준비하고 있어요. 위에서 회사명으로 찾아 주세요.</p>
          ) : (
            <>
              <p className="featured-companies__note">
                유가증권시장 시가총액 상위 · {formatDate(data.baseDate)} 기준 · 출처: {data.source}
              </p>
              <ol className="favorite-companies__list" id={LIST_ID}>
                {visible.map((item, index) => (
                  <li key={item.corpCode} className="favorite-chip" style={{ '--row': index } as CSSProperties}>
                    <Link
                      to={`/companies/${encodeURIComponent(item.corpCode)}`}
                      className="favorite-chip__link featured-chip__link"
                    >
                      <span className="favorite-chip__name">{item.corpName}</span>
                      {item.stockCode && <span className="favorite-chip__meta">{item.stockCode}</span>}
                    </Link>
                  </li>
                ))}
              </ol>
              {data.items.length > FEATURED_VISIBLE && (
                <MoreToggle
                  controls={LIST_ID}
                  expanded={expanded}
                  hiddenCount={data.items.length - FEATURED_VISIBLE}
                  unit="곳"
                  onToggle={() => setExpanded((open) => !open)}
                />
              )}
            </>
          )}
        </section>
      )
    })
    .exhaustive()
}
