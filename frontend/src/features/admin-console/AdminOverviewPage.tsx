import { useId } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { AdminDays, AdminOverview } from '@/shared/api/admin'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { formatDuration, formatInteger, formatRate, formatUsd } from '@/shared/lib/numberFormat'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Badge, Button, SegmentedControl, ShareBar, type ShareSegment, type ShareTone } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { ConsoleCard, ConsoleHeader, KpiTile, RankList } from './components/ConsoleParts'
import { DailyAnalysesChart } from './components/DailyAnalysesChart'
import { useAdminOverview } from './hooks/useAdminData'
import { parseOverviewDays, planLabel, PLANS, providerLabel, PROVIDERS, shortDateTime } from './model/adminConsole'

const DAY_OPTIONS = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
] as const

const PROVIDER_TONES: ShareTone[] = ['series-1', 'series-2', 'series-3', 'series-4']

/**
 * 관리자 개요(FS-72 R1·R4). 기간(7·30일)은 주소(?days=30)에 둔다. 숫자는 서버가 계산하고, 분모가 0인 비율·모르는 값은 —로 보인다.
 * 위에서부터 핵심 지표 → 날짜별 분석·실패 사유 → 회원·관심 기업·많이 분석한 기업·요금제 관심 순서다.
 */
export function AdminOverviewPage() {
  useDocumentTitle(pageTitle(['운영 콘솔', '개요']))
  const { params, update } = useQueryParams()
  const days = parseOverviewDays(params.get('days'))
  const overview = useAdminOverview(days)
  const daysLabelId = useId()

  return (
    <div className="console-page">
      <ConsoleHeader
        title="개요"
        lead={match(overview.state)
          .with({ status: 'success' }, ({ data }) => `최근 ${data.days}일 · ${data.from} ~ ${data.to} · 한국 시간 기준. 숫자는 코드가 계산해요.`)
          .otherwise(() => `최근 ${days}일 · 한국 시간 기준. 숫자는 코드가 계산해요.`)}
        aside={
          <>
            <span id={daysLabelId} className="visually-hidden">
              기간
            </span>
            <SegmentedControl
              aria-labelledby={daysLabelId}
              options={DAY_OPTIONS}
              value={String(days) as '7' | '30'}
              onChange={(value) => update({ days: value === '7' ? null : value })}
            />
            <Button variant="secondary" onClick={overview.reload}>
              새로 고침
            </Button>
          </>
        }
      />
      {match(overview.state)
        .with({ status: 'loading' }, () => <LoadingState message="운영 지표를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={overview.reload} />)
        .with({ status: 'success' }, ({ data }) => <OverviewBody data={data} days={days} />)
        .exhaustive()}
    </div>
  )
}

function OverviewBody({ data, days }: { data: AdminOverview; days: AdminDays }) {
  const { analyses, users, watch, community, ai, planInterests } = data
  const providerSegments: ShareSegment[] = PROVIDERS.map((p, i) => ({
    label: providerLabel(p),
    value: users.byProvider[p],
    text: formatInteger(users.byProvider[p]),
    tone: PROVIDER_TONES[i],
  }))

  return (
    <>
      <div className="kpi-grid">
        <KpiTile label="분석 요청" value={formatInteger(analyses.requested)} detail={`진행 중·대기 ${formatInteger(analyses.inProgress)}`} />
        <KpiTile
          label="완료율"
          value={formatRate(analyses.completionRate)}
          detail={`완료 ${formatInteger(analyses.completed)} · 실패 ${formatInteger(analyses.failed)}`}
          tone={analyses.failed > 0 ? 'danger' : 'default'}
          to={analyses.failed > 0 ? `/admin/analyses?status=FAILED&days=${days}` : undefined}
        />
        <KpiTile label="처리 시간" value={formatDuration(analyses.p50Seconds)} detail={`중앙값 · 90% ${formatDuration(analyses.p90Seconds)}`} />
        <KpiTile
          label="옛 버전 결과"
          value={formatInteger(analyses.outdated)}
          detail={analyses.outdated > 0 ? '지금 규칙으로 다시 분석 필요' : '모두 지금 규칙'}
          tone={analyses.outdated > 0 ? 'attention' : 'default'}
        />
        <KpiTile
          label="LLM 추정 비용"
          value={formatUsd(ai.estimatedCostUsd)}
          detail={
            ai.unpricedCalls > 0
              ? `가격 없는 호출 ${formatInteger(ai.unpricedCalls)}건 제외`
              : `호출 ${formatInteger(ai.calls)} · 실패 ${formatInteger(ai.failedCalls)}`
          }
          tone={ai.failedCalls > 0 ? 'attention' : 'default'}
          to="/system/ai-usage"
        />
        <KpiTile
          label="처리할 신고"
          value={formatInteger(community.openReports)}
          detail={community.openReports > 0 ? '신고 처리로 가기 ›' : `기간 안 글 ${formatInteger(community.postsInPeriod)}`}
          tone={community.openReports > 0 ? 'danger' : 'default'}
          to="/admin/reports"
        />
      </div>

      <div className="console-grid console-grid--wide-narrow">
        <ConsoleCard title="날짜별 분석" titleId="overview-daily" note={`요청 ${formatInteger(analyses.requested)}`}>
          <DailyAnalysesChart days={analyses.daily} />
        </ConsoleCard>
        <ConsoleCard title="실패 사유 상위" titleId="overview-failures" note={`실패 ${formatInteger(analyses.failed)}`}>
          {analyses.topFailures.length === 0 ? (
            <p className="console-empty">이 기간에 실패한 분석이 없어요.</p>
          ) : (
            <ul className="failure-list">
              {analyses.topFailures.map((f) => (
                <li key={f.errorCode} className="failure-list__row">
                  <span className="failure-list__text">
                    <code className="failure-list__code">{f.errorCode}</code>
                    <span className="failure-list__when">마지막 {shortDateTime(f.lastAt)}</span>
                  </span>
                  <Badge tone="danger">{formatInteger(f.count)}건</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link to={`/admin/analyses?status=FAILED&days=${days}`} className="console-more">
            분석 작업에서 실패만 보기 ›
          </Link>
        </ConsoleCard>
      </div>

      <div className="console-grid console-grid--quad">
        <ConsoleCard title="회원" titleId="overview-users" note={`전체 ${formatInteger(users.total)}`}>
          <dl className="mini-stats">
            <div>
              <dt>{days}일 신규</dt>
              <dd>{formatInteger(users.newInPeriod)}</dd>
            </div>
            <div>
              <dt>관리자</dt>
              <dd>{formatInteger(users.admins)}</dd>
            </div>
          </dl>
          <p className="console-label">가입 방식</p>
          <ShareBar segments={providerSegments} />
          <Link to="/admin/users" className="console-more">
            회원 목록 ›
          </Link>
        </ConsoleCard>
        <ConsoleCard title="관심 기업 상위" titleId="overview-watch" note={`담은 수 ${formatInteger(watch.favorites)} · ${formatInteger(watch.companies)}곳`}>
          {watch.topWatched.length === 0 ? (
            <p className="console-empty">아직 관심 기업을 담은 회원이 없어요.</p>
          ) : (
            <RankList
              label="관심 기업 상위"
              rows={watch.topWatched.map((c) => ({ key: c.corpCode, label: c.corpName ?? c.corpCode, value: c.count, to: `/companies/${encodeURIComponent(c.corpCode)}` }))}
            />
          )}
          <p className="console-hint">모니터링 수요를 보는 값이에요.</p>
        </ConsoleCard>
        <ConsoleCard title="많이 분석한 기업" titleId="overview-companies" note={`최근 ${days}일`}>
          {analyses.topCompanies.length === 0 ? (
            <p className="console-empty">이 기간에 분석 요청이 없어요.</p>
          ) : (
            <RankList
              label="많이 분석한 기업"
              rows={analyses.topCompanies.map((c) => ({
                key: c.corpCode,
                label: c.corpName ?? c.corpCode,
                value: c.count,
                to: `/admin/analyses?q=${encodeURIComponent(c.corpCode)}&days=${days}`,
              }))}
            />
          )}
        </ConsoleCard>
        <ConsoleCard title="요금제 관심" titleId="overview-plans" note={`${formatInteger(planInterests.total)}회 · 로그인 회원·요금제 ${formatInteger(planInterests.signedInMembers)}쌍`}>
          <RankList
            label="요금제별 관심"
            tone="accent"
            rows={PLANS.map((p) => ({ key: p, label: planLabel(p), value: planInterests.byPlan[p] }))}
          />
          <p className="console-hint">
            결제는 없어요. 가격 가설을 검증하려고 세요. <Link to="/pricing">요금제 화면 ›</Link>
          </p>
        </ConsoleCard>
      </div>
    </>
  )
}
