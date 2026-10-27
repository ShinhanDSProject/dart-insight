import { useState } from 'react'
import { match } from 'ts-pattern'
import type { BriefingReport } from '@/shared/api/briefing'
import type { CompanyOutlook, OutlookItem } from '@/shared/api/outlook'
import { Badge, Button, Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState } from '@/shared/ui/StateView'
import { useCompanyOutlook } from '../hooks/useCompanyOutlook'
import { briefingAiLabel, evidenceLocation, toggleOpen } from '../model/companyBriefing'
import { OUTLOOK_ERROR_MESSAGES, groupOutlookItems } from '../model/companyOutlook'
import '../report-selection.css'

const TITLE_ID = 'company-outlook-title'

/**
 * 기업 화면 개요 탭 '회사가 밝힌 전망·계획'(FS-59, ADR-0039). 최신 사업보고서에서 회사가 공시한 계획·전망을
 * 종류별로 묶어 AI가 줄인 요지와 원문 인용을 보이고, 항목마다 근거 버튼으로 섹션 경로·블록·DART 원문을 편다.
 * 서비스는 계획을 평가하거나 예측하지 않는다. 처음 만드는 기업은 수십 초 걸릴 수 있다.
 */
export function CompanyOutlookSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyOutlook(corpCode)
  const outlook = state.status === 'success' ? state.data : null
  return (
    <Panel className="company-outlook" aria-labelledby={TITLE_ID} aria-busy={state.status === 'loading'}>
      <div className="company-briefing__head">
        <PanelTitle id={TITLE_ID}>회사가 밝힌 전망·계획</PanelTitle>
        {outlook?.aiGenerated && <Badge tone="accent">AI 생성</Badge>}
      </div>
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton
            label="보고서 원문에서 회사가 밝힌 전망·계획을 모으는 중이에요. 처음 여는 기업은 수십 초 걸릴 수 있어요."
            shape="line"
            count={4}
          />
        ))
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={OUTLOOK_ERROR_MESSAGES} />
        ))
        .with({ status: 'success' }, ({ data }) => <OutlookBody outlook={data} />)
        .exhaustive()}
    </Panel>
  )
}

export function OutlookBody({ outlook }: { outlook: CompanyOutlook }) {
  return (
    <>
      {outlook.report && <SourceReport report={outlook.report} />}
      {match(outlook.status)
        .with('GENERATED', () => outlook.report && <OutlookGroups items={outlook.items} report={outlook.report} />)
        .with('EMPTY', () => (
          <Notice role="status" title="찾지 못했어요">
            <p>{outlook.message ?? '보고서 원문에서 회사가 밝힌 계획·전망 문장을 찾지 못했어요.'}</p>
          </Notice>
        ))
        .with('REVIEW_NEEDED', () => (
          <Notice tone="attention" role="status" title="검토 필요">
            <p>{outlook.message ?? '인용과 근거를 확인하지 못해 전망·계획을 보여 주지 않아요.'} 원문에서 직접 확인해 주세요.</p>
          </Notice>
        ))
        .with('NOT_AVAILABLE', () => (
          <Notice role="status" title="전망·계획을 모을 수 없어요">
            <p>{outlook.message ?? '전망·계획을 모을 보고서 원문이 없어요.'}</p>
          </Notice>
        ))
        .exhaustive()}
      <p className="company-briefing__meta">
        회사가 공시한 계획·전망이며 실현을 보장하지 않아요. 투자 판단의 근거가 아니며, 정확한 내용은 근거 원문에서 확인해 주세요.
        {outlook.aiGenerated && outlook.ai && (
          <span className="company-briefing__model"> 요지는 AI가 줄였어요 · {briefingAiLabel(outlook.ai)}</span>
        )}
      </p>
    </>
  )
}

function SourceReport({ report }: { report: BriefingReport }) {
  return (
    <p className="company-briefing__source">
      출처: DART · 근거 보고서 <span>{report.reportName}</span>{' '}
      <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
    </p>
  )
}

function OutlookGroups({ items, report }: { items: OutlookItem[]; report: BriefingReport }) {
  const [openEvidence, setOpenEvidence] = useState<number | null>(null)
  const [folded, setFolded] = useState<ReadonlySet<number>>(new Set())

  function toggleQuote(no: number) {
    setFolded((current) => {
      const next = new Set(current)
      if (!next.delete(no)) next.add(no)
      return next
    })
  }

  return (
    <div className="company-outlook__groups">
      {groupOutlookItems(items).map((group) => (
        <section key={group.category} className="company-outlook__group" aria-labelledby={`company-outlook-${group.category}`}>
          <h3 id={`company-outlook-${group.category}`} className="company-outlook__group-title">
            {group.label} <Badge>{group.items.length}건</Badge>
          </h3>
          <ol className="company-outlook__list">
            {group.items.map((item) => {
              const quoteOpen = !folded.has(item.no)
              const evidenceOpen = openEvidence === item.no
              const quoteId = `company-outlook-quote-${item.no}`
              const evidenceId = `company-outlook-evidence-${item.no}`
              return (
                <li key={item.no} className="company-outlook__item">
                  <p className="company-briefing__text">{item.summary}</p>
                  <div className="company-outlook__actions">
                    <Button
                      variant="link"
                      className="company-briefing__cite"
                      aria-expanded={quoteOpen}
                      aria-controls={quoteId}
                      onClick={() => toggleQuote(item.no)}
                    >
                      {quoteOpen ? '인용 접기' : '인용 보기'}
                      <span className="visually-hidden"> ({item.no}번 항목)</span>
                    </Button>
                    <Button
                      variant="link"
                      className="company-briefing__cite"
                      aria-expanded={evidenceOpen}
                      aria-controls={evidenceId}
                      onClick={() => setOpenEvidence((current) => toggleOpen(current, item.no))}
                    >
                      근거
                      <span className="visually-hidden"> ({item.no}번 항목 원문 위치 {evidenceOpen ? '닫기' : '보기'})</span>
                    </Button>
                  </div>
                  {quoteOpen && (
                    <blockquote id={quoteId} className="company-outlook__quote">
                      <p>“{item.quote}”</p>
                    </blockquote>
                  )}
                  {evidenceOpen && (
                    <div id={evidenceId} className="company-briefing__evidence">
                      <p className="company-outlook__location">
                        {evidenceLocation(item.evidence)} · 원문{' '}
                        <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={`${item.no}번 항목 근거 보고서`} />
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
