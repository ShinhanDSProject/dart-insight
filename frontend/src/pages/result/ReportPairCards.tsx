import type { ReportItem } from '../../api/reports'
import { DartLinkInline } from '../../components/DartLink'
import { correctionLabel, formatDate, periodLabel, reportTypeLabel } from '../company/reportLabels'

/** 두 보고서를 나란히: 비교 보고서는 왼쪽, 현재 보고서는 오른쪽 */
export function ReportPairCards({ previous, current }: { previous: ReportItem; current: ReportItem }) {
  return (
    <div className="pair-cards">
      <ReportCard role="비교 보고서" report={previous} />
      <ReportCard role="현재 보고서" report={current} />
    </div>
  )
}

function ReportCard({ role, report }: { role: string; report: ReportItem }) {
  return (
    <section className="pair-card" aria-label={role}>
      <p className="pair-card__role">{role}</p>
      <p className="pair-card__name">{report.reportName}</p>
      <dl className="pair-card__facts">
        <div>
          <dt>종류</dt>
          <dd>{reportTypeLabel(report.reportType)}</dd>
        </div>
        <div>
          <dt>대상 기간</dt>
          <dd>{periodLabel(report)}</dd>
        </div>
        <div>
          <dt>제출일</dt>
          <dd>{formatDate(report.receivedAt)}</dd>
        </div>
        <div>
          <dt>정정 여부</dt>
          <dd>{correctionLabel(report.correction)}</dd>
        </div>
        <div>
          <dt>원문</dt>
          <dd>
            <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
