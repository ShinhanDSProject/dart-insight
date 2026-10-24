import type { KeyboardEvent, Ref } from 'react'
import { Link } from 'react-router'
import type { Company } from '@/shared/api/companies'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { Badge, Icon } from '@/shared/ui'
import { matchRanges, stockCodeRanges } from '../model/matchRanges'
import { nextResultFocus } from '../model/resultFocus'
import { sameNameCounts } from '../model/sameName'
import { HighlightedText } from './HighlightedText'

/** 결과 링크를 고르는 선택자. 입력창의 ↓도 이것으로 첫 결과를 찾는다 */
export const RESULT_LINK_SELECTOR = 'a[data-result-index]'

interface CompanyListProps {
  items: Company[]
  /** 강조할 검색어(주소의 ?q=) */
  query: string
  /** ↑(첫 결과)·Esc로 입력창에 돌아갈 때 */
  onBackToInput: () => void
  ref?: Ref<HTMLUListElement>
}

/**
 * 검색 결과. 상장 여부를 글자로 보이고, 이름이 같은 회사가 있으면 알려 준다. 관심 기업은 별을 붙인다(FS-18 AC3).
 * 검색어와 맞는 부분을 강조하고, 결과 링크 사이를 ↑↓·Home·End로 옮긴다(FS-32). Enter는 링크가 연다.
 */
export function CompanyList({ items, query, onBackToInput, ref }: CompanyListProps) {
  const sameNames = sameNameCounts(items)
  const favorites = useFavoriteCompanies()

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (!(event.target instanceof HTMLElement)) return
    const { resultIndex } = event.target.dataset
    if (resultIndex === undefined) return
    const index = Number(resultIndex)
    const next = nextResultFocus(index, event.key, items.length)
    if (next === null) return
    event.preventDefault()
    if (next === 'input') onBackToInput()
    else event.currentTarget.querySelectorAll<HTMLElement>(RESULT_LINK_SELECTOR)[next]?.focus()
  }

  return (
    <ul ref={ref} className="company-list" aria-label={`검색 결과 ${items.length}곳`} onKeyDown={handleKeyDown}>
      {items.map((company, index) => {
        const sameCount = sameNames.get(company.corpName)
        return (
          <li key={company.corpCode}>
            <Link to={`/companies/${company.corpCode}`} className="company-list__item" data-result-index={index}>
              <span className="company-list__head">
                <span className="company-list__name">
                  <HighlightedText text={company.corpName} ranges={matchRanges(company.corpName, query)} />
                </span>
                {favorites.isFavorite(company.corpCode) && (
                  <span className="company-list__favorite">
                    <Icon name="star-filled" size={14} />
                    <span className="visually-hidden">관심 기업</span>
                  </span>
                )}
                <Badge tone={company.listed ? 'accent' : 'neutral'}>{company.listed ? '상장' : '비상장'}</Badge>
                {sameCount !== undefined && <span className="company-list__same">같은 이름 {sameCount}곳</span>}
              </span>
              <span className="company-list__meta">
                {company.listed && company.stockCode !== null && (
                  <span>
                    종목코드{' '}
                    <HighlightedText text={company.stockCode} ranges={stockCodeRanges(company.stockCode, query)} />
                  </span>
                )}
                <span className="company-list__code">
                  고유번호 <code>{company.corpCode}</code>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
