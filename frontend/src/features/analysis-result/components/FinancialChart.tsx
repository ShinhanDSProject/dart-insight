import { useState, type CSSProperties } from 'react'
import { match } from 'ts-pattern'
import type { FinancialChangeItem } from '@/shared/api/results'
import { SegmentedControl } from '@/shared/ui'
import { barSpan, formatCompactAmount, niceScale, position, type Scale } from '@/shared/lib/chartScale'
import { chartData, formatTickRate, type ChartItem, type ChartView } from '../model/chart'
import { formatAmount, formatChange, formatRate, shortCalcLabel, unitLabel, type AmountUnit } from '../model/format'

const viewOptions = [
  { value: 'rate', label: '증감률' },
  { value: 'amount', label: '금액' },
] as const

interface FinancialChartProps {
  /** 표와 같은 목록(같은 재무제표·같은 '변경 항목만' 조건) */
  items: FinancialChangeItem[]
  statementLabel: string
  unit: AmountUnit
  currency: string | null
  /** 금액의 기준일·기간(표 머리글과 같은 문구) */
  previousPeriod: string
  currentPeriod: string
  selectedChangeId: number | null
  onSelect: (changeId: number) => void
}

/**
 * W-03 ② 재무 수치 변화 차트(FS-3). 증감액 절댓값이 큰 계정을 증감률 막대나 이전 → 현재 덤벨로 보여 준다.
 * 행은 버튼이고 누르면 표와 같은 수치 근거를 연다. 증감은 막대 방향과 ▲▼·부호로 보인다(색은 중립).
 * 라이브러리 없이 그린다(ADR-0018).
 */
export function FinancialChart(props: FinancialChartProps) {
  const { items, statementLabel, unit, currency, previousPeriod, currentPeriod } = props
  const [view, setView] = useState<ChartView>('rate')
  const data = chartData(items)
  if (data.items.length === 0) {
    return data.excluded > 0 ? (
      <p className="panel__note">계산할 수 있는 계정이 없어 차트를 그리지 않았어요. 사유는 아래 표에서 볼 수 있어요.</p>
    ) : null
  }

  const rates = data.items.flatMap((i) => (i.changeRate === null ? [] : [i.changeRate]))
  const amounts = data.items.flatMap((i) => [i.previousAmount, i.currentAmount])
  const scale = view === 'rate' ? niceScale(rates) : niceScale(amounts)
  const tickLabel = (tick: number) => (view === 'rate' ? formatTickRate(tick) : formatCompactAmount(tick, currency))

  return (
    <section className="fin-chart" aria-labelledby="fin-chart-title">
      <div className="fin-chart__head">
        <div>
          <h3 className="fin-chart__title" id="fin-chart-title">
            증감이 큰 계정 {data.items.length}개
          </h3>
          <p className="fin-chart__sub">
            {statementLabel} · 증감액 크기 순 · {view === 'rate' ? '증감률' : `금액 · 오른쪽 증감액 단위 ${unitLabel(unit, currency)}`}
          </p>
        </div>
        <SegmentedControl aria-label="차트 보기" options={viewOptions} value={view} onChange={setView} />
      </div>

      {view === 'amount' && (
        <ul className="fin-chart__legend" aria-label="범례">
          <li>
            <span className="fin-chart__key fin-chart__key--previous" aria-hidden="true" />
            이전 · {previousPeriod}
          </li>
          <li>
            <span className="fin-chart__key fin-chart__key--current" aria-hidden="true" />
            현재 · {currentPeriod}
          </li>
        </ul>
      )}

      <ol className="fin-chart__rows">
        {data.items.map((item, index) => (
          <ChartRow key={item.changeId} item={item} index={index} view={view} scale={scale} {...props} />
        ))}
      </ol>
      <div className="fin-chart__axis" aria-hidden="true">
        <span />
        <div className="fin-chart__ticks">
          {scale.ticks.map((tick) => (
            <span key={tick} className="fin-chart__tick" style={{ left: `${position(scale, tick)}%` }}>
              {tickLabel(tick)}
            </span>
          ))}
        </div>
        <span />
      </div>

      <p className="panel__note">
        막대를 누르면 그 계정의 근거를 열어요.
        {data.excluded > 0 && ` 값이 없거나 계산할 수 없는 계정 ${data.excluded}개는 차트에서 뺐어요(사유는 아래 표).`}
        {data.rest > 0 && ` 나머지 ${data.rest}개 계정은 아래 표에 있어요.`}
      </p>
    </section>
  )
}

