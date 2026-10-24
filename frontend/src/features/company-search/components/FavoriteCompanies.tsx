import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { FavoriteCompany } from '@/shared/lib/favoriteCompanies'
import { Button, Icon } from '@/shared/ui'

interface FavoriteCompaniesProps {
  items: FavoriteCompany[]
  onRemove: (corpCode: string) => void
}

/**
 * W-01 ① 검색창 아래 '관심 기업'(FS-18 AC2). 최근 추가 순으로 최대 12곳, 누르면 그 기업의 보고서 선택 화면으로 간다.
 * 하나씩 뺄 수 있고, 이 브라우저에만 남는 기록이라 목록이 비면 영역을 보이지 않는다.
 */
export function FavoriteCompanies({ items, onRemove }: FavoriteCompaniesProps) {
  if (items.length === 0) return null
  return (
    <section className="favorite-companies" aria-labelledby="favorite-companies-title">
      <h2 className="favorite-companies__title" id="favorite-companies-title">
        관심 기업
      </h2>
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
              onClick={() => onRemove(item.corpCode)}
            >
              <Icon name="x" size={14} />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
