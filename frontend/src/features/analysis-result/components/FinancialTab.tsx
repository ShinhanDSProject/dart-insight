import { useEffect, useState } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import {
  getFinancialChanges,
  type FinancialChangeItem,
  type FinancialChangeList,
  type SjDiv,
  type StatementSummary,
} from '@/shared/api/results'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { EvidencePanel } from './EvidencePanel'
import {
  amountPeriodLabel,
  formatAmount,
  formatChange,
  formatRate,
  missingValueLabel,
  shortCalcLabel,
  unitLabel,
  unitOptions,
  type AmountUnit,
} from '../model/format'

const statementOptions: { sjDiv: SjDiv; label: string }[] = [
  { sjDiv: 'BS', label: '재무상태표' },
  { sjDiv: 'IS', label: '손익계산서' },
  { sjDiv: 'CIS', label: '포괄손익계산서' },
  { sjDiv: 'CF', label: '현금흐름표' },
  { sjDiv: 'SCE', label: '자본변동표' },
]

type TabState = { kind: 'loading' } | { kind: 'done'; data: FinancialChangeList } | { kind: 'error'; error: unknown }

interface FinancialTabProps {
  analysis: Analysis
  sjDiv: SjDiv
  changedOnly: boolean
  unit: AmountUnit
  /** 근거를 보고 있는 계정(3.3) */
  selectedChangeId: number | null
  onChange: (changes: { sj?: SjDiv; changed?: boolean; unit?: AmountUnit; change?: number | null }) => void
}

