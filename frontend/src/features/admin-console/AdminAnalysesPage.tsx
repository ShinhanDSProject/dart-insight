import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { AdminAnalysisItem } from '@/shared/api/admin'
import type { AnalysisStatus } from '@/shared/api/analyses'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { formatDuration, formatInteger } from '@/shared/lib/numberFormat'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Badge, Button, DataTable, Icon, Input, SegmentedControl } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { ConsoleHeader, Pager } from './components/ConsoleParts'
import { useAdminAnalyses } from './hooks/useAdminData'
import {
  lastPage,
  normalizeQuery,
  parseAnalysisDays,
  parseAnalysisStatus,
  parsePage,
  shortDateTime,
  statusLabel,
  statusTone,
} from './model/adminConsole'

type StatusFilter = 'ALL' | AnalysisStatus
type DaysFilter = 'ALL' | '1' | '7' | '30'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'RUNNING', label: '진행 중' },
  { value: 'PENDING', label: '대기' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'FAILED', label: '실패' },
]

const DAYS_OPTIONS: { value: DaysFilter; label: string }[] = [
  { value: '1', label: '1일' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: 'ALL', label: '전체' },
]

/**
 * 관리자 분석 작업(FS-72 R2). 상태·기간·검색어(분석 ID·고유번호·기업명·추적 ID)·쪽은 주소에 둔다(?status=FAILED&days=7&q=&page=2).
 * 실패한 분석은 사유 코드·메시지·추적 ID를 행 아래에 펼쳐 보이고, 진행·결과 화면으로 바로 간다.
 */
export function AdminAnalysesPage() {
  useDocumentTitle(pageTitle(['운영 콘솔', '분석 작업']))
  const { params, update } = useQueryParams()
  const status = parseAnalysisStatus(params.get('status'))
  const days = parseAnalysisDays(params.get('days'))
  const q = normalizeQuery(params.get('q'))
  const page = parsePage(params.get('page'))
  const list = useAdminAnalyses({ status, days, q, page })
  const statusLabelId = useId()
  const daysLabelId = useId()
  const searchId = useId()
  const [draft, setDraft] = useState(q ?? '')

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    update({ q: normalizeQuery(draft), page: null })
  }

  return (
    <div className="console-page">
      <ConsoleHeader title="분석 작업" lead="요청된 분석의 상태·실패 사유·추적 ID예요. 사용자가 알려 준 추적 ID나 기업명으로 찾을 수 있어요." />
      <div className="console-filters">
        <span id={statusLabelId} className="visually-hidden">
          상태
        </span>
        <SegmentedControl
          aria-labelledby={statusLabelId}
          options={STATUS_OPTIONS}
          value={status ?? 'ALL'}
          onChange={(value) => update({ status: value === 'ALL' ? null : value, page: null })}
        />
        <span id={daysLabelId} className="visually-hidden">
          기간
        </span>
        <SegmentedControl
          aria-labelledby={daysLabelId}
          options={DAYS_OPTIONS}
          value={days === null ? 'ALL' : (String(days) as DaysFilter)}
          onChange={(value) => update({ days: value === 'ALL' ? null : value, page: null })}
        />
        <form className="console-search" role="search" aria-label="분석 작업 찾기" onSubmit={onSearch}>
          <label htmlFor={searchId} className="visually-hidden">
            분석 ID, 기업명, 고유번호 또는 추적 ID
          </label>
          <Icon name="search" size={16} />
          <Input
            id={searchId}
            type="search"
            value={draft}
            maxLength={50}
            placeholder="분석 ID · 기업명 · 고유번호 · 추적 ID"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            찾기
          </Button>
        </form>
      </div>
      {match(list.state)
        .with({ status: 'loading' }, () => <LoadingState message="분석 작업을 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={list.reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.totalItems === 0 ? (
            <EmptyState title="조건에 맞는 분석이 없어요">
              <p className="console-gate-text">기간을 넓히거나 검색어를 지워 보세요.</p>
            </EmptyState>
          ) : (
            <section className="console-card" aria-labelledby="analyses-title">
              <div className="console-card__head">
                <h2 className="console-card__title" id="analyses-title">
                  {status === null ? '분석' : statusLabel(status)} {formatInteger(data.totalItems)}건
                </h2>
                <span className="console-card__note">최근 요청 순</span>
              </div>
              <DataTable caption="분석 작업 목록. 분석 ID, 기업, 비교, 상태, 단계, 소요 시간, 버전, 요청 시각 순입니다." density="compact">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">기업</th>
                    <th scope="col">비교</th>
                    <th scope="col">상태</th>
                    <th scope="col">소요</th>
                    <th scope="col">버전</th>
                    <th scope="col">요청 시각</th>
                    <th scope="col">
                      <span className="visually-hidden">이동</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <AnalysisRow key={item.analysisId} item={item} />
                  ))}
                </tbody>
              </DataTable>
              <Pager
                page={data.page}
                last={lastPage(data.totalItems, data.size)}
                total={data.totalItems}
                size={data.size}
                onChange={(next) => update({ page: next === 0 ? null : String(next + 1) })}
              />
            </section>
          ),
        )
        .exhaustive()}
    </div>
  )
}

function AnalysisRow({ item }: { item: AdminAnalysisItem }) {
  const target = item.status === 'COMPLETED' ? `/analyses/${item.analysisId}` : `/analyses/${item.analysisId}/progress`
  return (
    <>
      <tr className={item.status === 'FAILED' ? 'jobs__row jobs__row--failed' : 'jobs__row'}>
        <td className="jobs__num">{item.analysisId}</td>
        <th scope="row" className="jobs__corp">
          {item.corpName}
          <span className="jobs__sub">{item.corpCode}</span>
        </th>
        <td>
          {item.previous.reportName} → {item.current.reportName}
        </td>
        <td>
          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
        </td>
        <td className="jobs__num">{formatDuration(item.durationSeconds)}</td>
        <td>
          {item.analysisVersion}
          {item.outdated && <Badge tone="attention">옛 버전</Badge>}
        </td>
        <td className="jobs__num">{shortDateTime(item.createdAt)}</td>
        <td>
          <Link to={target} className="jobs__open" aria-label={`분석 ${item.analysisId} ${item.status === 'COMPLETED' ? '결과' : '진행'} 화면`}>
            {item.status === 'COMPLETED' ? '결과' : '진행'} ›
          </Link>
        </td>
      </tr>
      {(item.errorCode !== null || item.traceId !== null) && item.status === 'FAILED' && (
        <tr className="jobs__detail">
          <td colSpan={8}>
            <span className="jobs__error">
              {item.errorCode && <code>{item.errorCode}</code>} {item.errorMessage}
            </span>
            {item.traceId && <TraceId value={item.traceId} />}
          </td>
        </tr>
      )}
    </>
  )
}

function TraceId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="jobs__trace">
      추적 ID <code>{value}</code>
      <Button
        variant="link"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => setCopied(false))
        }}
      >
        <Icon name="copy" size={14} />
        {copied ? '복사했어요' : '복사'}
      </Button>
    </span>
  )
}
