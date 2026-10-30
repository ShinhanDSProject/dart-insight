import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import { companyComparisonPath, MAX_COMPARE_COMPANIES } from '@/shared/lib/companyComparisonLink'
import { Badge, Button, ButtonLink, Card, Icon } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'

interface FavoriteCompaniesProps {
  items: FavoriteCompany[]
  onRemove: (corpCode: string) => Promise<void>
  /** '+ 기업 추가': 검색창으로 초점을 옮긴다. 기업 화면의 별 버튼으로 더한다 */
  onAdd: () => void
}

/**
 * W-01 ① 검색창 아래 '자주 찾는 기업 (즐겨찾기)' 카드(FS-18 AC2, #549). 로그인한 회원의 관심 기업을 최근 추가 순 칩으로 보인다.
 * 칩을 누르면 그 기업의 보고서 선택 화면으로 가고, ×로 하나씩 뺀다. 2곳 이상이면 기업 나란히 보기(최대 4곳)로 바로 연다(#534).
 * 비었으면 별을 눌러 더하는 방법을 알린다. '+ 기업 추가'는 검색창으로 초점을 옮긴다.
 */
export function FavoriteCompanies({ items, onRemove, onAdd }: FavoriteCompaniesProps) {
  const [removal, setRemoval] = useState<'idle' | 'error'>('idle')
  const comparePath = companyComparisonPath(items.map((item) => item.corpCode))
  const capped = items.length > MAX_COMPARE_COMPANIES
  return (
    <Card as="section" className="favorite-companies" aria-labelledby="favorite-companies-title">
      <div className="favorite-companies__head">
        <h2 className="favorite-companies__title" id="favorite-companies-title">
          <span className="favorite-companies__star" aria-hidden="true">
            <Icon name="star-filled" size={16} />
          </span>
          자주 찾는 기업 (즐겨찾기)
        </h2>
        <Badge>
          {items.length}
          <span className="visually-hidden">곳</span>
        </Badge>
        <div className="favorite-companies__actions">
          {comparePath !== null && (
            <ButtonLink
              variant="link"
              to={comparePath}
              aria-label={capped ? `관심 기업 최근 ${MAX_COMPARE_COMPANIES}곳 나란히 보기` : '관심 기업 나란히 보기'}
            >
              {capped ? `최근 ${MAX_COMPARE_COMPANIES}곳 나란히 보기` : '나란히 보기'}
            </ButtonLink>
          )}
          <Button variant="link" onClick={onAdd}>
            + 기업 추가
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="favorite-companies__empty">기업 화면에서 별을 누르면 자주 찾는 기업으로 여기에 모여요.</p>
      ) : (
        <ul className="favorite-companies__list">
          {items.map((item, index) => (
            <li key={item.corpCode} className="favorite-chip" style={{ '--row': index } as CSSProperties}>
              <Link to={`/companies/${encodeURIComponent(item.corpCode)}`} className="favorite-chip__link">
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
      )}
      {removal === 'error' && <AlertState title="관심 기업에서 빼지 못했어요.">잠시 뒤 다시 시도해 주세요.</AlertState>}
    </Card>
  )
}