/** W-03 ② 재무 수치 변화(3.1). 이 분석의 결과만 보여 준다. 계정의 '보기'를 누르면 수치 근거(3.3)를 연다. */
export function FinancialTab({ analysis, sjDiv, changedOnly, unit, selectedChangeId, onChange }: FinancialTabProps) {
  const [state, setState] = useState<TabState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getFinancialChanges(analysis.analysisId, sjDiv, changedOnly)
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, sjDiv, changedOnly, retry])

  // 불러오는 동안에도 고르기 상자를 그대로 두어 키보드 초점을 잃지 않게 한다(이전에 받은 개수를 계속 보여 줌)
  const [statements, setStatements] = useState<StatementSummary[]>([])
  if (state.kind === 'done' && state.data.statements !== statements) {
    setStatements(state.data.statements)
  }
  const selected = statements.find((s) => s.sjDiv === sjDiv)
  const basis = selected?.amountBasis ?? null
  const currency = state.kind === 'done' ? (state.data.items.find((i) => i.currency)?.currency ?? null) : null

  return (
    <section className="panel" aria-label="재무 수치 변화">
      <div className="fin-controls">
        <label htmlFor="fin-statement" className="pair__label">
          재무제표
        </label>
        <select
          id="fin-statement"
          className="select"
          value={sjDiv}
          onChange={(e) => onChange({ sj: e.target.value as SjDiv })}
        >
          {statementOptions.map((option) => {
            const summary = statements.find((s) => s.sjDiv === option.sjDiv)
            return (
              <option key={option.sjDiv} value={option.sjDiv}>
                {summary === undefined
                  ? option.label
                  : summary.comparable
                    ? `${option.label} · 바뀐 ${summary.changed} / 전체 ${summary.total}`
                    : `${option.label} · 비교 안 함`}
              </option>
            )
          })}
        </select>
        <span className="fin-controls__basis">{analysis.fsDiv === 'OFS' ? '별도' : '연결'} 재무제표 기준</span>
        <div className="segmented" role="group" aria-label="보기">
          <button type="button" className="segmented__item" aria-pressed={!changedOnly} onClick={() => onChange({ changed: false })}>
            전체 계정
          </button>
          <button type="button" className="segmented__item" aria-pressed={changedOnly} onClick={() => onChange({ changed: true })}>
            변경 항목만
          </button>
        </div>
        <label htmlFor="fin-unit" className="pair__label">
          단위
        </label>
        <select id="fin-unit" className="select" value={unit} onChange={(e) => onChange({ unit: e.target.value as AmountUnit })}>
          {unitOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {selected && !selected.comparable && (
        <div className="notice notice--attention" role="status">
          {selected.label}는 비교하지 않아요. {selected.note}
        </div>
      )}

      {state.kind === 'loading' && <LoadingState message="계정별 결과를 불러오는 중입니다…" />}
      {state.kind === 'error' && <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} />}
      {state.kind === 'done' && state.data.items.length === 0 && (
        <EmptyState title={changedOnly ? '바뀐 계정이 없어요.' : '이 재무제표에는 계정이 없어요.'}>
          {changedOnly && <p>'전체 계정'을 고르면 값이 같은 계정도 볼 수 있어요.</p>}
        </EmptyState>
      )}
      {state.kind === 'done' && state.data.items.length > 0 && (
        <div className="table-scroll">
          <table className="data-table fin-table">
            <caption className="visually-hidden">
              계정별 이전 값, 현재 값, 증감액, 증감률. 단위 {unitLabel(unit, currency)}
            </caption>
            <thead>
              <tr>
                <th scope="col">계정</th>
                <th scope="col" className="num">
                  이전 · {amountPeriodLabel(analysis.previous, basis)}
                </th>
                <th scope="col" className="num">
                  현재 · {amountPeriodLabel(analysis.current, basis)}
                </th>
                <th scope="col" className="num">
                  증감액
                </th>
                <th scope="col" className="num">
                  증감률
                </th>
                <th scope="col">근거</th>
              </tr>
            </thead>
            <tbody>
              {state.data.items.map((item) => (
                <ChangeRow
                  key={item.changeId}
                  item={item}
                  unit={unit}
                  selected={item.changeId === selectedChangeId}
                  onSelect={() => onChange({ change: item.changeId === selectedChangeId ? null : item.changeId })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedChangeId !== null && (
        <EvidencePanel
          key={selectedChangeId}
          analysis={analysis}
          changeId={selectedChangeId}
          unit={unit}
          onClose={() => {
            const id = selectedChangeId
            onChange({ change: null })
            // 닫으면 그 계정의 '보기' 버튼으로 초점을 돌려준다
            requestAnimationFrame(() => document.getElementById(evidenceButtonId(id))?.focus())
          }}
        />
      )}
      <DartSourceLine
        reports={[
          { role: '비교', report: analysis.previous },
          { role: '현재', report: analysis.current },
        ]}
      />
      <p className="panel__note">
        단위 {unitLabel(unit, currency)}. 증가·감소는 ▲▼와 부호로 표시하고 좋고 나쁨의 평가와 구분해요. 없는 값은 0으로 보지 않아요.
      </p>
    </section>
  )
}

function evidenceButtonId(changeId: number): string {
  return `evidence-button-${changeId}`
}

interface ChangeRowProps {
  item: FinancialChangeItem
  unit: AmountUnit
  selected: boolean
  onSelect: () => void
}

function ChangeRow({ item, unit, selected, onSelect }: ChangeRowProps) {
  const previous = formatAmount(item.previousAmount, unit) ?? missingValueLabel(item.calcStatus, 'previous')
  const current = formatAmount(item.currentAmount, unit) ?? missingValueLabel(item.calcStatus, 'current')
  const change = formatChange(item.changeAmount, unit)
  const rate = formatRate(item.changeRate)
  const reason = shortCalcLabel(item.calcStatus)
  return (
    <tr className={selected ? 'data-table__row--selected' : undefined}>
      <th scope="row">{item.accountName}</th>
      <td className="num">{previous}</td>
      <td className="num">{current}</td>
      {change === null ? (
        <td className="num fin-table__reason" colSpan={2} title={item.calcMessage ?? undefined}>
          {reason}
        </td>
      ) : (
        <>
          <td className="num">{change}</td>
          <td className={`num${rate === null ? ' fin-table__reason' : ''}`} title={item.calcMessage ?? undefined}>
            {rate ?? reason}
          </td>
        </>
      )}
      <td>
        <button
          type="button"
          id={evidenceButtonId(item.changeId)}
          className="button button--secondary fin-table__evidence"
          aria-pressed={selected}
          aria-label={`${item.accountName} 근거 ${selected ? '닫기' : '보기'}`}
          onClick={onSelect}
        >
          {selected ? '보는 중' : '보기'}
        </button>
      </td>
    </tr>
  )
}
