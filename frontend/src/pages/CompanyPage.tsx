import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getCompany, type Company } from '../api/companies'
import { getReportPair, listReports, type ComparisonBasis, type ReportItem, type ReportList } from '../api/reports'
import { EmptyState, ErrorState, LoadingState } from '../components/StateView'
import { PairSelector, type PairLookup } from './company/PairSelector'
import { ReportDetailPanel } from './company/ReportDetailPanel'
import { ReportTable } from './company/ReportTable'
import { customCandidates, parseBasis } from './company/pairSelection'
import { formatDate } from './company/reportLabels'
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
 * W-01 ② 보고서 선택. 고른 값은 주소에 남긴다.
 * - ?current=접수번호: 현재 보고서. 없으면 가장 최근 보고서
 * - ?basis=YOY|PREV|CUSTOM: 비교 기준. 없으면 전년 동기(잠정안)
 * - ?previous=접수번호: 직접 선택(CUSTOM)에서 고른 비교 보고서
 * 두 보고서를 고르면 비교 검증(W-01 ③, /companies/:corpCode/compare)으로 간다.
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

  const items = state.kind === 'done' ? state.reports.items : null
  const current = items ? (items.find((r) => r.rceptNo === searchParams.get('current')) ?? items[0] ?? null) : null
  const basis = parseBasis(searchParams.get('basis'))
  const [lookup, setLookup] = useState<PairLookup>({ kind: 'idle' })
  const [lookupRetry, setLookupRetry] = useState(0)
  const currentNo = current?.rceptNo ?? null

  useEffect(() => {
    if (currentNo === null || basis === 'CUSTOM') {
      setLookup({ kind: 'idle' })
      return
    }
    let cancelled = false
    setLookup({ kind: 'loading' })
    getReportPair(corpCode, basis, currentNo)
      .then((pair) => {
        if (!cancelled) {
          setLookup({ kind: 'done', key: `${basis}:${currentNo}`, previous: pair.previous, reason: pair.reason?.message ?? null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLookup({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [corpCode, basis, currentNo, lookupRetry])

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
  const reportItems = reports.items
  // 다른 기준·현재 보고서로 찾은 결과는 쓰지 않는다(새로 찾는 동안 잠깐 남아 있을 수 있음)
  const pairLookup: PairLookup =
    lookup.kind === 'done' && lookup.key !== `${basis}:${currentNo}` ? { kind: 'loading' } : lookup
  const previous = findPrevious(reportItems, current, basis, pairLookup, searchParams.get('previous'))

  function updateParams(changes: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  function selectCurrent(rceptNo: string) {
    const nextCurrent = reportItems.find((r) => r.rceptNo === rceptNo) ?? null
    // 직접 고른 비교 보고서가 새 현재 보고서보다 앞서지 않으면 비운다
    const keepPrevious = previous !== null && customCandidates(reportItems, nextCurrent).includes(previous)
    updateParams({ current: rceptNo, previous: basis === 'CUSTOM' && keepPrevious ? previous.rceptNo : null })
  }

  function selectBasis(nextBasis: ComparisonBasis) {
    // 비교 기준을 바꿔도 현재 보고서는 그대로 두고, 비교 보고서만 바뀐다
    updateParams({ basis: nextBasis, previous: null })
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
        {current && (
          <PairSelector
            items={reportItems}
            basis={basis}
            current={current}
            previous={previous}
            lookup={pairLookup}
            onBasisChange={selectBasis}
            onCurrentChange={selectCurrent}
            onPreviousChange={(rceptNo) => updateParams({ previous: rceptNo })}
            onRetry={() => setLookupRetry((n) => n + 1)}
          />
        )}
        {reportItems.length === 0 ? (
          <EmptyState title="이 기업의 정기보고서가 없어요.">
            <p>
              사업·반기·분기보고서를 낸 적이 없거나 12월 결산이 아닌 회사일 수 있어요. 지금은 12월 결산 회사의 보고서만
              비교할 수 있어요.
            </p>
            <Link to="/">다른 기업 검색</Link>
          </EmptyState>
        ) : (
          <ReportTable
            items={reportItems}
            current={current}
            previous={previous}
            onSelectCurrent={(report) => selectCurrent(report.rceptNo)}
          />
        )}
        {current && (
          <div className="pair-actions">
            {previous ? (
              <Link
                to={`/companies/${encodeURIComponent(corpCode)}/compare?${new URLSearchParams({
                  current: current.rceptNo,
                  previous: previous.rceptNo,
                  basis,
                }).toString()}`}
                className="button button--primary"
              >
                비교 조건 확인 →
              </Link>
            ) : (
              <span className="pair__hint">비교 보고서를 고르면 비교 조건을 확인할 수 있어요.</span>
            )}
          </div>
        )}
        <p className="panel__note">
          대상 기간과 제출일은 따로 보여 줘요. 정정 여부를 확인하지 못하면 추정하지 않고 '확인 안 됨'으로 표시해요.
          <br />
          사업·반기·분기보고서(A001~A003) 중 12월 결산 보고서만 보여요. 그 밖의 정기공시(A004·A005)는 지원 범위가 정해지면
          추가해요.
        </p>
      </div>

      {current && (
        <div className="pair-details">
          {previous ? (
            <ReportDetailPanel key={previous.rceptNo} rceptNo={previous.rceptNo} title="비교 보고서 정보" />
          ) : (
            <section className="panel">
              <h2 className="panel__title">비교 보고서 정보</h2>
              <p className="panel__note">비교 보고서를 고르면 종류·대상 기간·제출일·정정 여부를 여기서 확인할 수 있어요.</p>
            </section>
          )}
          <ReportDetailPanel key={current.rceptNo} rceptNo={current.rceptNo} title="현재 보고서 정보" />
        </div>
      )}
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

function findPrevious(
  items: ReportItem[],
  current: ReportItem | null,
  basis: ComparisonBasis,
  lookup: PairLookup,
  customNo: string | null,
): ReportItem | null {
  if (basis === 'CUSTOM') {
    return customCandidates(items, current).find((r) => r.rceptNo === customNo) ?? null
  }
  if (lookup.kind !== 'done' || lookup.previous === null) return null
  const found = lookup.previous
  return items.find((r) => r.rceptNo === found.rceptNo) ?? found
}
