import { useEffect, useState } from 'react'
import type { Analysis } from '../../api/analyses'
import type { SjDiv } from '../../api/results'
import { getSummary, type Summary, type SummaryEvidence, type SummaryItem, type SummaryTarget } from '../../api/summary'
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView'
import type { SourceTarget } from './TextEvidencePanel'
import {
  aiInfoLabel,
  explanationNote,
  kindLabel,
  SUMMARY_NOTE,
  summaryLink,
  summaryStatusNotice,
  textCoverageNote,
} from './summaryLabels'

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
      <section className="panel" aria-label="요약·설명">
        <LoadingState message="요약을 불러오는 중입니다…" />
      </section>
    )
  }
  if (state.kind === 'error') {
    return (
      <section className="panel" aria-label="요약·설명">
        <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} />
      </section>
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
    <section className="panel" aria-label="요약·설명">
      {notice && (
        <div className={`notice${data.summaryStatus === 'PARTIAL' ? ' notice--attention' : ''}`} role="status">
          {notice}
        </div>
      )}
      {coverage && <p className="panel__note">{coverage}</p>}

      {data.items.length === 0 && data.reviewNeededCount === 0 && data.summaryStatus !== null && data.summaryStatus !== 'EMPTY' && (
        <EmptyState title="요약할 변화가 없어요.">
          <p>'재무 수치 변화'와 '문장·내용 변화'에서 전체 결과를 볼 수 있어요.</p>
        </EmptyState>
      )}

      {financial.length > 0 && (
        <section className="summary-group" aria-labelledby="summary-financial">
          <h2 className="panel__title" id="summary-financial">
            주요 재무 수치 변화
          </h2>
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
          <h2 className="panel__title" id="summary-text">
            주요 문장·내용 변화
          </h2>
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
          <h2 className="panel__title" id="summary-review">
            검토 필요 {data.reviewNeededCount}건
          </h2>
          <p className="panel__note">근거를 확인하지 못해 요약에 넣지 않은 항목이에요. 원래 결과에서 직접 확인해 주세요.</p>
          <ul className="summary-review">
            {data.reviewNeeded.map((review) => {
              const openReview = opener(review.target)
              return (
                <li key={`${review.itemNo}-${review.reason ?? ''}`}>
                  <span className="badge badge--attention">{kindLabel(review.kind)}</span>
                  <span>{review.reason ?? '근거를 확인하지 못했어요.'}</span>
                  {openReview && (
                    <button type="button" className="link-button" onClick={openReview}>
                      항목 보기
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="panel__note">{SUMMARY_NOTE}</p>
    </section>
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
    <article className="summary-item">
      {item.factSentence && <p className="summary-item__fact">{item.factSentence}</p>}
      {item.aiText && (
        <div className="summary-item__ai">
          <p className="summary-item__ai-text">
            <span className="badge badge--ai">AI 생성</span> {item.aiText}
          </p>
          {item.ai && <p className="panel__note">{aiInfoLabel(item.ai)}</p>}
          <EvidenceLinks evidence={item.evidence} analysis={analysis} onOpenSource={onOpenSource} />
        </div>
      )}
      {missing && <p className={`summary-item__missing${item.explanationStatus === 'REVIEW_NEEDED' ? ' summary-item__missing--review' : ''}`}>{missing}</p>}
      {onOpen && (
        <div className="summary-item__actions">
          <button type="button" className="button button--secondary" onClick={onOpen}>
            {item.kind === 'FINANCIAL' ? '수치 근거 보기' : '변경 근거 보기'}
          </button>
        </div>
      )}
    </article>
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
              <button type="button" className="link-button" onClick={() => onOpenSource({ side, section: sectionNo, block: e.blockNo })}>
                근거: {report.reportName} 원문 위치 보기
              </button>
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
