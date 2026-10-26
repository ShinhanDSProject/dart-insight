import { useState } from 'react'
import { match } from 'ts-pattern'
import type { BriefingReport, BriefingSentence, CompanyBriefing } from '@/shared/api/briefing'
import { Badge, Button, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useCompanyBriefing } from '../hooks/useCompanyBriefing'
import { BRIEFING_ERROR_MESSAGES, briefingAiLabel, evidenceLocation, quoteLines, toggleOpen } from '../model/companyBriefing'
import '../report-selection.css'

const TITLE_ID = 'company-briefing-title'

/**
 * 기업 화면 개요 탭 맨 위 'AI 기업 브리핑'(FS-49, ADR-0025). 최신 사업보고서 원문으로 AI가 만든 문장을 보이고,
 * 문장마다 근거 버튼으로 인용한 원문 위치(섹션 경로·블록)와 문단을 펼친다. 처음 만드는 기업은 수십 초 걸릴 수 있다.
 */
export function CompanyBriefingSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyBriefing(corpCode)
  const briefing = state.status === 'success' ? state.data : null
  return (
    <Panel className="company-briefing" aria-labelledby={TITLE_ID} aria-busy={state.status === 'loading'}>
      <div className="company-briefing__head">
        <PanelTitle id={TITLE_ID}>AI 기업 브리핑</PanelTitle>
        {briefing?.aiGenerated && <Badge tone="accent">AI 생성</Badge>}
      </div>
      {match(state)
        .with({ status: 'loading' }, () => (
          <LoadingState message="보고서 원문을 읽고 브리핑을 만드는 중이에요. 처음 여는 기업은 수십 초 걸릴 수 있어요." />
        ))
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={BRIEFING_ERROR_MESSAGES} />
        ))
        .with({ status: 'success' }, ({ data }) => <BriefingBody briefing={data} />)
        .exhaustive()}
    </Panel>
  )
}

export function BriefingBody({ briefing }: { briefing: CompanyBriefing }) {
  return (
    <>
      {briefing.report && <SourceReport report={briefing.report} />}
      {match(briefing.status)
        .with('GENERATED', () => <SentenceList sentences={briefing.sentences} />)
        .with('REVIEW_NEEDED', () => (
          <Notice tone="attention" role="status" title="검토 필요">
            <p>{briefing.message ?? '근거를 확인하지 못해 브리핑을 보여 주지 않아요.'} 원문에서 직접 확인해 주세요.</p>
          </Notice>
        ))
        .with('NOT_AVAILABLE', () => (
          <Notice role="status" title="브리핑을 만들 수 없어요">
            <p>{briefing.message ?? '브리핑을 만들 보고서 원문이 없어요.'}</p>
          </Notice>
        ))
        .exhaustive()}
      {briefing.aiGenerated && (
        <p className="company-briefing__meta">
          공시 원문으로 AI가 만든 요약이에요. 투자 판단의 근거가 아니며, 정확한 내용은 근거 원문에서 확인해 주세요.
          {briefing.ai && <span className="company-briefing__model"> {briefingAiLabel(briefing.ai)}</span>}
        </p>
      )}
    </>
  )
}

function SourceReport({ report }: { report: BriefingReport }) {
  return (
    <p className="company-briefing__source">
      근거 보고서: <span>{report.reportName}</span>{' '}
      <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
    </p>
  )
}

function SentenceList({ sentences }: { sentences: BriefingSentence[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ol className="company-briefing__list">
      {sentences.map((sentence) => {
        const expanded = open === sentence.no
        const panelId = `company-briefing-evidence-${sentence.no}`
        return (
          <li key={sentence.no} className="company-briefing__item">
            <p className="company-briefing__text">
              {sentence.text}{' '}
              <Button
                variant="link"
                className="company-briefing__cite"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen((current) => toggleOpen(current, sentence.no))}
              >
                근거 {sentence.evidence.length}
                <span className="visually-hidden"> ({sentence.no}번 문장 원문 {expanded ? '닫기' : '보기'})</span>
              </Button>
            </p>
            {expanded && (
              <div id={panelId} className="company-briefing__evidence">
                {sentence.evidence.map((evidence) => (
                  <figure key={evidence.evidenceId} className="company-briefing__quote">
                    <figcaption>{evidenceLocation(evidence)}</figcaption>
                    <blockquote>
                      {quoteLines(evidence.quote).map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </blockquote>
                  </figure>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
