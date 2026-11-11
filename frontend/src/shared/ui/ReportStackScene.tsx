import type { CSSProperties } from 'react'

export interface ReportStackSceneProps {
  label?: string
  reports?: readonly string[]
  className?: string
}

const DEFAULT_REPORTS = ['사업보고서', '반기보고서', '분기보고서'] as const

/**
 * OpenDART에서 기업의 정기보고서 목록을 수집할 때 보이는 동적 서류 스택 장면.
 * 여러 정기보고서 카드가 순차적으로 정렬되고 쉬머 빛이 지나간다.
 * 화면 읽기 도구에는 숨기고(aria-hidden), 동작 줄이기면 정적 표시가 된다.
 */
export function ReportStackScene({
  label = '정기보고서 수집 중',
  reports = DEFAULT_REPORTS,
  className,
}: ReportStackSceneProps = {}) {
  return (
    <div className={`report-stack-scene ${className ?? ''}`} aria-hidden="true">
      <div className="report-stack-scene__cards">
        {reports.map((name, index) => (
          <div
            key={name}
            className="report-stack-scene__card"
            style={{ '--i': index } as CSSProperties}
          >
            <span className="report-stack-scene__card-badge">{name}</span>
            <span className="report-stack-scene__card-line" style={{ width: '80%' }} />
            <span className="report-stack-scene__card-line" style={{ width: '55%' }} />
          </div>
        ))}
      </div>
      <span className="report-stack-scene__label">{label}</span>
    </div>
  )
}
