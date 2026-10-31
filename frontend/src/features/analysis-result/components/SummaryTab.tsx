import type { CSSProperties } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'
import type { Summary, SummaryItem, SummaryLens, SummaryTarget } from '@/shared/api/summary'
import type { ChangeType } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import type { AsyncResult } from '@/shared/hooks/useAsync'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { Badge, Button, ButtonLink, Chip, Notice, Panel, PanelTitle, SegmentedControl, Skeleton } from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { useChangeOverview } from '../hooks/useChangeOverview'
import { useSummary } from '../hooks/useSummary'
import { formatRate } from '../model/format'
import { useSummaryAmounts } from '../hooks/useSummaryAmounts'
import { summarySjDivs } from '../model/summaryAmounts'
import { headlineItems } from '../model/summaryHeadline'
import { AddToNote } from './AddToNote'
import { AskEntryCard } from './AskEntryCard'
import { ChangeOverview } from './ChangeOverview'
import { PeriodDisclosures } from './PeriodDisclosures'
import { SectionChangeChart } from './SectionChangeChart'
import { SummaryExplanation } from './SummaryExplanation'
import { SummaryHeadline } from './SummaryHeadline'
import type { SourceTarget, SummaryViewChange } from '../model/resultParams'
import {
  effectiveLens,
  filterByLens,
  groupByLens,
  LENS_NOTE,
  LENS_QUESTION_LEAD,
  visibleLensCounts,
  type SummaryView,
} from '../model/summaryLens'
import {
  explanationNote,
  kindLabel,
  SUMMARY_NOTE,
  summaryItemQuestion,
  summaryLink,
  summaryNoteLabel,
  summaryNoteTarget,
  summaryQuoteLink,
  summaryStatusNotice,
  textCoverageNote,
} from '../model/summaryLabels'

interface SummaryTabProps {
  analysis: Analysis
  /** 재무 수치 탭에서 그 계정의 근거를 연다 */
  onOpenFinancial: (sjDiv: SjDiv, changeId: number) => void
  /** 문장 변화 탭에서 그 변경의 근거를 연다 */
  onOpenText: (changeId: number) => void
  onOpenSource: (target: SourceTarget) => void
}

interface LensControls {
  /** 고른 투자자 관점(FS-64, 주소 slens). null이면 전체 */
  lens: SummaryLens | null
  /** 관점별(기본) 또는 목록 보기(주소 sview) */
  view: SummaryView
  onChangeLens: (change: SummaryViewChange) => void
}

interface AskEntry {
  /** AI 질문 진입 카드의 예시 질문 */
  suggestions: LoadState<string[]>
  /** AI 질문 탭으로 가서 바로 묻는다 */
  onAsk: (question: string) => void
  onOpenAsk: () => void
  /** 다른 질문을 보내는 중 */
  asking: boolean
}

interface OverviewLinks {
  /** 변화 개요의 '바뀐 계정': 재무 수치 탭을 변경 항목만으로 연다 */
  onOpenChangedAccounts: (sjDiv: SjDiv | null) => void
  /** 변화 개요의 '문장 변경'·'검토 필요': 문장 변화 탭을 그 유형으로 연다 */
  onOpenTextList: (type: ChangeType | null) => void
  /** 섹션별 문장 변경 막대: 문장 변화 탭을 그 최상위 섹션으로 거른다 */
  onOpenTextSection: (section: string) => void
}

/**
 * W-03 ① 요약·설명(3.2). 왼쪽에 핵심 3줄(FS-21)과 그 아래 변화 개요 한 줄(FS-4 R6), AI 질문 입력(3.10), 관점별 요약을,
 * 오른쪽에 변경이 많은 섹션과 이 기간 수시공시를 둔다(#560 시안). 수치 문장은 코드가 계산한 값이고, AI가 쓴 문장은 'AI 생성'으로 따로 표시해 사실과 구분한다.
 * 공시에 설명이 없으면 '확인된 설명 없음', 근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 센다.
 */
