import { useState, type KeyboardEvent, type Ref } from 'react'
import { Link } from 'react-router'
import type { Company } from '@/shared/api/companies'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { Badge, Icon } from '@/shared/ui'
import { collapseList } from '../model/collapsedList'
import { matchRanges, stockCodeRanges } from '../model/matchRanges'
import { nextResultFocus } from '../model/resultFocus'
import { sameNameCounts } from '../model/sameName'
import { HighlightedText } from './HighlightedText'
import { MoreToggle } from './MoreToggle'

/** 결과 링크를 고르는 선택자. 입력창의 ↓도 이것으로 첫 결과를 찾는다 */
export const RESULT_LINK_SELECTOR = 'a[data-result-index]'

/** 처음에 보이는 결과 수. 나머지는 '더 보기'로 펼친다. 접힌 행은 그리지 않아 ↓·End로도 가지 않는다 */
export const RESULT_INITIAL_COUNT = 10
const LIST_ID = 'company-search-results'

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
 * 한 행은 왼쪽에 이름·배지와 그 아래 종목코드·고유번호, 오른쪽에 '기업 선택 →'이다(#549). 처음엔 10곳만 보이고 '더 보기'로 펼친다.
 * 검색어가 바뀌면 접힌 상태로 돌아가도록 부르는 쪽이 검색어를 key로 준다.
 */
export function CompanyList({ items, query, onBackToInput, ref }: CompanyListProps) {
  const sameNames = sameNameCounts(items)
  const favorites = useFavoriteCompanies()
  const [expanded, setExpanded] = useState(false)
  const { shown, hiddenCount, toggleable } = collapseList(items, RESULT_INITIAL_COUNT, expanded)

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (!(event.target instanceof HTMLElement)) return
    const { resultIndex } = event.target.dataset
    if (resultIndex === undefined) return
    const index = Number(resultIndex)
    const next = nextResultFocus(index, event.key, shown.length)
    if (next === null) return
    event.preventDefault()
    if (next === 'input') onBackToInput()
    else event.currentTarget.querySelectorAll<HTMLElement>(RESULT_LINK_SELECTOR)[next]?.focus()
  }

  return (
    <div className="company-results">
      <ul
        ref={ref}
        id={LIST_ID}
        className="company-list"
        aria-label={`검색 결과 ${items.length}곳`}
        onKeyDown={handleKeyDown}
      >
        {shown.map((company, index) => {
          const sameCount = sameNames.get(company.corpName)
          return (
            <li key={company.corpCode}>
              <Link to={`/companies/${company.corpCode}`} className="company-list__item" data-result-index={index}>
                <span className="company-list__body">
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
                </span>
                {/* 행 전체가 링크라 버튼 모양을 따로 두지 않고, 다음 행동을 글자로 보인다 */}
                <span className="company-list__go" aria-hidden="true">
                  기업 선택
                  <Icon name="chevron-right" size={16} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {toggleable && (
        <MoreToggle
          controls={LIST_ID}
          expanded={expanded}
          hiddenCount={hiddenCount}
          unit="개"
          onToggle={() => setExpanded((value) => !value)}
        />
      )}
    </div>
  )
}
