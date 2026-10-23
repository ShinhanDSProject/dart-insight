import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import { getFinancialChange, type FinancialChangeDetail, type ValueSource } from '@/shared/api/results'
import { Button, Notice, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { amountPeriodLabel, formatAmount, missingValueLabel, unitLabel, type AmountUnit } from '../model/format'

type DetailState = { kind: 'loading' } | { kind: 'done'; detail: FinancialChangeDetail } | { kind: 'error'; error: unknown }

const statementLabels: Record<string, string> = {
  BS: '재무상태표',
  IS: '손익계산서',
  CIS: '포괄손익계산서',
  CF: '현금흐름표',
  SCE: '자본변동표',
}

interface EvidencePanelProps {
  analysis: Analysis
  changeId: number
  unit: AmountUnit
  onClose: () => void
}

/**
 * W-03 ② 수치 근거 상세(3.3). 두 보고서의 값·기준일·단위와 계산식, 원문 링크를 보여 준다.
 * 계산하지 못한 항목은 숫자를 채우지 않고 사유를 보여 준다.
 */
export function EvidencePanel({ analysis, changeId, unit, onClose }: EvidencePanelProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getFinancialChange(analysis.analysisId, changeId)
      .then((detail) => {
        if (!cancelled) setState({ kind: 'done', detail })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, changeId, retry])

  const title = state.kind === 'done' ? `${state.detail.accountName} · 근거` : '수치 근거'
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 표 아래에 열리므로, 열리면 제목으로 초점과 화면을 옮긴다(키보드·화면 읽기 사용자)
  useEffect(() => {
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return (
    <Panel className="evidence" aria-labelledby="evidence-title" id="evidence">
      <div className="evidence__head">
        <PanelTitle id="evidence-title" ref={headingRef} tabIndex={-1}>
          {title}
        </PanelTitle>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
      {state.kind === 'loading' && <LoadingState message="근거를 불러오는 중입니다…" />}
      {state.kind === 'error' && (
        <ErrorState
          error={state.error}
          onRetry={() => setRetry((n) => n + 1)}
          messages={{ ANALYSIS_CHANGE_NOT_FOUND: '이 분석의 계정이 아니에요. 표에서 다시 골라 주세요.' }}
        />
      )}
      {state.kind === 'done' && <EvidenceBody analysis={analysis} detail={state.detail} unit={unit} />}
    </Panel>
  )
}

function EvidenceBody({ analysis, detail, unit }: { analysis: Analysis; detail: FinancialChangeDetail; unit: AmountUnit }) {
  const basis = detail.fsDiv === 'OFS' ? '별도' : '연결'
  const currency = detail.currency === 'KRW' ? '원(KRW)' : (detail.currency ?? '통화 확인 안 됨')
  const baseUnit = unitLabel('WON', detail.currency)
  return (
    <>
      <div className="evidence__sources">
        <SourceCard
          role="이전 보고서"
          source={detail.previous}
          fallbackReport={analysis.previous}
          amount={detail.previousAmount}
          missing={missingValueLabel(detail.calcStatus, 'previous')}
          detail={detail}
          unit={unit}
          basis={basis}
          currency={currency}
        />
        <SourceCard
          role="현재 보고서"
          source={detail.current}
          fallbackReport={analysis.current}
          amount={detail.currentAmount}
          missing={missingValueLabel(detail.calcStatus, 'current')}
          detail={detail}
          unit={unit}
          basis={basis}
          currency={currency}
        />
      </div>
      {detail.formula ? (
        <p className="evidence__formula">
          증감액 = 현재 값 − 이전 값 = {detail.formula} {baseUnit}
          <br />
          {detail.rateFormula ? `증감률 = 증감액 ÷ 이전 값 × 100 = ${detail.rateFormula}` : `증감률: ${detail.calcMessage}`}
        </p>
      ) : (
        <Notice as="p" role="status">
          계산하지 않았어요. {detail.calcMessage}
        </Notice>
      )}
      <p className="evidence__note">관련 설명: <strong>확인된 설명 없음</strong></p>
      <p className="panel__note">
        수치는 OpenDART 재무제표 API 값으로 코드가 계산했어요. 원문 표 안의 위치로 바로 이동하는 기능은 3.5(M2)에서 붙어요.
      </p>
    </>
  )
}

interface SourceCardProps {
  role: string
  source: ValueSource | null
  fallbackReport: Analysis['previous']
  amount: number | null
  missing: string
  detail: FinancialChangeDetail
  unit: AmountUnit
  basis: string
  currency: string
}

function SourceCard({ role, source, fallbackReport, amount, missing, detail, unit, basis, currency }: SourceCardProps) {
  const report = source ?? fallbackReport
  const scaled = formatAmount(amount, unit)
  const exact = formatAmount(amount, 'WON')
  return (
    <div className="evidence__source">
      <span className="evidence__role">{role}</span>
      <span className="evidence__value">
        {scaled === null ? missing : `${scaled} ${unitLabel(unit, detail.currency)}`}
        {exact !== null && unit !== 'WON' && (
          <span className="evidence__exact">
            {' '}
            ({exact} {unitLabel('WON', detail.currency)})
          </span>
        )}
      </span>
      <span>
        {detail.amountBasis === 'POINT' ? '기준일' : '대상 기간'} {amountPeriodLabel(report, detail.amountBasis)} · {basis} ·{' '}
        {currency}
      </span>
      {source ? (
        <>
          <span className="evidence__meta">
            {report.reportName} · {statementLabels[source.sjDiv] ?? source.sjDiv}
            {source.periodName ? ` · ${source.periodName}` : ''}
          </span>
          <span className="evidence__meta">
            계정 ID <code>{source.accountId}</code> · 접수번호 <code>{source.rceptNo}</code>
          </span>
          <span className="evidence__meta">
            출처: DART · <DartLinkInline rceptNo={source.rceptNo} dartUrl={source.dartUrl} label={`${role} ${report.reportName}`} />
          </span>
        </>
      ) : (
        <span className="evidence__meta">이 보고서에는 이 계정이 없어요.</span>
      )}
    </div>
  )
}