export function SummaryTab({
  analysis,
  onOpenFinancial,
  onOpenText,
  onOpenSource,
  onOpenChangedAccounts,
  onOpenTextList,
  onOpenTextSection,
  suggestions,
  onAsk,
  onOpenAsk,
  asking,
  lens,
  view,
  onChangeLens,
}: SummaryTabProps & OverviewLinks & AskEntry & LensControls) {
  // 핵심 3줄(FS-21)과 요약 본문이 같은 요약 응답을 쓴다(한 번만 불러온다)
  const summary = useSummary(analysis.analysisId)
  // 개요 한 줄과 오른쪽 섹션 막대가 같은 응답을 쓴다(한 번만 불러온다)
  const overview = useChangeOverview(analysis.analysisId)
  // 열 수 없는 항목(결과에서 찾지 못함)은 버튼을 그리지 않는다
  const opener = (target: SummaryTarget): (() => void) | null => {
    const link = summaryLink(target)
    if (link === null) return null
    return link.tab === 'financial' ? () => onOpenFinancial(link.sjDiv, link.changeId) : () => onOpenText(link.changeId)
  }

  return (
    <div className="summary-layout">
      <div className="summary-layout__main">
      <SummaryHeadline
        lines={summary.state.status === 'success' ? headlineItems(summary.state.data) : []}
        opener={opener}
        footer={
          <ChangeOverview
            financial={overview.financial}
            text={overview.text}
            onOpenChangedAccounts={onOpenChangedAccounts}
            onOpenTextList={onOpenTextList}
          />
        }
      />
      <AskEntryCard suggestions={suggestions} onAsk={onAsk} onOpenAsk={onOpenAsk} sending={asking} />
      <SummaryContent
        summary={summary}
        analysis={analysis}
        opener={opener}
        onOpenSource={onOpenSource}
        onAsk={onAsk}
        asking={asking}
        lens={lens}
        view={view}
        onChangeLens={onChangeLens}
      />
      </div>
      <aside className="summary-layout__aside" aria-label="요약 곁 정보">
        <SectionChangeChart
          state={overview.text.state}
          onOpenSection={onOpenTextSection}
          onOpenAll={() => onOpenTextList(null)}
        />
        <PeriodDisclosures analysis={analysis} />
      </aside>
    </div>
  )
}

interface SummaryContentProps extends LensControls {
  summary: AsyncResult<LoadState<Summary>>
  analysis: Analysis
  opener: (target: SummaryTarget) => (() => void) | null
  onOpenSource: (target: SourceTarget) => void
  onAsk: (question: string) => void
  asking: boolean
}

/** 요약 본문. 변화 개요를 못 불러와도 따로 불러와 그대로 보인다 */
function SummaryContent({ summary, ...rest }: SummaryContentProps) {
  const { state, reload } = summary

  return match(state)
    .with({ status: 'loading' }, () => (
      <Panel aria-label="요약">
        <Skeleton label="요약을 불러오는 중입니다…" shape="line" count={4} />
      </Panel>
    ))
    .with({ status: 'error' }, ({ error }) => (
      <Panel aria-label="요약">
        <ErrorState error={error} onRetry={reload} />
      </Panel>
    ))
    .with({ status: 'success' }, ({ data }) => <SummaryBody data={data} {...rest} />)
    .exhaustive()
}

