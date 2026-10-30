import type { ReactNode } from 'react'
import type { ReportItem } from '@/shared/api/reports'
import { cx } from '@/shared/lib/cx'
import { correctionLabel, formatDate, formatDateRange } from '@/shared/lib/reportLabels'
import { Badge } from './Badge'
import { Card } from './Card'

/** previous: 이전(비교) 보고서, current: 현재 보고서 */
export type ReportCardSide = 'previous' | 'current'

export type ReportCardReport = Pick<ReportItem, 'reportName' | 'fiscalYear' | 'periodEnd' | 'receivedAt' | 'correction'>

const SIDE_LABELS: Record<ReportCardSide, string> = { previous: '이전 보고서', current: '현재 보고서' }

interface ReportCardProps {
  side: ReportCardSide
  /** null이면 아직 고르지 않은 칸. emptyText를 보인다 */
  report: ReportCardReport | null
  emptyText?: ReactNode
  /** 카드 아래에 붙는 고르기 칸·자세히 보기 등 */
  children?: ReactNode
  className?: string
}

/**
 * 비교하는 두 보고서 중 한 장(#549). 왼쪽 위 배지('이전 보고서' 회색 / '현재 보고서' 보라), 큰 보고서 이름,
 * 대상 기간 · 제출일, 정정 여부. 현재 보고서는 옅은 바탕(Card tone="subtle")이다.
 * 보고서 선택·비교 확인·분석 진행 화면이 같은 카드 두 장을 ReportCardPair로 나란히 쓴다.
 */
export function ReportCard({ side, report, emptyText, children, className }: ReportCardProps) {
  return (
    <Card
      as="section"
      tone={side === 'current' ? 'subtle' : 'default'}
      className={cx('report-card', className)}
      aria-label={SIDE_LABELS[side]}
    >
      <Badge tone={side === 'current' ? 'accent' : 'neutral'} className="report-card__badge">
        {SIDE_LABELS[side]}
      </Badge>
      {report === null ? (
        <p className="report-card__empty">{emptyText ?? '아직 고르지 않았어요.'}</p>
      ) : (
        <>
          <p className="report-card__title">{report.reportName}</p>
          <p className="report-card__meta">
            {formatDateRange(`${report.fiscalYear}-01-01`, report.periodEnd)} · 제출 {formatDate(report.receivedAt)}
          </p>
          <p className="report-card__meta">{correctionLabel(report.correction)}</p>
        </>
      )}
      {children}
    </Card>
  )
}

/** 이전·현재 보고서 카드 두 장을 한 줄에(좁으면 위아래로) 둔다 */
export function ReportCardPair({ children }: { children: ReactNode }) {
  return <div className="report-card-pair">{children}</div>
}
