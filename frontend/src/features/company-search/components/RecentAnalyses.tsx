import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { viewedAtLabel, type RecentAnalysis } from '@/shared/lib/recentAnalyses'
import { Button, Card, Icon } from '@/shared/ui'
import { collapseList } from '../model/collapsedList'
import { MoreToggle } from './MoreToggle'

/** 처음에 보이는 카드 수. 나머지는 '더 보기'로 펼친다(#374) */
const RECENT_INITIAL_COUNT = 4
const LIST_ID = 'recent-analyses-list'

interface RecentAnalysesProps {
  items: RecentAnalysis[]
  onRemove: (analysisId: number) => void
  onClear: () => void
}

/**
 * W-01 ① 검색창 아래 '최근 본 분석'(FS-7 R2~R4). 카드를 누르면 결과 화면으로 바로 가고, 하나씩 또는 모두 지울 수 있다.
 * 이 브라우저에만 남는 기록이라 목록이 비면 영역을 보이지 않는다. 처음엔 4개만 보이고 '더 보기'로 펼친다(#374).
 */
export function RecentAnalyses({ items, onRemove, onClear }: RecentAnalysesProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const { shown, hiddenCount, toggleable } = collapseList(items, RECENT_INITIAL_COUNT, expanded)
  const now = new Date()
  return (
    <section className="recent-analyses" aria-labelledby="recent-analyses-title">
      <div className="recent-analyses__head">
        <h2 className="recent-analyses__title" id="recent-analyses-title">
          최근 본 분석
        </h2>
        <Button variant="link" onClick={onClear}>
          모두 지우기
        </Button>
      </div>
      <ul className="recent-analyses__list" id={LIST_ID}>
        {shown.map((item, index) => (
          <li key={item.analysisId} style={{ '--row': index } as CSSProperties}>
            <Card className="recent-card">
              <Link to={`/analyses/${item.analysisId}`} className="recent-card__link">
                <span className="recent-card__corp">{item.corpName}</span>
                <span className="recent-card__pair">
                  {item.previousReportName} → {item.currentReportName}
                </span>
                <span className="recent-card__meta">
                  {item.basisLabel} · <time dateTime={item.viewedAt}>{viewedAtLabel(item.viewedAt, now)}</time>
                </span>
              </Link>
              <Button
                variant="icon"
                className="recent-card__remove"
                aria-label={`${item.corpName} 최근 본 분석에서 지우기`}
                onClick={() => onRemove(item.analysisId)}
              >
                <Icon name="x" size={16} />
              </Button>
            </Card>
          </li>
        ))}
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
    </section>
  )
}
