import { Link } from 'react-router'
import type { AdminReport, ModerationRequest } from '@/shared/api/community'
import { dateTimeLabel } from '@/shared/lib/communityLabels'
import { formatInteger } from '@/shared/lib/numberFormat'
import { Badge, Notice, Panel } from '@/shared/ui'
import {
  canModerate,
  decisionLabels,
  reasonSummary,
  reportCountLabel,
  statusLabels,
  targetLink,
  targetStateLabels,
  todoLabels,
} from '../model/adminReports'
import { ModerationForm } from './ModerationForm'

interface ReportCardProps {
  report: AdminReport
  onModerate: (reportId: number, request: ModerationRequest) => Promise<void>
}

/**
 * 신고 한 건. 대상 본문(가렸거나 지운 것도 전체), 사유별 건수, 상태·처리할 이유, 재게시 청구, 처리 기록, 처리 폼.
 * 신고한 사람은 보이지 않는다(서버도 사유별 건수만 준다).
 */
export function ReportCard({ report, onModerate }: ReportCardProps) {
  const { target } = report
  const titleId = `admin-report-${report.reportId}`
  const noun = target.type === 'POST' ? '글' : '댓글'

  return (
    <Panel as="section" className="admin-reports__card" aria-labelledby={titleId}>
      <header className="admin-reports__head">
        <h2 id={titleId} className="admin-reports__title">
          {target.corpName} {noun} · {target.author.nickname}
        </h2>
        <div className="admin-reports__badges">
          {report.todo !== null && <Badge tone="attention">{todoLabels[report.todo]}</Badge>}
          <Badge tone="accent">{statusLabels[report.status]}</Badge>
          <Badge>{targetStateLabels[target.state]}</Badge>
        </div>
      </header>

      <p className="admin-reports__body">{target.body}</p>
      <Link className="admin-reports__link" to={targetLink(report)}>
        {target.corpName} 커뮤니티에서 보기
      </Link>

      <dl className="admin-reports__meta">
        <div>
          <dt>{reportCountLabel(report.reportCount)}</dt>
          <dd>
            <ul className="admin-reports__reasons" aria-label="사유별 신고 수">
              {reasonSummary(report.reasonCounts).map((item) => (
                <li key={item.reason}>
                  {item.label} {formatInteger(item.count)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>마지막 신고</dt>
          <dd>{dateTimeLabel(report.lastReportedAt)}</dd>
        </div>
        {report.blindUntil !== null && (
          <div>
            <dt>블라인드 기한</dt>
            <dd>{dateTimeLabel(report.blindUntil)}까지</dd>
          </div>
        )}
      </dl>

      {report.repostRequest !== null && (
        <Notice className="admin-reports__repost" title={`작성자의 재게시 청구 · ${dateTimeLabel(report.repostRequest.createdAt)}`}>
          <p>{report.repostRequest.message ?? '남긴 말이 없어요.'}</p>
        </Notice>
      )}

      {report.moderations.length > 0 && (
        <details className="admin-reports__history">
          <summary>처리 기록 {formatInteger(report.moderations.length)}건</summary>
          <ol>
            {report.moderations.map((moderation, index) => (
              <li key={index}>
                <strong>{decisionLabels[moderation.decision]}</strong>
                {moderation.blindDays !== null && ` ${formatInteger(moderation.blindDays)}일`}
                {' · '}
                {moderation.admin.nickname ?? '관리자'} · {dateTimeLabel(moderation.createdAt)}
                <p>{moderation.reason}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      {canModerate(report) ? (
        <ModerationForm report={report} onSubmit={onModerate} />
      ) : (
        <p className="admin-reports__closed">삭제한 신고라 더 처리할 수 없어요.</p>
      )}
    </Panel>
  )
}