type ChartRowProps = FinancialChartProps & { item: ChartItem; index: number; view: ChartView; scale: Scale }

function ChartRow({ item, index, view, scale, unit, currency, selectedChangeId, onSelect }: ChartRowProps) {
  const selected = item.changeId === selectedChangeId
  const units = unitLabel(unit, currency)
  const previous = formatAmount(item.previousAmount, unit)
  const current = formatAmount(item.currentAmount, unit)
  const change = formatChange(item.changeAmount, unit)
  const rate = formatRate(item.changeRate)
  const rateText = rate === null ? (shortCalcLabel(item.calcStatus) ?? '증감률 없음') : `${arrow(item.changeAmount)} ${rate}`.trim()
  const label = `${item.accountName}: 이전 ${previous}, 현재 ${current} ${units}, 증감 ${change}${rate ? `, ${rate}` : ''}. 근거 ${selected ? '보는 중' : '보기'}`

  return (
    // --row: 행 순서대로 조금씩 늦게 그려지게 하는 값(애니메이션 지연, #198)
    <li style={{ '--row': index } as CSSProperties}>
      <button
        type="button"
        className="fin-chart__row"
        aria-pressed={selected}
        aria-label={label}
        onClick={() => onSelect(item.changeId)}
      >
        <span className="fin-chart__name">{item.accountName}</span>
        <span className="fin-chart__plot">
          {scale.ticks.map((tick) => (
            <span
              key={tick}
              className={`fin-chart__grid${tick === 0 ? ' fin-chart__grid--zero' : ''}`}
              style={{ left: `${position(scale, tick)}%` }}
            />
          ))}
          {match(view)
            .with('rate', () => <RateBar item={item} scale={scale} />)
            .with('amount', () => <Dumbbell item={item} scale={scale} />)
            .exhaustive()}
        </span>
        <span className={`fin-chart__value${view === 'rate' && rate === null ? ' fin-chart__value--muted' : ''}`}>
          {view === 'rate' ? rateText : change}
        </span>
        <span className="fin-chart__tip" aria-hidden="true">
          이전 {previous} → 현재 {current} {units}
          <br />
          증감 {change}
          {rate && ` (${rate})`}
        </span>
      </button>
    </li>
  )
}

function RateBar({ item, scale }: { item: ChartItem; scale: Scale }) {
  if (item.changeRate === null) return null
  const { left, width } = barSpan(scale, item.changeRate)
  const style: CSSProperties = { left: `${left}%`, width: `${width}%` }
  return <span className={`fin-chart__bar${item.changeRate < 0 ? ' fin-chart__bar--down' : ''}`} style={style} />
}

function Dumbbell({ item, scale }: { item: ChartItem; scale: Scale }) {
  const from = position(scale, item.previousAmount)
  const to = position(scale, item.currentAmount)
  return (
    <>
      <span
        className={`fin-chart__link${to < from ? ' fin-chart__link--back' : ''}`}
        style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }}
      />
      <span className="fin-chart__dot fin-chart__dot--previous" style={{ left: `${from}%` }} />
      <span className="fin-chart__dot fin-chart__dot--current" style={{ left: `${to}%` }} />
    </>
  )
}

function arrow(change: number): string {
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return ''
}
