import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { SummaryEvidence, SummaryItem } from '@/shared/api/summary'
import { Badge, Button } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import type { SourceTarget } from '../model/resultParams'
import { aiInfoLabel, explanationNote, gradeLabel, gradeNote, QUOTE_CAPTION, TEMPLATE_CAPTION, TEMPLATE_NO_QUOTE } from '../model/summaryLabels'

interface SummaryExplanationProps {
  item: SummaryItem
  analysis: Analysis
  onOpenSource: (target: SourceTarget) => void
}

/**
 * 요약 한 줄의 AI 문장과 근거. 재무 수치는 설명 등급(ADR-0015, #143)에 따라 '회사가 밝힌 설명'과 '관련 공시 내용'을 나누고,
 * 등급의 근거인 인용문과 그 원문 위치를 함께 보인다. 설명이 없거나 검토 필요면 그 안내만 보인다.
 * 검증에 실패한 설명(TEMPLATE, #149)은 AI 문장 없이 코드가 확인한 인용만 '회사 설명'으로 보인다('AI 생성' 아님).
 */
export function SummaryExplanation({ item, analysis, onOpenSource }: SummaryExplanationProps) {
  const missing = item.kind === 'FINANCIAL' ? explanationNote(item.explanationStatus, item.gradeReason) : null
  const grade = item.kind === 'FINANCIAL' ? gradeLabel(item.explanationGrade) : null
  const note = item.kind === 'FINANCIAL' ? gradeNote(item.explanationGrade) : null
  const review = item.explanationStatus === 'REVIEW_NEEDED' || item.explanationStatus === 'TEMPLATE'
  return (
    <>
      {item.aiText && (
        <div className="summary-item__ai">
          {grade && <p className="summary-item__grade">{grade}</p>}
          <p className="summary-item__ai-text">
            {item.aiGenerated && <Badge tone="accent">AI 생성</Badge>} {item.aiText}
          </p>
          {note && <p className="summary-item__grade-note">{note}</p>}
          {item.quote && <Quote item={item} caption={QUOTE_CAPTION} analysis={analysis} onOpenSource={onOpenSource} />}
          {item.ai && (
            <details className="summary-item__meta">
              <summary>생성 정보</summary>
              {aiInfoLabel(item.ai)}
            </details>
          )}
          {item.evidence.length > 0 && (
            <ul className="summary-item__evidence" aria-label="근거 원문">
              {item.evidence.map((e) => (
                <li key={e.evidenceId}>
                  <SourceLink evidence={e} analysis={analysis} label="근거" onOpenSource={onOpenSource} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {item.explanationStatus === 'TEMPLATE' &&
        (item.quote ? (
          <Quote item={item} caption={TEMPLATE_CAPTION} analysis={analysis} onOpenSource={onOpenSource} />
        ) : (
          <p className="summary-item__missing">{TEMPLATE_NO_QUOTE}</p>
        ))}
      {missing && <p className={`summary-item__missing${review ? ' summary-item__missing--review' : ''}`}>{missing}</p>}
    </>
  )
}

interface QuoteProps {
  item: SummaryItem
  caption: string
  analysis: Analysis
  onOpenSource: (target: SourceTarget) => void
}

/** 공시 원문 인용문과 그 위치 */
function Quote({ item, caption, analysis, onOpenSource }: QuoteProps) {
  return (
    <figure className="summary-item__quote">
      <figcaption>{caption}</figcaption>
      <blockquote>{item.quote}</blockquote>
      {item.quoteEvidence && (
        <SourceLink evidence={item.quoteEvidence} analysis={analysis} label="인용 위치" onOpenSource={onOpenSource} />
      )}
    </figure>
  )
}

interface SourceLinkProps {
  evidence: SummaryEvidence
  analysis: Analysis
  /** 버튼 앞말(근거, 인용 위치) */
  label: string
  onOpenSource: (target: SourceTarget) => void
}

/** 원문 위치 하나. 분석의 보고서 원문 안 위치만 원문 확인 탭에서 연다 */
function SourceLink({ evidence, analysis, label, onOpenSource }: SourceLinkProps) {
  const report = match(evidence.side)
    .with('current', () => analysis.current)
    .with('previous', () => analysis.previous)
    // 분석의 보고서가 아니면(null) 열지 않는다
    .otherwise(() => null)
  const side = evidence.side
  const sectionNo = evidence.sectionNo
  if (!side || !report || sectionNo === null) {
    return (
      <span className="panel__note">
        {label} <code>{evidence.evidenceId}</code> · 원문 위치를 찾지 못했어요
      </span>
    )
  }
  return (
    <span>
      <Button variant="link" onClick={() => onOpenSource({ side, section: sectionNo, block: evidence.blockNo })}>
        {label}: {report.reportName} 원문 위치 보기
      </Button>
      <span className="panel__note">
        {' '}
        · 출처: DART <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
      </span>
    </span>
  )
}
