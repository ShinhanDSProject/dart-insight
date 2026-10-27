import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import { useCountUp } from '@/shared/hooks/useCountUp'
import { cx } from '@/shared/lib/cx'

/** 증감 방향. 좋고 나쁨이 아니라 값이 커졌는지 작아졌는지만 뜻한다 */
export type StatDirection = 'up' | 'down' | 'same'

export interface StatChange {
  direction: StatDirection
  /** 증감액의 절댓값 문구(예: 1.2조원). 방향은 ▲▼로 보인다 */
  amount: string
  /** 부호가 붙은 증감률(예: +4.8%). 계산하지 않았으면 null */
  rate: string | null
}

interface StatNumberProps {
  /** 지표 이름(예: 매출액) */
  label: string
  /** 값. null이면 '-'와 '자료 없음'(0과 다름) */
  value: number | null
  /** 숫자 문구를 만드는 lib의 format 함수(NM-2). count-up 중간 값에도 같은 함수를 쓴다 */
  format: (value: number) => string
  /** 숫자 뒤의 단위(예: 원) */
  unit?: string
  /** 보조 줄 앞말(예: 전기 대비) */
  changeLabel?: string
  /** 증감. 없으면 보조 줄을 그리지 않고, changeNote만 있으면 그 문구만 보인다 */
  change?: StatChange | null
  /** 증감률을 계산하지 않은 사유나 비교할 값이 없을 때의 문구 */
  changeNote?: string | null
  /** 근거(접수번호·계정·기간) */
  source?: ReactNode
  className?: string
}

const arrows: Record<StatDirection, string> = { up: '▲', down: '▼', same: '–' }
const directionWords: Record<StatDirection, string> = { up: '증가', down: '감소', same: '변화 없음' }

/**
 * 큰 숫자 지표(FS-58). 이름, 큰 값과 단위, 보조 줄(증감, 중립색과 ▲▼·부호), 근거를 위에서부터 둔다.
 * 값은 짧게 올라가며 나타나고(useCountUp, 동작 줄이기면 바로 최종 값), 화면 읽기 도구에는 최종 값만 읽어 준다.
 */
export function StatNumber({
  label,
  value,
  format,
  unit,
  changeLabel = '전기 대비',
  change = null,
  changeNote = null,
  source,
  className,
}: StatNumberProps) {
  const shown = useCountUp(value)

  return (
    <div className={cx('stat-number', className)}>
      <p className="stat-number__label">{label}</p>
      {value === null ? (
        <p className="stat-number__value stat-number__value--missing">
          <span aria-hidden="true">-</span>
          <span className="stat-number__missing">자료 없음</span>
        </p>
      ) : (
        <p className="stat-number__value">
          <span className="stat-number__digits" aria-hidden="true">
            {format(shown ?? value)}
          </span>
          {unit && (
            <span className="stat-number__unit" aria-hidden="true">
              {unit}
            </span>
          )}
          <span className="visually-hidden">
            {format(value)}
            {unit}
          </span>
        </p>
      )}
      {(change !== null || changeNote !== null) && (
        <p className="stat-number__change">
          <span>{changeLabel}</span>
          {change !== null && <ChangeText change={change} />}
          {changeNote !== null && <span className="stat-number__note">{changeNote}</span>}
        </p>
      )}
      {source && <div className="stat-number__source">{source}</div>}
    </div>
  )
}

function ChangeText({ change }: { change: StatChange }) {
  return match(change.direction)
    .with('same', () => <span className="stat-number__delta">변화 없음</span>)
    .with('up', 'down', (direction) => (
      <span className="stat-number__delta">
        <span aria-hidden="true">{arrows[direction]}</span>
        <span className="visually-hidden">{directionWords[direction]}</span> {change.amount}
        {change.rate !== null && <> ({change.rate})</>}
      </span>
    ))
    .exhaustive()
}
