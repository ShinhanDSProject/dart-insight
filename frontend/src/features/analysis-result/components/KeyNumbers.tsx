import { match } from 'ts-pattern'
import type { FinancialChangeItem } from '@/shared/api/results'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { Button, Card, Skeleton, StatNumber, type StatChange, type StatDirection } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useKeyNumbers } from '../hooks/useFinancialChanges'
import { formatRate, missingValueLabel, shortCalcLabel } from '../model/format'
import type { KeyNumber } from '../model/keyNumbers'

interface KeyNumbersProps {
  analysisId: number
  /** 칸의 '근거 보기': 그 계정의 재무제표로 옮기고 수치 근거를 연다 */
  onOpen: (item: FinancialChangeItem) => void
}

/**
 * 재무 수치 탭 맨 위 '핵심 숫자'(#550, 시안 14). 매출액·영업이익·순이익·자산총계·영업활동현금흐름을 큰 숫자로 두고,
 * 아래에 이전 값과 증감(중립색 ▲▼·부호)을 둔다. 값은 서버가 준 금액·증감 그대로이고, 찾지 못한 칸은 '자료 없음'이다.
 */
export function KeyNumbers({ analysisId, onOpen }: KeyNumbersProps) {
  const { state, reload } = useKeyNumbers(analysisId)
  return (
    <section className="key-numbers" aria-labelledby="key-numbers-title">
      <div className="key-numbers__head">
        <h2 id="key-numbers-title" className="key-numbers__title">
          핵심 숫자
        </h2>
        <p className="panel__note">손익·현금흐름은 보고서 기간 금액, 자산총계는 기말 값 · 증감은 코드가 계산한 값</p>
      </div>
      {match(state)
        .with({ status: 'loading' }, () => <Skeleton label="핵심 숫자를 불러오는 중입니다…" shape="card" count={5} />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) => (
          <ul className="key-numbers__list">
            {data.map((number) => (
              <li key={number.key}>
                <KeyNumberCard number={number} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        ))
        .exhaustive()}
    </section>
  )
}

const directions: Record<'UP' | 'DOWN' | 'SAME', StatDirection> = { UP: 'up', DOWN: 'down', SAME: 'same' }

function KeyNumberCard({ number, onOpen }: { number: KeyNumber; onOpen: (item: FinancialChangeItem) => void }) {
  const { item, label } = number
  if (item === null) {
    return (
      <Card className="key-number">
        <StatNumber label={label} value={null} format={String} />
      </Card>
    )
  }
  const compact = (value: number) => formatCompactAmount(value, item.currency)
  const previous = item.previousAmount === null ? missingValueLabel(item.calcStatus, 'previous') : compact(item.previousAmount)
  const change: StatChange | null =
    item.changeAmount === null || item.direction === null
      ? null
      : { direction: directions[item.direction], amount: compact(Math.abs(item.changeAmount)), rate: formatRate(item.changeRate) }
  const note = item.changeRate === null ? shortCalcLabel(item.calcStatus) : null
  return (
    <Card className="key-number">
      <StatNumber
        label={label}
        value={item.currentAmount}
        format={compact}
        unit={item.currency === null || item.currency === 'KRW' ? '원' : undefined}
        previousText={`이전 ${previous}`}
        changeLabel=""
        change={change}
        changeNote={note}
        source={
          <Button variant="link" aria-label={`${label} 근거 보기`} onClick={() => onOpen(item)}>
            근거 보기
          </Button>
        }
      />
    </Card>
  )
}
