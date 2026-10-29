import { useEffect, useRef } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ChangeScaleDetail, FinancialChangeDetail, ValueSource } from '@/shared/api/results'
import { Button, CompareBars, Notice, PanelTitle, SidePanel } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useFinancialChangeDetail } from '../hooks/useFinancialChanges'
import { accountQuestion } from '../model/askQuestion'
import { amountPeriodLabel, formatAmount, missingValueLabel, unitLabel, type AmountUnit } from '../model/format'
import { accountLabel } from '../model/accountLabel'
import { scaleBaseName, scaleReasonMessage } from '../model/changeScale'
import { AddToNote } from './AddToNote'

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
  /** 이 계정 변화를 AI에게 묻는다(3.10). 질문을 보내고 AI 질문 탭으로 옮긴다 */
  onAsk: (question: string) => void
  /** 질문을 보내는 중이면 묻기 버튼을 끈다 */
  asking: boolean
}

/**
 * W-03 ② 수치 근거 상세(3.3). 두 보고서의 값·기준일·단위와 계산식, 원문 링크를 보여 준다.
 * 계산하지 못한 항목은 숫자를 채우지 않고 사유를 보여 준다.
 * 증감액의 크기 맥락(매출액·자산총계 대비, #480)은 계산식과 기준 계정 값의 근거를 함께 보여 준다.
 */
export function EvidencePanel({ analysis, changeId, unit, onClose, onAsk, asking }: EvidencePanelProps) {
  const { state, reload } = useFinancialChangeDetail(analysis.analysisId, changeId)
  const title = state.status === 'success' ? `${accountLabel(state.data)} · 근거` : '수치 근거'
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 열리면 제목으로 초점을 옮긴다(키보드·화면 읽기 사용자). 표를 보던 위치는 그대로 둔다
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <SidePanel className="evidence" aria-labelledby="evidence-title" id="evidence" onClose={onClose}>
      <div className="evidence__head">
        <PanelTitle id="evidence-title" ref={headingRef} tabIndex={-1}>
          {title}
        </PanelTitle>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="근거를 불러오는 중입니다…" />)
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState
            error={error}
            onRetry={reload}
            messages={{ ANALYSIS_CHANGE_NOT_FOUND: '이 분석의 계정이 아니에요. 표에서 다시 골라 주세요.' }}
          />
        ))
        .with({ status: 'success' }, ({ data }) => (
          <EvidenceBody analysis={analysis} detail={data} unit={unit} onAsk={onAsk} asking={asking} />
        ))
        .exhaustive()}
    </SidePanel>
  )
}

interface EvidenceBodyProps {
  analysis: Analysis
  detail: FinancialChangeDetail
  unit: AmountUnit
  onAsk: (question: string) => void
  asking: boolean
}

function EvidenceBody({ analysis, detail, unit, onAsk, asking }: EvidenceBodyProps) {
  const basis = detail.fsDiv === 'OFS' ? '별도' : '연결'
  const currency = detail.currency === 'KRW' ? '원(KRW)' : (detail.currency ?? '통화 확인 안 됨')
  const baseUnit = unitLabel('WON', detail.currency)
  // 요약 탭 예시 질문과 같은 문구(예: 매출액은 왜 늘었나요?)
  const question = accountQuestion(detail)
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
      <CompareBars
        className="evidence__compare"
        previous={{
          label: '이전',
          value: detail.previousAmount,
          text: amountText(detail.previousAmount, unit, detail.currency, missingValueLabel(detail.calcStatus, 'previous')),
        }}
        current={{
          label: '현재',
          value: detail.currentAmount,
          text: amountText(detail.currentAmount, unit, detail.currency, missingValueLabel(detail.calcStatus, 'current')),
        }}
      />
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
      {detail.changeAmount !== null && <ScaleEvidence scale={detail.scale} unit={unit} currency={detail.currency} />}
      <p className="evidence__note">관련 설명: <strong>확인된 설명 없음</strong></p>
      <Button
        variant="secondary"
        className="evidence__ask"
        disabled={asking}
        aria-label={`이 계정 변화 AI에게 묻기: ${question}`}
        onClick={() => onAsk(question)}
      >
        이 계정 변화 AI에게 묻기
      </Button>
      <AddToNote
        target={{ kind: 'FINANCIAL_CHANGE', changeId: detail.changeId }}
        analysisId={analysis.analysisId}
        label={accountLabel(detail)}
      />
      <p className="panel__note">
        수치는 OpenDART 재무제표 API 값으로 코드가 계산했어요. 원문 표 안의 위치로 바로 이동하는 기능은 3.5(M2)에서 붙어요.
      </p>
    </>
  )
}

interface ScaleEvidenceProps {
  scale: ChangeScaleDetail
  unit: AmountUnit
  currency: string | null
}

/** 크기 맥락: 계산식(증감액 ÷ 기준 계정 현재 값)과 기준 계정 값의 근거. 비율이 없으면 사유. 좋고 나쁨은 판단하지 않는다 */
function ScaleEvidence({ scale, unit, currency }: ScaleEvidenceProps) {
  const baseName = scaleBaseName(scale)
  const baseValue = formatAmount(scale.baseAmount, unit)
  const source = scale.baseSource
  return (
    <div className="evidence__scale" role="group" aria-label={`${baseName} 대비 크기`}>
      {scale.formula !== null ? (
        <p className="evidence__formula">
          {baseName} 대비 = 증감액 ÷ {baseName}(현재 보고서) × 100 = {scale.formula}
        </p>
      ) : (
        <p className="evidence__note">
          {baseName} 대비: {scale.reason !== null ? scaleReasonMessage(scale.reason, scale.base) : '계산하지 않았어요.'}
        </p>
      )}
      {source !== null && (
        <span className="evidence__meta">
          기준 계정 {baseName}
          {baseValue !== null ? ` ${baseValue} ${unitLabel(unit, currency)}` : ''} · {statementLabels[source.sjDiv] ?? source.sjDiv}
          {source.periodName ? ` · ${source.periodName}` : ''} · 계정 ID <code>{source.accountId}</code> · 접수번호{' '}
          <code>{source.rceptNo}</code> · <DartLinkInline rceptNo={source.rceptNo} dartUrl={source.dartUrl} label={`기준 계정 ${baseName} ${source.reportName}`} />
        </span>
      )}
    </div>
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

/** 비교 막대 옆 값: 단위를 붙이고, 없으면 사유 */
function amountText(amount: number | null, unit: AmountUnit, currency: string | null, missing: string): string {
  const value = formatAmount(amount, unit)
  return value === null ? missing : `${value} ${unitLabel(unit, currency)}`
}
