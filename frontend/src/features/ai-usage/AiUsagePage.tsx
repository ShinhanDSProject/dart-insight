import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { AiUsage } from '@/shared/api/system'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Card, DataTable, Page, PageHeader, Panel, PanelTitle, SegmentedControl, ShareBar, type ShareSegment } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { ModelUsagePanel } from './components/ModelUsagePanel'
import { useAiUsage, useRealOnly, useUsageDays } from './hooks/useAiUsage'
import {
  DAYS_OPTIONS,
  explanationSegments,
  formatCount,
  formatRate,
  formatTokens,
  otherOutcomes,
  outcomeSegments,
  parseDays,
  periodText,
  questionSegments,
  reasonRows,
  taskLabel,
  usageView,
} from './model/aiUsage'
import './ai-usage.css'

/**
 * AI 사용 현황(FS-15). 최근 7일·30일의 질문 상태, 답 평가, 문장 풀이 상태, LLM 호출 수·토큰을 집계로만 보인다.
 * 질문 본문·답·사용자 정보는 API에도 화면에도 없다(AC4). 제공자·모델별 비용과 1건당 평균은 FS-50.
 */
export function AiUsagePage() {
  useDocumentTitle(pageTitle(['AI 사용 현황']))
  const { days, setDays } = useUsageDays()
  const { state, reload } = useAiUsage(days)
  const { realOnly, setRealOnly } = useRealOnly()

  return (
    <Page width="wide" className="ai-usage">
      <PageHeader
        breadcrumb={
          <>
            <Link to="/">기업 검색</Link> / AI 사용 현황
          </>
        }
        title="AI 사용 현황"
        lead="AI 질문·답 평가·문장 풀이·LLM 호출을 기간별로 집계해요. 질문 내용과 사용자 정보는 보이지 않아요."
        aside={
          <>
            {match(state)
              .with({ status: 'success' }, ({ data }) => (
                <p className="ai-usage__period">
                  최근 {data.days}일 ({periodText(data.from, data.to)})
                </p>
              ))
              .otherwise(() => null)}
            <SegmentedControl
              aria-label="집계 기간"
              options={DAYS_OPTIONS}
              value={`${days}`}
              onChange={(value) => setDays(parseDays(value))}
            />
          </>
        }
      />

      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="AI 사용 현황을 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) =>
          match(usageView(data))
            .with({ kind: 'empty' }, () => (
              <EmptyState title="아직 기록이 없어요">
                <p>이 기간에 AI 질문·풀이·LLM 호출 기록이 없어요. 기간을 바꿔 보세요.</p>
              </EmptyState>
            ))
            .with({ kind: 'data' }, ({ usage }) => <UsageReport usage={usage} realOnly={realOnly} onRealOnlyChange={setRealOnly} />)
            .exhaustive(),
        )
        .exhaustive()}
    </Page>
  )
}

