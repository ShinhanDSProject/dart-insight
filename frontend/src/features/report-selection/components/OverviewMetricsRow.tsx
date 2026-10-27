import { useId } from 'react'
import { match } from 'ts-pattern'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { Panel, PanelTitle, Skeleton, StatNumber } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useOverviewMetrics } from '../hooks/useOverviewMetrics'
import { fsDivLabel } from '../model/financialTrend'
import {
  annualPeriodLabel,
  formatMetricAmount,
  hasMetricValues,
  metricChange,
  metricUnit,
  type MetricItem,
  type OverviewMetrics,
} from '../model/overviewMetrics'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '기업을 찾지 못해 주요 수치를 보여 드릴 수 없어요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 주요 수치를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 주요 수치를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
}

/**
 * 기업 개요 상단 지표 줄(FS-58, #444). 가장 최근 사업보고서의 매출액·영업이익·당기순이익을 큰 숫자로,
 * 한 해 전 사업보고서 대비 증감을 중립색 ▲▼·부호로 보인다. 숫자마다 근거(계정·기간·접수번호)를, 줄 아래에 근거 보고서 원문 링크를 둔다.
 * 불러오는 동안에는 같은 높이의 카드 모양 자리를 두어 아래 영역이 밀리지 않는다.
 */
export function OverviewMetricsRow({ corpCode }: { corpCode: string }) {
  const titleId = useId()
  const { state, reload } = useOverviewMetrics(corpCode)

  return (
    <Panel className="overview-metrics" aria-labelledby={titleId}>
      <PanelTitle id={titleId} className="overview-metrics__title">
        최근 사업보고서 주요 수치
      </PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton
            label="최근 사업보고서 주요 수치를 불러오는 중이에요…"
            shape="card"
            count={3}
            className="overview-metrics__skeleton"
          />
        ))
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success' }, ({ data }) => <MetricsBody metrics={data} />)
        .exhaustive()}
    </Panel>
  )
}

function MetricsBody({ metrics }: { metrics: OverviewMetrics | null }) {
  if (metrics === null || !hasMetricValues(metrics)) {
    return <p className="panel__note">사업보고서의 주요계정 값이 없어 주요 수치를 보여 드릴 수 없어요. 아래 재무 흐름에서 다른 보고서를 볼 수 있어요.</p>
  }
  const { latest, previous, fsDiv } = metrics
  return (
    <>
      <p className="panel__note">
        {latest.reportName} · {fsDivLabel(fsDiv)} 기준 · 손익은 {annualPeriodLabel(latest)} 1년이에요.
        {previous === null ? ' 한 해 전 사업보고서가 없어 증감은 보여 드리지 않아요.' : ` 증감은 한 해 전 ${previous.reportName} 값과 비교했어요.`}
      </p>
      <ul className="overview-metrics__list">
        {metrics.items.map((item) => (
          <li key={item.key} className="overview-metrics__item">
            <MetricStat item={item} metrics={metrics} />
          </li>
        ))}
      </ul>
      <DartSourceLine
        reports={[
          { role: '현재', report: latest },
          ...(previous === null ? [] : [{ role: '전기', report: previous }]),
        ]}
      />
    </>
  )
}

function MetricStat({ item, metrics }: { item: MetricItem; metrics: OverviewMetrics }) {
  const source = metrics.latest.sourceRceptNo ?? metrics.latest.rceptNo
  return (
    <StatNumber
      label={item.name}
      value={item.amount}
      format={(value) => formatMetricAmount(value, item.currency)}
      unit={metricUnit(item.currency)}
      change={metricChange(item)}
      changeNote={item.amount === null ? null : item.reason}
      source={
        <>
          근거: {item.name} · {annualPeriodLabel(metrics.latest)} · 접수번호 <code>{source}</code>
          {source !== metrics.latest.rceptNo && ' (정정 공시 값)'}
        </>
      }
    />
  )
}
