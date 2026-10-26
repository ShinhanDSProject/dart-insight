import { useState } from 'react'
import { Link } from 'react-router'
import { viewedAtLabel, type RecentAnalysis } from '@/shared/lib/recentAnalyses'
import { Button, Icon } from '@/shared/ui'
import { collapseList } from '../model/collapsedList'
import { MoreToggle } from './MoreToggle'

/** 처음에 보이는 행 수. 옆 열(관심 기업 새 공시)과 같게 두어 행이 나란히 맞는다. 나머지는 '더 보기'로 펼친다(#374, #378) */
const RECENT_INITIAL_COUNT = 5
const LIST_ID = 'recent-analyses-list'

interface RecentAnalysesProps {
  items: RecentAnalysis[]
  onRemove: (analysisId: number) => void
  onClear: () => void
}

/**
 * W-01 ① 검색창 아래 '최근 본 분석'(FS-7 R2~R4). 행을 누르면 결과 화면으로 바로 가고, 하나씩 또는 모두 지울 수 있다.
 * 이 브라우저에만 남는 기록이라 목록이 비면 영역을 보이지 않는다. 처음엔 5개만 보이고 '더 보기'로 펼친다(#374).
 * 제목 줄·목록·아래 줄 세 칸으로 그려, 첫 화면 두 열에서 옆 열(관심 기업 새 공시)과 줄이 맞는다(#378).
 */
export function RecentAnalyses({ items, onRemove, onClear }: RecentAnalysesProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const { shown, hiddenCount, toggleable } = collapseList(items, RECENT_INITIAL_COUNT, expanded)
  const now = new Date()
  return (
    <section className="home-list recent-analyses" aria-labelledby="recent-analyses-title">
      <div className="home-list__head">
        <h2 className="home-list__title" id="recent-analyses-title">
          최근 본 분석
        </h2>
        <Button variant="link" onClick={onClear}>
          모두 지우기
        </Button>
      </div>
      <div className="home-list__body">
        <ul className="home-list__rows" id={LIST_ID}>
          {shown.map((item) => {
            const pair = `${item.previousReportName} → ${item.currentReportName}`
            return (
              <li key={item.analysisId} className="home-list__row recent-row">
                <Link to={`/analyses/${item.analysisId}`} className="recent-row__link" title={`${item.corpName} ${pair}`}>
                  <span className="home-list__line">
                    <span className="home-list__name">{item.corpName}</span>
                    <span className="home-list__meta">
                      {item.basisLabel} · <time dateTime={item.viewedAt}>{viewedAtLabel(item.viewedAt, now)}</time>
                    </span>
                  </span>
                  <span className="home-list__main">{pair}</span>
                </Link>
                <Button
                  variant="icon"
                  className="recent-row__remove"
                  aria-label={`${item.corpName} 최근 본 분석에서 지우기`}
                  onClick={() => onRemove(item.analysisId)}
                >
                  <Icon name="x" size={16} />
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="home-list__foot">
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
    </section>
  )
}
