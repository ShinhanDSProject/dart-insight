import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'
import type { Summary, SummaryEvidence, SummaryItem, SummaryTarget } from '@/shared/api/summary'
import type { ChangeType } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import type { AsyncResult } from '@/shared/hooks/useAsync'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { Badge, Button, Card, CompareBars, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useSummary } from '../hooks/useSummary'
import { useSummaryAmounts } from '../hooks/useSummaryAmounts'
import { summarySjDivs } from '../model/summaryAmounts'
import { headlineItems } from '../model/summaryHeadline'
import { AskEntryCard } from './AskEntryCard'
import { ChangeOverview } from './ChangeOverview'
import { SummaryHeadline } from './SummaryHeadline'
import type { SourceTarget } from '../model/resultParams'
import {
  aiInfoLabel,
  explanationNote,
  kindLabel,
  SUMMARY_NOTE,
  summaryLink,
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
 * W-03 ① 요약·설명(3.2). 맨 위에 핵심 3줄(FS-21), 변화 개요(FS-4 R6)와 AI 질문 진입 카드(3.10)를 둔다. 수치 문장은 코드가 계산한 값이고, AI가 쓴 문장은 'AI 생성'으로 따로 표시해 사실과 구분한다.
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
}: SummaryTabProps & OverviewLinks & AskEntry) {
  // 핵심 3줄(FS-21)과 요약 본문이 같은 요약 응답을 쓴다(한 번만 불러온다)
  const summary = useSummary(analysis.analysisId)
  // 열 수 없는 항목(결과에서 찾지 못함)은 버튼을 그리지 않는다
  const opener = (target: SummaryTarget): (() => void) | null => {
    const link = summaryLink(target)
    if (link === null) return null
    return link.tab === 'financial' ? () => onOpenFinancial(link.sjDiv, link.changeId) : () => onOpenText(link.changeId)
  }

  return (
    <>
      {summary.state.status === 'success' && <SummaryHeadline lines={headlineItems(summary.state.data)} opener={opener} />}
      <ChangeOverview
        analysisId={analysis.analysisId}
        onOpenChangedAccounts={onOpenChangedAccounts}
        onOpenTextList={onOpenTextList}
        onOpenTextSection={onOpenTextSection}
      />
      <AskEntryCard suggestions={suggestions} onAsk={onAsk} onOpenAsk={onOpenAsk} sending={asking} />
      <SummaryContent summary={summary} analysis={analysis} opener={opener} onOpenSource={onOpenSource} />
    </>
  )
}

interface SummaryContentProps {
  summary: AsyncResult<LoadState<Summary>>
  analysis: Analysis
  opener: (target: SummaryTarget) => (() => void) | null
  onOpenSource: (target: SourceTarget) => void
}

/** 요약 본문. 변화 개요를 못 불러와도 따로 불러와 그대로 보인다 */
function SummaryContent({ summary, analysis, opener, onOpenSource }: SummaryContentProps) {
  const { state, reload } = summary

  return match(state)
    .with({ status: 'loading' }, () => (
      <Panel aria-label="요약·설명">
        <LoadingState message="요약을 불러오는 중입니다…" />
      </Panel>
    ))
    .with({ status: 'error' }, ({ error }) => (
      <Panel aria-label="요약·설명">
        <ErrorState error={error} onRetry={reload} />
      </Panel>
    ))
    .with({ status: 'success' }, ({ data }) => <SummaryBody data={data} analysis={analysis} opener={opener} onOpenSource={onOpenSource} />)
    .exhaustive()
}

