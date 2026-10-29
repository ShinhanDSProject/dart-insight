import { useId, useState } from 'react'
import { match } from 'ts-pattern'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { QuoteKind } from '@/shared/api/community'
import type { SjDiv } from '@/shared/api/results'
import { useCompanyAnalyses } from '@/shared/hooks/useCompanyAnalyses'
import { Dialog, FieldLabel, Input, SegmentedControl, Select, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { useFinancialCandidates, useTextCandidates } from '../hooks/useQuoteCandidates'
import {
  accountName,
  amountChangeLabel,
  analysisOptionLabel,
  financialPick,
  quoteKindLabel,
  quoteKindOptions,
  searchQuery,
  statementOptions,
  textPick,
  type QuotePick,
} from '../model/postQuote'

/** 고를 수 있는 분석 수(서버 최대) */
const ANALYSIS_LIMIT = 20

interface QuotePickerDialogProps {
  corpCode: string
  onPick: (pick: QuotePick) => void
  onClose: () => void
}

/**
 * 글에 붙일 변경점 고르기(#464). 이 기업의 완료된 분석 하나를 고르고, 문장 변경이나 재무 계정 변화 하나를 누르면 붙는다.
 * 이 기업의 분석만 보이므로 다른 기업의 변경을 붙일 수 없다(서버도 막는다).
 */
export function QuotePickerDialog({ corpCode, onPick, onClose }: QuotePickerDialogProps) {
  const id = useId()
  const analyses = useCompanyAnalyses(corpCode, ANALYSIS_LIMIT)

  return (
    <Dialog titleId={`${id}-title`} title="변경점 붙이기" onClose={onClose} className="community-dialog quote-picker">
      {match(analyses.state)
        .with({ status: 'loading' }, () => <Skeleton label="분석을 불러오는 중입니다…" shape="line" count={3} />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={analyses.reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.items.length === 0 ? (
            <EmptyState title="아직 이 기업의 분석이 없어요">
              <p>보고서 비교 탭에서 두 보고서를 분석하면 그 결과의 변경점을 붙일 수 있어요.</p>
            </EmptyState>
          ) : (
            <Picker analyses={data.items} onPick={onPick} />
          ),
        )
        .exhaustive()}
    </Dialog>
  )
}

function Picker({ analyses, onPick }: { analyses: CompanyAnalysisItem[]; onPick: (pick: QuotePick) => void }) {
  const id = useId()
  const [analysisId, setAnalysisId] = useState(analyses[0].analysisId)
  const [kind, setKind] = useState<QuoteKind>('TEXT_CHANGE')
  const analysis = analyses.find((a) => a.analysisId === analysisId) ?? analyses[0]

  return (
    <div className="quote-picker__body">
      <div className="quote-picker__field">
        <FieldLabel htmlFor={`${id}-analysis`}>분석</FieldLabel>
        <Select id={`${id}-analysis`} value={analysisId} onChange={(e) => setAnalysisId(Number(e.target.value))}>
          {analyses.map((a) => (
            <option key={a.analysisId} value={a.analysisId}>
              {analysisOptionLabel(a)}
            </option>
          ))}
        </Select>
      </div>
      <SegmentedControl aria-label="변경 종류" options={quoteKindOptions} value={kind} onChange={setKind} />
      {match(kind)
        .with('TEXT_CHANGE', () => <TextCandidates key={analysisId} analysis={analysis} onPick={onPick} />)
        .with('FINANCIAL_CHANGE', () => <FinancialCandidates key={analysisId} analysis={analysis} onPick={onPick} />)
        .exhaustive()}
    </div>
  )
}

function TextCandidates({ analysis, onPick }: { analysis: CompanyAnalysisItem; onPick: (pick: QuotePick) => void }) {
  const id = useId()
  const [input, setInput] = useState('')
  const q = searchQuery(input)
  const candidates = useTextCandidates(analysis.analysisId, q)

  return (
    <>
      <div className="quote-picker__field">
        <FieldLabel htmlFor={`${id}-q`}>문장 찾기</FieldLabel>
        <Input id={`${id}-q`} type="search" value={input} placeholder="두 글자 이상" onChange={(e) => setInput(e.target.value)} />
      </div>
      {match(candidates.state)
        .with({ status: 'idle' }, { status: 'loading' }, () => <Skeleton label="문장 변경을 불러오는 중입니다…" shape="line" count={4} />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={candidates.reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.items.length === 0 ? (
            <EmptyState title={q === null ? '이 분석에는 문장 변경이 없어요' : '찾는 문장 변경이 없어요'} />
          ) : (
            <ul className="quote-picker__list" aria-label="문장 변경 후보">
              {data.items.map((item) => (
                <li key={item.changeId}>
                  <button type="button" className="quote-picker__item" onClick={() => onPick(textPick(analysis, item))}>
                    <span className="quote-picker__item-head">
                      {quoteKindLabel({ kind: 'TEXT_CHANGE', changeType: item.changeType })} · {item.sectionPath}
                    </span>
                    <span className="quote-picker__item-text">
                      {item.currentPreview ?? item.previousPreview ?? item.reviewReason}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ),
        )
        .exhaustive()}
    </>
  )
}

function FinancialCandidates({ analysis, onPick }: { analysis: CompanyAnalysisItem; onPick: (pick: QuotePick) => void }) {
  const [sjDiv, setSjDiv] = useState<SjDiv>('BS')
  const candidates = useFinancialCandidates(analysis.analysisId, sjDiv)

  return match(candidates.state)
    .with({ status: 'idle' }, { status: 'loading' }, () => <Skeleton label="재무 계정을 불러오는 중입니다…" shape="line" count={4} />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={candidates.reload} />)
    .with({ status: 'success' }, ({ data }) => {
      const options = statementOptions(data.statements)
      const statement = data.statements.find((s) => s.sjDiv === sjDiv)?.label ?? sjDiv
      return (
        <>
          {options.length > 0 && <SegmentedControl aria-label="재무제표" options={options} value={sjDiv} onChange={setSjDiv} />}
          {data.items.length === 0 ? (
            <EmptyState title="이 재무제표에는 바뀐 계정이 없어요" />
          ) : (
            <ul className="quote-picker__list" aria-label="재무 계정 후보">
              {data.items.map((item) => (
                <li key={item.changeId}>
                  <button
                    type="button"
                    className="quote-picker__item"
                    onClick={() => onPick(financialPick(analysis, statement, item))}
                  >
                    <span className="quote-picker__item-head">{accountName(item)}</span>
                    <span className="quote-picker__item-text">{amountChangeLabel(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )
    })
    .exhaustive()
}
