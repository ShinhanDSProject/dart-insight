import { useId } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { AdminReportList, ReportQueue } from '@/shared/api/community'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { formatInteger } from '@/shared/lib/numberFormat'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, ButtonLink, Page, PageHeader, SegmentedControl } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { ReportCard } from './components/ReportCard'
import { useAdminReports, type AdminReportsController } from './hooks/useAdminReports'
import { adminErrorMessages, isForbidden, lastPage, parsePage, parseQueue, queueOptions } from './model/adminReports'
import './adminReports.css'

/**
 * 관리자 신고 목록(FS-58, #463). 처리할 것(새 신고·재게시 청구·블라인드 기한 지남)이나 전체 신고를 보고
 * 유지·블라인드(1~30일)·삭제로 처리한다. 관리자인지는 서버가 정하고, 아니면 들어올 수 없다는 안내만 보인다.
 * 큐와 쪽은 주소에 둔다(?queue=all&page=2).
 */
export function AdminReportsPage() {
  useDocumentTitle(pageTitle(['신고 관리']))
  const { params, update } = useQueryParams()
  const queue = parseQueue(params.get('queue'))
  const page = parsePage(params.get('page'))
  const reports = useAdminReports(queue, page)
  const queueLabelId = useId()

  const changeQueue = (next: ReportQueue) => update({ queue: next === 'todo' ? null : next, page: null })
  const changePage = (next: number) => update({ page: next === 0 ? null : String(next + 1) })
  const toolbar = (
    <div className="admin-reports__toolbar">
      <span id={queueLabelId} className="visually-hidden">
        신고 목록 범위
      </span>
      <SegmentedControl aria-labelledby={queueLabelId} options={queueOptions} value={queue} onChange={changeQueue} />
    </div>
  )

  return (
    <Page className="admin-reports">
      <PageHeader
        breadcrumb={
          <>
            <Link to="/">기업 검색</Link> / 신고 관리
          </>
        }
        title="신고 관리"
        lead="커뮤니티 신고를 확인하고 유지·블라인드·삭제로 처리해요. 처리 사유는 기록에 남고, 블라인드 사유는 작성자에게 보여요."
      />
      {match(reports.state)
        .with({ status: 'anonymous' }, () => (
          <EmptyState title="로그인한 관리자만 볼 수 있어요">
            <ButtonLink variant="primary" to="/login">
              로그인하기
            </ButtonLink>
          </EmptyState>
        ))
        .with({ status: 'error' }, ({ error }) => isForbidden(error), () => (
          <EmptyState title="관리자만 들어올 수 있어요">
            <p>신고 관리는 운영 관리자 계정으로만 쓸 수 있어요.</p>
            <ButtonLink variant="secondary" to="/">
              기업 검색으로
            </ButtonLink>
          </EmptyState>
        ))
        .with({ status: 'loading' }, () => (
          <>
            {toolbar}
            <LoadingState message="신고를 불러오는 중이에요…" />
          </>
        ))
        .with({ status: 'error' }, ({ error }) => (
          <>
            {toolbar}
            <ErrorState error={error} onRetry={reports.reload} messages={adminErrorMessages} />
          </>
        ))
        .with({ status: 'success' }, ({ data }) => (
          <>
            {toolbar}
            <ReportList list={data} queue={queue} reports={reports} onPage={changePage} />
          </>
        ))
        .exhaustive()}
    </Page>
  )
}

function ReportList({
  list,
  queue,
  reports,
  onPage,
}: {
  list: AdminReportList
  queue: ReportQueue
  reports: AdminReportsController
  onPage: (page: number) => void
}) {
  const last = lastPage(list)
  if (list.items.length === 0) {
    return (
      <EmptyState title={queue === 'todo' ? '처리할 신고가 없어요' : '아직 들어온 신고가 없어요'}>
        {list.page > 0 && (
          <Button variant="secondary" onClick={() => onPage(0)}>
            첫 쪽으로
          </Button>
        )}
      </EmptyState>
    )
  }
  return (
    <>
      <p className="admin-reports__count">
        {queue === 'todo' ? '처리할 신고' : '전체 신고'} {formatInteger(list.totalItems)}건
      </p>
      <ul className="admin-reports__list">
        {list.items.map((report) => (
          <li key={report.reportId}>
            <ReportCard report={report} onModerate={reports.moderate} />
          </li>
        ))}
      </ul>
      {last > 0 && (
        <nav className="admin-reports__pages" aria-label="쪽 이동">
          <Button variant="secondary" disabled={list.page === 0} onClick={() => onPage(list.page - 1)}>
            이전
          </Button>
          <span>
            {formatInteger(list.page + 1)} / {formatInteger(last + 1)}쪽
          </span>
          <Button variant="secondary" disabled={list.page >= last} onClick={() => onPage(list.page + 1)}>
            다음
          </Button>
        </nav>
      )}
    </>
  )
}
