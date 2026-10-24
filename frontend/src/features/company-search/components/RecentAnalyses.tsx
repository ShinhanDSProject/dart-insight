import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { viewedAtLabel, type RecentAnalysis } from '@/shared/lib/recentAnalyses'
import { Button, Card, Icon } from '@/shared/ui'

interface RecentAnalysesProps {
  items: RecentAnalysis[]
  onRemove: (analysisId: number) => void
  onClear: () => void
}

/**
 * W-01 ① 검색창 아래 '최근 본 분석'(FS-7 R2~R4). 카드를 누르면 결과 화면으로 바로 가고, 하나씩 또는 모두 지울 수 있다.
 * 이 브라우저에만 남는 기록이라 목록이 비면 영역을 보이지 않는다.
 */
export function RecentAnalyses({ items, onRemove, onClear }: RecentAnalysesProps) {
  if (items.length === 0) return null
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
      <ul className="recent-analyses__list">
        {items.map((item, index) => (
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
    </section>
  )
}
