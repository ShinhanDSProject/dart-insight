import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import { companyComparisonPath, MAX_COMPARE_COMPANIES } from '@/shared/lib/companyComparisonLink'
import { Button, ButtonLink, Icon } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'

interface FavoriteCompaniesProps {
  items: FavoriteCompany[]
  onRemove: (corpCode: string) => Promise<void>
}

/**
 * W-01 ① 검색창 아래 '관심 기업'(FS-18 AC2). 최근 추가 순으로 최대 12곳, 누르면 그 기업의 보고서 선택 화면으로 간다.
 * 하나씩 뺄 수 있고, 2곳 이상이면 기업 나란히 보기(최대 4곳)로 바로 열 수 있다(#534).
 * 로그인한 회원의 목록이고(#36), 비었거나 로그인하지 않았으면 영역을 보이지 않는다.
 */
export function FavoriteCompanies({ items, onRemove }: FavoriteCompaniesProps) {
  const [removal, setRemoval] = useState<'idle' | 'error'>('idle')
  if (items.length === 0) return null
  const comparePath = companyComparisonPath(items.map((item) => item.corpCode))
  const capped = items.length > MAX_COMPARE_COMPANIES
  return (
    <section className="favorite-companies" aria-labelledby="favorite-companies-title">
      <div className="favorite-companies__head">
        <h2 className="favorite-companies__title" id="favorite-companies-title">
          관심 기업
        </h2>
        {comparePath !== null && (
          <ButtonLink
            variant="secondary"
            to={comparePath}
            aria-label={capped ? `관심 기업 최근 ${MAX_COMPARE_COMPANIES}곳 나란히 보기` : '관심 기업 나란히 보기'}
          >
            {capped ? `최근 ${MAX_COMPARE_COMPANIES}곳 나란히 보기` : '나란히 보기'}
          </ButtonLink>
        )}
      </div>
      <ul className="favorite-companies__list">
        {items.map((item, index) => (
          <li key={item.corpCode} className="favorite-chip" style={{ '--row': index } as CSSProperties}>
            <Link to={`/companies/${encodeURIComponent(item.corpCode)}`} className="favorite-chip__link">
              <span className="favorite-chip__star">
                <Icon name="star-filled" size={14} />
              </span>
              <span className="favorite-chip__name">{item.corpName}</span>
              <span className="favorite-chip__meta">{item.listed ? '상장' : '비상장'}</span>
            </Link>
            <Button
              variant="icon"
              className="favorite-chip__remove"
              aria-label={`${item.corpName} 관심 기업에서 빼기`}
              onClick={() => onRemove(item.corpCode).then(() => setRemoval('idle'), () => setRemoval('error'))}
            >
              <Icon name="x" size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {removal === 'error' && <AlertState title="관심 기업에서 빼지 못했어요.">잠시 뒤 다시 시도해 주세요.</AlertState>}
    </section>
  )
}