function SummaryBody({ data, analysis, opener, onOpenSource }: Omit<SummaryContentProps, 'summary'> & { data: Summary }) {
  const notice = summaryStatusNotice(data.summaryStatus, data.summaryMessage)
  const coverage = data.summaryStatus === null ? null : textCoverageNote(data.textStatus)
  const financial = data.items.filter((i) => i.kind === 'FINANCIAL')
  const amountsState = useSummaryAmounts(analysis.analysisId, summarySjDivs(data.items)).state
  // 금액을 못 불러오면 비교 막대만 빠진다(사실 문장은 그대로)
  const amounts = amountsState.status === 'success' ? amountsState.data : null
  const text = data.items.filter((i) => i.kind === 'TEXT')

  return (
    <Panel aria-label="요약·설명">
      {notice && (
        <Notice tone={data.summaryStatus === 'PARTIAL' ? 'attention' : 'info'} role="status">
          {notice}
        </Notice>
      )}
      {coverage && <p className="panel__note">{coverage}</p>}

      {data.items.length === 0 && data.reviewNeededCount === 0 && data.summaryStatus !== null && data.summaryStatus !== 'EMPTY' && (
        <EmptyState title="요약할 변화가 없어요.">
          <p>'재무 수치 변화'와 '문장·내용 변화'에서 전체 결과를 볼 수 있어요.</p>
        </EmptyState>
      )}

      {financial.length > 0 && (
        <section className="summary-group" aria-labelledby="summary-financial">
          <PanelTitle id="summary-financial">주요 재무 수치 변화</PanelTitle>
          <ol className="summary-list">
            {financial.map((item) => (
              <li key={item.itemNo}>
                <SummaryCard
                  item={item}
                  analysis={analysis}
                  amount={item.target.changeId === null ? undefined : amounts?.get(item.target.changeId)}
                  onOpen={opener(item.target)}
                  onOpenSource={onOpenSource}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {text.length > 0 && (
        <section className="summary-group" aria-labelledby="summary-text">
          <PanelTitle id="summary-text">주요 문장·내용 변화</PanelTitle>
          <ol className="summary-list">
            {text.map((item) => (
              <li key={item.itemNo}>
                <SummaryCard item={item} analysis={analysis} onOpen={opener(item.target)} onOpenSource={onOpenSource} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {data.reviewNeededCount > 0 && (
        <section className="summary-group summary-group--review" aria-labelledby="summary-review">
          <PanelTitle id="summary-review">검토 필요 {data.reviewNeededCount}건</PanelTitle>
          <p className="panel__note">
            근거를 확인하지 못했거나 투자 권유로 읽힐 수 있는 표현이 있어 요약에 넣지 않은 항목이에요. 원래 결과에서 직접 확인해 주세요.
          </p>
          <ul className="summary-review">
            {data.reviewNeeded.map((review) => {
              const openReview = opener(review.target)
              return (
                <li key={`${review.itemNo}-${review.reason ?? ''}`}>
                  <Badge tone="attention">{kindLabel(review.kind)}</Badge>
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

interface SummaryCardProps {
  item: SummaryItem
  analysis: Analysis
  /** 재무 항목의 이전·현재 금액(비교 막대). 못 찾으면 undefined */
  amount?: FinancialChangeItem
  /** 결과 화면에서 이 항목을 연다. 열 수 없으면 null(버튼을 그리지 않음) */
  onOpen: (() => void) | null
  onOpenSource: (target: SourceTarget) => void
}

function SummaryCard({ item, analysis, amount, onOpen, onOpenSource }: SummaryCardProps) {
  const missing = item.kind === 'FINANCIAL' ? explanationNote(item.explanationStatus) : null
  return (
    <Card as="article" className="summary-item">
      {item.factSentence && <p className="summary-item__fact">{item.factSentence}</p>}
      {amount && (
        <CompareBars
          className="summary-item__compare"
          previous={{ label: '이전', value: amount.previousAmount, text: compactAmount(amount.previousAmount, amount.currency) }}
          current={{ label: '현재', value: amount.currentAmount, text: compactAmount(amount.currentAmount, amount.currency) }}
        />
      )}
      {item.aiText && (
        <div className="summary-item__ai">
          <p className="summary-item__ai-text">
            {item.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {item.aiText}
          </p>
          {item.ai && (
            <details className="summary-item__meta">
              <summary>생성 정보</summary>
              {aiInfoLabel(item.ai)}
            </details>
          )}
          <EvidenceLinks evidence={item.evidence} analysis={analysis} onOpenSource={onOpenSource} />
        </div>
      )}
      {missing && <p className={`summary-item__missing${item.explanationStatus === 'REVIEW_NEEDED' ? ' summary-item__missing--review' : ''}`}>{missing}</p>}
      {onOpen && (
        <div className="summary-item__actions">
          <Button variant="secondary" onClick={onOpen}>
            {item.kind === 'FINANCIAL' ? '수치 근거 보기' : '변경 근거 보기'}
          </Button>
        </div>
      )}
    </Card>
  )
}

interface EvidenceLinksProps {
  evidence: SummaryEvidence[]
  analysis: Analysis
  onOpenSource: (target: SourceTarget) => void
}

/** AI 문장의 근거 위치. 분석의 보고서 원문 안 위치만 연다 */
function EvidenceLinks({ evidence, analysis, onOpenSource }: EvidenceLinksProps) {
  if (evidence.length === 0) return null
  return (
    <ul className="summary-item__evidence" aria-label="근거 원문">
      {evidence.map((e) => {
        const report = match(e.side)
          .with('current', () => analysis.current)
          .with('previous', () => analysis.previous)
          // 분석의 보고서가 아니면(null) 열지 않는다
          .otherwise(() => null)
        const side = e.side
        const sectionNo = e.sectionNo
        return (
          <li key={e.evidenceId}>
            {side && report && sectionNo !== null ? (
              <>
                <Button variant="link" onClick={() => onOpenSource({ side, section: sectionNo, block: e.blockNo })}>
                  근거: {report.reportName} 원문 위치 보기
                </Button>
                <span className="panel__note">
                  {' '}
                  · 출처: DART <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
                </span>
              </>
            ) : (
              <span className="panel__note">
                근거 <code>{e.evidenceId}</code> · 원문 위치를 찾지 못했어요
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** 비교 막대 옆 짧은 금액(예: 153.7조 원). 없으면 '없음' */
function compactAmount(value: number | null, currency: string | null): string {
  if (value === null) return '없음'
  return currency === null || currency === 'KRW' ? `${formatCompactAmount(value, 'KRW')} 원` : formatCompactAmount(value, currency)
}