function SummaryBody({
  data,
  analysis,
  opener,
  onOpenSource,
  onAsk,
  asking,
  lens: requestedLens,
  view,
  onChangeLens,
}: Omit<SummaryContentProps, 'summary'> & { data: Summary }) {
  const notice = summaryStatusNotice(data.summaryStatus, data.summaryMessage)
  const coverage = data.summaryStatus === null ? null : textCoverageNote(data.textStatus)
  // 주소에 남은 관점이 이 요약에 없으면 전체로 본다
  const lens = effectiveLens(requestedLens, data.lensCounts)
  const items = filterByLens(data.items, lens)
  const reviewNeeded = filterByLens(data.reviewNeeded, lens)
  const financial = items.filter((i) => i.kind === 'FINANCIAL')
  const amountsState = useSummaryAmounts(analysis.analysisId, summarySjDivs(data.items)).state
  // 금액을 못 불러오면 비교 막대만 빠진다(사실 문장은 그대로)
  const amounts = amountsState.status === 'success' ? amountsState.data : null
  const text = items.filter((i) => i.kind === 'TEXT')
  const card = (item: SummaryItem) => (
    <SummaryCard
      item={item}
      analysis={analysis}
      amount={item.kind !== 'FINANCIAL' || item.target.changeId === null ? undefined : amounts?.get(item.target.changeId)}
      onOpen={opener(item.target)}
      onOpenSource={onOpenSource}
      onAsk={onAsk}
      asking={asking}
    />
  )

  return (
    <Panel className="summary-panel" aria-labelledby="summary-panel-title">
      {/* 주요 변화 요약(#550, 시안 09): 제목 | 주된 근거 배지 */}
      <div className="summary-panel__head">
        <PanelTitle id="summary-panel-title">주요 변화 요약</PanelTitle>
        <Badge>정기보고서 · 주된 근거</Badge>
      </div>
      {notice && (
        <Notice tone={data.summaryStatus === 'PARTIAL' ? 'attention' : 'info'} role="status">
          {notice}
        </Notice>
      )}
      {coverage && <p className="panel__note">{coverage}</p>}

      {data.items.length === 0 && data.reviewNeededCount === 0 && data.summaryStatus !== null && data.summaryStatus !== 'EMPTY' && (
        <EmptyState title="요약할 변화가 없어요.">
          <p>'재무 수치'와 '문장 변화' 탭에서 전체 결과를 볼 수 있어요.</p>
        </EmptyState>
      )}

      {data.items.length > 0 && (
        <LensFilter data={data} lens={lens} view={view} onChangeLens={onChangeLens} />
      )}

      {match(view)
        .with('lens', () => (
          <div className="summary-lenses">
            {groupByLens(items).map((group) => (
              <section key={group.lens} className="summary-group summary-lens" aria-labelledby={`summary-lens-${group.lens}`}>
                <div className="summary-lens__head">
                  <PanelTitle id={`summary-lens-${group.lens}`}>
                    {group.label} {group.items.length}건
                  </PanelTitle>
                  {group.question && (
                    <p className="summary-lens__question">
                      <span className="summary-lens__lead">{LENS_QUESTION_LEAD}</span> {group.question}
                    </p>
                  )}
                </div>
                <ol className="summary-list">
                  {group.items.map((item) => (
                    <li key={item.itemNo}>{card(item)}</li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ))
        .with('list', () => (
          /* 넓으면 재무·문장 두 묶음을 양옆에 두고, 같은 순번 항목끼리 높이를 맞춘다(#390) */
          <div
            className="summary-columns"
            style={{ '--summary-rows': Math.max(financial.length, text.length) } as CSSProperties}
          >
            {financial.length > 0 && (
              <section className="summary-group" aria-labelledby="summary-financial">
                <PanelTitle id="summary-financial">주요 재무 수치 변화</PanelTitle>
                <ol className="summary-list">
                  {financial.map((item) => (
                    <li key={item.itemNo}>{card(item)}</li>
                  ))}
                </ol>
              </section>
            )}

            {text.length > 0 && (
              <section className="summary-group" aria-labelledby="summary-text">
                <PanelTitle id="summary-text">주요 문장·내용 변화</PanelTitle>
                <ol className="summary-list">
                  {text.map((item) => (
                    <li key={item.itemNo}>{card(item)}</li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        ))
        .exhaustive()}

      {reviewNeeded.length > 0 && (
        <section className="summary-group summary-group--review" aria-labelledby="summary-review">
          <PanelTitle id="summary-review">검토 필요 {reviewNeeded.length}건</PanelTitle>
          <p className="panel__note">
            근거를 확인하지 못했거나 투자 권유로 읽힐 수 있는 표현이 있어 요약에 넣지 않은 항목이에요. 원래 결과에서 직접 확인해 주세요.
          </p>
          <ul className="summary-review">
            {reviewNeeded.map((review) => {
              const openReview = opener(review.target)
              return (
                <li key={`${review.itemNo}-${review.reason ?? ''}`}>
                  <Badge tone="attention">{kindLabel(review.kind)}</Badge>
                  <Badge>{review.lensLabel}</Badge>
                  {review.blockedRules.length > 0 && <Badge tone="attention">표현 검사</Badge>}
                  <span>{review.reason ?? '근거를 확인하지 못했어요.'}</span>
                  {openReview && (
                    <Button variant="link" onClick={openReview}>
                      항목 보기
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <DartSourceLine
        reports={[
          { role: '비교', report: analysis.previous },
          { role: '현재', report: analysis.current },
        ]}
      />
      <p className="panel__note">{SUMMARY_NOTE}</p>
    </Panel>
  )
}

const viewOptions = [
  { value: 'lens', label: '관점별로 보기' },
  { value: 'list', label: '목록으로 보기' },
] as const

/** 요약 위 투자자 관점 거르기(FS-64). 0건 관점은 그리지 않는다. 고른 관점과 보기는 주소에 남는다 */
function LensFilter({ data, lens, view, onChangeLens }: { data: Summary } & LensControls) {
  return (
    <div className="summary-lens-controls">
      <div className="summary-lens-controls__chips" role="group" aria-label="투자자 관점">
        <Chip pressed={lens === null} count={data.items.length} onClick={() => lens !== null && onChangeLens({ lens: null })}>
          전체
        </Chip>
        {visibleLensCounts(data.lensCounts).map((c) => (
          <Chip key={c.lens} pressed={lens === c.lens} count={c.count} onClick={() => lens !== c.lens && onChangeLens({ lens: c.lens })}>
            {c.lensLabel}
          </Chip>
        ))}
      </div>
      <SegmentedControl
        aria-label="요약 보기"
        options={viewOptions}
        value={view}
        onChange={(next) => {
          if (next !== view) onChangeLens({ view: next })
        }}
      />
      <p className="panel__note">{LENS_NOTE}</p>
    </div>
  )
}

interface SummaryCardProps {
  item: SummaryItem
  analysis: Analysis
  /** 재무 항목의 이전·현재 금액(비교 막대). 못 찾으면 undefined */
  amount?: FinancialChangeItem
  /** 결과 화면에서 이 항목을 연다. 열 수 없으면 null(버튼을 그리지 않음) */
  onOpen: (() => void) | null
  onOpenSource: (target: SourceTarget) => void
  onAsk: (question: string) => void
  asking: boolean
}

function SummaryCard({ item, analysis, amount, onOpen, onOpenSource, onAsk, asking }: SummaryCardProps) {
  const noteTarget = summaryNoteTarget(item.target)
  const noteLabel = summaryNoteLabel(item, amount)
  const quoteLink = summaryQuoteLink(analysis.corpCode, analysis.analysisId, item.target)
  const question = summaryItemQuestion(item, amount)
  // 줄 오른쪽에는 '확인된 설명 없음'처럼 앞말만 두고, 자세한 이유는 '더 보기' 안에 둔다(#560)
  const missing = item.kind === 'FINANCIAL' ? explanationNote(item.explanationStatus, item.gradeReason)?.split(' · ')[0] : null
  const lead = item.factSentence ?? item.aiText

  return (
    <article className="summary-item">
      {/* 한 줄: 사실 문장(문장 변화는 AI 문장) | 설명 상태 · 근거 버튼(#560 시안) */}
      <div className="summary-item__top">
        <p className="summary-item__fact">
          {item.factSentence === null && item.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {lead}
        </p>
        {missing && <span className="summary-item__status">{missing}</span>}
        {onOpen && (
          <Button variant="link" className="summary-item__open" onClick={onOpen}>
            {item.kind === 'FINANCIAL' ? '수치 근거' : '변경 근거'}
          </Button>
        )}
      </div>
      {item.factSentence !== null && item.aiText && (
        <p className="summary-item__ai-text">
          {item.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {item.aiText}
        </p>
      )}
      <details className="summary-item__more">
        <summary>더 보기</summary>
        {amount && <SummaryAmounts amount={amount} />}
        <SummaryExplanation item={item} analysis={analysis} onOpenSource={onOpenSource} showText={false} />
        {(quoteLink !== null || question !== null || noteTarget !== null) && (
          <div className="summary-item__actions">
            {quoteLink !== null && (
              <ButtonLink variant="secondary" to={quoteLink} aria-label={`커뮤니티에 인용: ${noteLabel}`}>
                커뮤니티에 인용
              </ButtonLink>
            )}
            {question !== null && (
              <Button
                variant="secondary"
                disabled={asking}
                aria-label={`AI에 질문: ${question}`}
                onClick={() => onAsk(question)}
              >
                AI에 질문
              </Button>
            )}
            {noteTarget !== null && <AddToNote target={noteTarget} analysisId={analysis.analysisId} label={noteLabel} />}
          </div>
        )}
      </details>
    </article>
  )
}

/**
 * 재무 항목의 이전 → 현재 큰 숫자와 증감 배지(#550). 증감은 중립색 배지에 ▲▼·부호로 보이고(좋고 나쁨 색 없음),
 * 증감률을 계산하지 않았으면 배지를 두지 않는다. 숫자는 서버가 준 금액 그대로다.
 */
const ARROWS: Record<'UP' | 'DOWN' | 'SAME', string | null> = { UP: '▲', DOWN: '▼', SAME: null }

function SummaryAmounts({ amount }: { amount: FinancialChangeItem }) {
  const rate = formatRate(amount.changeRate)
  const arrow = amount.direction === null ? null : ARROWS[amount.direction]
  return (
    <p className="summary-item__amounts">
      <span className="visually-hidden">이전 </span>
      <span className="summary-item__previous">{compactAmount(amount.previousAmount, amount.currency)}</span>
      <span className="summary-item__arrow" aria-hidden="true">
        →
      </span>
      <span className="visually-hidden">현재 </span>
      <span className="summary-item__current">{compactAmount(amount.currentAmount, amount.currency)}</span>
      {rate !== null && (
        <Badge>
          {arrow !== null && <span aria-hidden="true">{arrow} </span>}
          <span className="visually-hidden">증감률 </span>
          {rate}
        </Badge>
      )}
    </p>
  )
}

/** 비교 막대 옆 짧은 금액(예: 153.7조 원). 없으면 '없음' */
function compactAmount(value: number | null, currency: string | null): string {
  if (value === null) return '없음'
  return currency === null || currency === 'KRW' ? `${formatCompactAmount(value, 'KRW')} 원` : formatCompactAmount(value, currency)
}
