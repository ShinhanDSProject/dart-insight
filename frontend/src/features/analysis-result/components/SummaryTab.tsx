import { useEffect, useState } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import type { SjDiv } from '@/shared/api/results'
import { getSummary, type Summary, type SummaryEvidence, type SummaryItem, type SummaryTarget } from '@/shared/api/summary'
import { Badge, Button, Card, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import type { SourceTarget } from './TextEvidencePanel'
import {
  aiInfoLabel,
  explanationNote,
  kindLabel,
  SUMMARY_NOTE,
  summaryLink,
  summaryStatusNotice,
  textCoverageNote,
} from '../model/summaryLabels'

type Load = { kind: 'loading' } | { kind: 'done'; data: Summary } | { kind: 'error'; error: unknown }

interface SummaryTabProps {
  analysis: Analysis
  /** 재무 수치 탭에서 그 계정의 근거를 연다 */
  onOpenFinancial: (sjDiv: SjDiv, changeId: number) => void
  /** 문장 변화 탭에서 그 변경의 근거를 연다 */
  onOpenText: (changeId: number) => void
  onOpenSource: (target: SourceTarget) => void
}

/**
 * W-03 ① 요약·설명(3.2). 수치 문장은 코드가 계산한 값이고, AI가 쓴 문장은 'AI 생성'으로 따로 표시해 사실과 구분한다.
 * 공시에 설명이 없으면 '확인된 설명 없음', 근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 센다.
 */
export function SummaryTab({ analysis, onOpenFinancial, onOpenText, onOpenSource }: SummaryTabProps) {
  const [state, setState] = useState<Load>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getSummary(analysis.analysisId)
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, retry])

  if (state.kind === 'loading') {
    return (
      <Panel aria-label="요약·설명">
        <LoadingState message="요약을 불러오는 중입니다…" />
      </Panel>
    )
  }
  if (state.kind === 'error') {
    return (
      <Panel aria-label="요약·설명">
        <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} />
      </Panel>
    )
  }

  const { data } = state
  const notice = summaryStatusNotice(data.summaryStatus, data.summaryMessage)
  const coverage = data.summaryStatus === null ? null : textCoverageNote(data.textStatus)
  const financial = data.items.filter((i) => i.kind === 'FINANCIAL')
  const text = data.items.filter((i) => i.kind === 'TEXT')
  // 열 수 없는 항목(결과에서 찾지 못함)은 버튼을 그리지 않는다
  const opener = (target: SummaryTarget): (() => void) | null => {
    const link = summaryLink(target)
    if (link === null) return null
    return link.tab === 'financial' ? () => onOpenFinancial(link.sjDiv, link.changeId) : () => onOpenText(link.changeId)
  }

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
                <SummaryCard item={item} analysis={analysis} onOpen={opener(item.target)} onOpenSource={onOpenSource} />
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
  /** 결과 화면에서 이 항목을 연다. 열 수 없으면 null(버튼을 그리지 않음) */
  onOpen: (() => void) | null
  onOpenSource: (target: SourceTarget) => void
}

function SummaryCard({ item, analysis, onOpen, onOpenSource }: SummaryCardProps) {
  const missing = item.kind === 'FINANCIAL' ? explanationNote(item.explanationStatus) : null
  return (
    <Card as="article" className="summary-item">
      {item.factSentence && <p className="summary-item__fact">{item.factSentence}</p>}
      {item.aiText && (
        <div className="summary-item__ai">
          <p className="summary-item__ai-text">
            {item.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {item.aiText}
          </p>
          {item.ai && <p className="panel__note">{aiInfoLabel(item.ai)}</p>}
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
        const report = e.side === 'current' ? analysis.current : e.side === 'previous' ? analysis.previous : null
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