function UsageReport({
  usage,
  realOnly,
  onRealOnlyChange,
}: {
  usage: AiUsage
  realOnly: boolean
  onRealOnlyChange: (realOnly: boolean) => void
}) {
  const { questions, feedback, explanations, llmCalls } = usage
  const others = otherOutcomes(usage)

  return (
    <>
      <ul className="ai-usage__stats" aria-label="요약 수치">
        <Stat label="질문 수" value={formatCount(questions.total)} detail={`답한 질문 ${formatCount(questions.byStatus.ANSWERED)}개`} />
        <Stat
          label="도움됨 비율"
          value={formatRate(feedback.helpfulRate)}
          detail={`평가 ${formatCount(feedback.rated)}개 중 도움됨 ${formatCount(feedback.helpful)}개`}
        />
        <Stat label="풀이 수" value={formatCount(explanations.total)} detail={`근거 확인 ${formatCount(explanations.byStatus.OK)}개`} />
        <Stat label="LLM 호출 수" value={formatCount(llmCalls.total)} detail="다시 만든 호출도 한 번씩 세요" />
      </ul>

      <div className="ai-usage__grid">
        <Panel aria-labelledby="ai-usage-questions">
          <PanelTitle id="ai-usage-questions">질문 상태</PanelTitle>
          <Share segments={questionSegments(usage)} empty="이 기간에 한 질문이 없어요." />
        </Panel>

        <Panel aria-labelledby="ai-usage-feedback">
          <PanelTitle id="ai-usage-feedback">답 평가</PanelTitle>
          <p className="ai-usage__note">
            도움이 됐어요 {formatCount(feedback.helpful)}개 · 도움이 안 됐어요 {formatCount(feedback.notHelpful)}개
          </p>
          <h3 className="ai-usage__subtitle">도움이 안 된 사유</h3>
          <ul className="ai-usage__reasons">
            {reasonRows(usage).map((row) => (
              <li key={row.reason} className="ai-usage__reason">
                <span>{row.label}</span>
                <span className="ai-usage__num">{formatCount(row.count)}개</span>
              </li>
            ))}
          </ul>
          <p className="ai-usage__hint">사유 없이 '도움이 안 됐어요'만 고른 평가는 사유별 수에 넣지 않아요.</p>
        </Panel>

        <Panel aria-labelledby="ai-usage-explanations">
          <PanelTitle id="ai-usage-explanations">문장 풀이 상태</PanelTitle>
          <Share segments={explanationSegments(usage)} empty="이 기간에 만든 풀이가 없어요." />
        </Panel>

        <Panel aria-labelledby="ai-usage-calls">
          <PanelTitle id="ai-usage-calls">LLM 호출 결과</PanelTitle>
          <Share segments={outcomeSegments(usage)} empty="이 기간에 LLM 호출이 없어요." />
          {others.length > 0 && (
            <p className="ai-usage__hint">
              그 밖의 결과: {others.map((o) => `${o.outcome} ${formatCount(o.count)}`).join(', ')}
            </p>
          )}
        </Panel>
      </div>

      <Panel aria-labelledby="ai-usage-tasks" className="ai-usage__tasks">
        <PanelTitle id="ai-usage-tasks">작업별 호출·토큰</PanelTitle>
        {match(llmCalls.byTask.length)
          .with(0, () => <p className="ai-usage__note">이 기간에 LLM 호출이 없어요.</p>)
          .otherwise(() => (
            <DataTable caption="작업별 LLM 호출 수와 입력·출력 토큰 합" density="dense">
              <thead>
                <tr>
                  <th scope="col">작업</th>
                  <th scope="col" className="num">호출 수</th>
                  <th scope="col" className="num">입력 토큰</th>
                  <th scope="col" className="num">출력 토큰</th>
                </tr>
              </thead>
              <tbody>
                {llmCalls.byTask.map((task) => (
                  <tr key={task.task}>
                    <th scope="row">{taskLabel(task.task)}</th>
                    <td className="num">{formatCount(task.calls)}</td>
                    <td className="num">{formatTokens(task.inputTokens)}</td>
                    <td className="num">{formatTokens(task.outputTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ))}
        <p className="ai-usage__hint">토큰은 제공자가 알려 준 호출만 더해요. 모두 모르면 '알 수 없음'이에요.</p>
      </Panel>

      <ModelUsagePanel usage={usage} realOnly={realOnly} onRealOnlyChange={onRealOnlyChange} />
    </>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: ReactNode }) {
  return (
    <li>
      <Card className="ai-usage__stat">
        <span className="ai-usage__stat-label">{label}</span>
        <span className="ai-usage__stat-value">{value}</span>
        <span className="ai-usage__stat-detail">{detail}</span>
      </Card>
    </li>
  )
}

/** 비율 막대. 모두 0이면 막대 대신 글자로 알린다(0을 비율로 나누지 않음) */
function Share({ segments, empty }: { segments: ShareSegment[]; empty: string }) {
  return match(segments.every((s) => s.value === 0))
    .with(true, () => <p className="ai-usage__note">{empty}</p>)
    .with(false, () => <ShareBar segments={segments} />)
    .exhaustive()
}
