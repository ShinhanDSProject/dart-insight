import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getCompany, type Company } from '../api/companies'
import { listReports, type ReportItem, type ReportList } from '../api/reports'
import { DartLinkInline } from '../components/DartLink'
import { EmptyState, ErrorState, LoadingState } from '../components/StateView'
import { ReportDetailPanel } from './company/ReportDetailPanel'
import { correctionLabel, dataStatusHelp, dataStatusLabel, formatDate, periodLabel } from './company/reportLabels'
import './company/company.css'

type PageState =
  | { kind: 'loading' }
  | { kind: 'done'; company: Company; reports: ReportList }
  | { kind: 'error'; error: unknown }

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 보고서 목록을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

const refreshErrorMessages: Record<string, string> = {
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘었어요',
  DART_REQUEST_FAILED: 'OpenDART에 연결하지 못했어요',
}

/**
 * W-01 ② 보고서 선택. 현재 보고서는 주소(?current=접수번호)에 남기고, 없으면 가장 최근 보고서다.
 * 비교 기준·비교 보고서 선택은 2.1(#12), 비교 검증(W-01 ③)은 2.2(#13)에서 붙인다.
 */
export function CompanyPage() {
  const { corpCode = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    Promise.all([getCompany(corpCode), listReports(corpCode)])
      .then(([company, reports]) => {
        if (!cancelled) setState({ kind: 'done', company, reports })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [corpCode, retry])

  if (state.kind === 'loading') {
    return (
      <section className="page">
        <Breadcrumb />
        <LoadingState message="정기보고서 목록을 불러오는 중입니다… 처음 여는 기업은 OpenDART에서 받아 오느라 조금 걸려요." />
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className="page">
        <Breadcrumb />
        <h1 className="page__title">정기보고서</h1>
        <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} messages={errorMessages} />
      </section>
    )
  }

  const { company, reports } = state
  const items = reports.items
  const currentNo = searchParams.get('current')
  const current = items.find((r) => r.rceptNo === currentNo) ?? items[0] ?? null

  function selectCurrent(report: ReportItem) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('current', report.rceptNo)
        return next
      },
      { replace: true },
    )
  }

  return (
    <section className="page">
      <Breadcrumb />
      <h1 className="page__title company-title">
        {company.corpName}
        <span className="company-title__code">{company.listed ? company.stockCode : '비상장'}</span>
      </h1>
      <p className="page__lead">비교할 두 보고서를 고르세요. 현재 보고서는 기본으로 가장 최근 보고서예요.</p>

      {reports.refreshError && (
        <div className="notice notice--attention" role="status">
          {refreshNotice(reports)}
        </div>
      )}

      <div className="panel">
        {items.length === 0 ? (
          <EmptyState title="이 기업의 정기보고서가 없어요.">
            <p>
              사업·반기·분기보고서를 낸 적이 없거나 12월 결산이 아닌 회사일 수 있어요. 지금은 12월 결산 회사의 보고서만
              비교할 수 있어요.
            </p>
            <Link to="/">다른 기업 검색</Link>
          </EmptyState>
        ) : (
          <ReportTable items={items} current={current} onSelect={selectCurrent} />
        )}
        <p className="panel__note">
          대상 기간과 제출일은 따로 보여 줘요. 정정 여부를 확인하지 못하면 추정하지 않고 '확인 안 됨'으로 표시해요.
          <br />
          사업·반기·분기보고서(A001~A003) 중 12월 결산 보고서만 보여요. 그 밖의 정기공시(A004·A005)는 지원 범위가 정해지면
          추가해요.
        </p>
      </div>

      {current && <ReportDetailPanel key={current.rceptNo} rceptNo={current.rceptNo} />}
    </section>
  )
}

function refreshNotice(reports: ReportList): string {
  const reason = refreshErrorMessages[reports.refreshError ?? ''] ?? 'OpenDART에서 최신 목록을 받지 못했어요'
  const when = reports.fetchedAt ? `${formatDate(reports.fetchedAt.slice(0, 10))}에 ` : ''
  return `${reason}. ${when}받아 둔 목록을 보여 줘요.`
}

function Breadcrumb() {
  return (
    <nav className="breadcrumb" aria-label="현재 위치">
      <Link to="/">기업 검색</Link> / 정기보고서
    </nav>
  )
}

interface ReportTableProps {
  items: ReportItem[]
  current: ReportItem | null
  onSelect: (report: ReportItem) => void
}

function ReportTable({ items, current, onSelect }: ReportTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">정기보고서 목록. 보고서 이름을 누르면 현재 보고서로 고릅니다.</caption>
        <thead>
          <tr>
            <th scope="col">보고서</th>
            <th scope="col">유형</th>
            <th scope="col">대상 기간</th>
            <th scope="col">제출일</th>
            <th scope="col">정정 여부</th>
            <th scope="col">자료 상태</th>
            <th scope="col">원문</th>
          </tr>
        </thead>
        <tbody>
          {items.map((report) => {
            const isCurrent = current?.rceptNo === report.rceptNo
            return (
              <tr key={report.rceptNo} className={isCurrent ? 'data-table__row--selected' : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="link-button"
                    aria-pressed={isCurrent}
                    onClick={() => onSelect(report)}
                  >
                    {report.reportName}
                  </button>
                  {isCurrent && <span className="badge badge--strong">현재</span>}
                </th>
                <td>
                  <code>{report.disclosureType}</code>
                </td>
                <td>{periodLabel(report)}</td>
                <td>{formatDate(report.receivedAt)}</td>
                <td>{correctionLabel(report.correction)}</td>
                <td title={dataStatusHelp[report.financialDataStatus]}>{dataStatusLabel(report.financialDataStatus)}</td>
                <td>
                  <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
