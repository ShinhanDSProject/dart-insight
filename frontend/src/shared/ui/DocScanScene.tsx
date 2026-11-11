import type { CSSProperties } from 'react'

export interface DocScanSceneProps {
  label?: string
  chips?: readonly string[]
  className?: string
}

const DEFAULT_CHIPS = ['원문 탐색', '핵심 추출', '근거 검증'] as const

/**
 * AI가 보고서 원문을 분석하거나 질문에 대한 근거를 탐색할 때 보이는 동적 스캔 장면.
 * 문서 위로 레이저 훑는 선이 왕복하며 텍스트 라인이 활성화되고 분석 단계 칩이 떠오른다.
 * 화면 읽기 도구에는 숨기고(aria-hidden), 동작 줄이기면 정적 표시가 된다.
 */
export function DocScanScene({
  label = '보고서 원문 분석 중',
  chips = DEFAULT_CHIPS,
  className,
}: DocScanSceneProps = {}) {
  return (
    <div className={`doc-scan-scene ${className ?? ''}`} aria-hidden="true">
      <div className="doc-scan-scene__doc">
        <div className="doc-scan-scene__header">
          <span className="doc-scan-scene__badge">{label}</span>
        </div>
        <div className="doc-scan-scene__body">
          <span className="doc-scan-scene__line" style={{ width: '92%', '--i': 0 } as CSSProperties} />
          <span className="doc-scan-scene__line doc-scan-scene__line--active" style={{ width: '84%', '--i': 1 } as CSSProperties} />
          <span className="doc-scan-scene__line" style={{ width: '70%', '--i': 2 } as CSSProperties} />
          <span className="doc-scan-scene__line doc-scan-scene__line--active" style={{ width: '88%', '--i': 3 } as CSSProperties} />
          <span className="doc-scan-scene__line" style={{ width: '60%', '--i': 4 } as CSSProperties} />
          <span className="doc-scan-scene__line doc-scan-scene__line--active" style={{ width: '76%', '--i': 5 } as CSSProperties} />
        </div>
        <span className="doc-scan-scene__scan" />
      </div>
      <div className="doc-scan-scene__chips">
        {chips.map((chip, index) => (
          <span key={chip} className="doc-scan-scene__chip" style={{ '--i': index } as CSSProperties}>
            <span className="doc-scan-scene__chip-dot" />
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}
