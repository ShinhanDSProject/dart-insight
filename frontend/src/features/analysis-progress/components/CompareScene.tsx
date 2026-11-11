import type { CSSProperties } from 'react'

/** 두 보고서 그림의 줄 길이(%)와 칠할 줄(added·deleted·modified). 꾸밈이라 실제 결과와 상관없다 */
const PREVIOUS_LINES = [92, 80, ['deleted', 70], 88, 60, ['modified', 84], 76, 90, 52] as const
const CURRENT_LINES = [92, ['added', 86], 74, 88, ['modified', 66], 90, 58, 82, 70] as const
const FLYING = [
  { text: '▲ 수치', tone: 'modified' },
  { text: '− 문단', tone: 'deleted' },
  { text: '+ 문장', tone: 'added' },
] as const

/**
 * 분석 진행 중 기다리는 동안 보이는 꾸밈(동적 화면 시안 ②): 이전·현재 보고서 그림 위로 훑는 선이 오가고,
 * 바뀐 줄에 색이 칠해지며 변화 조각이 오른쪽으로 날아간다. 화면 읽기 도구에는 숨기고, 동작 줄이기면 멈춘 그림이다.
 */
export function CompareScene() {
  return (
    <div className="compare-scene" aria-hidden="true">
      <Doc label="이전 보고서" lines={PREVIOUS_LINES} />
      <div className="compare-scene__middle">
        {FLYING.map((chip, index) => (
          <span key={chip.text} className={`compare-scene__chip compare-scene__chip--${chip.tone}`} style={{ '--i': index } as CSSProperties}>
            {chip.text}
          </span>
        ))}
        <svg className="compare-scene__arrow" width="64" height="24" viewBox="0 0 64 24">
          <path d="M2 12h58M50 4l10 8-10 8" />
        </svg>
      </div>
      <Doc label="현재 보고서" lines={CURRENT_LINES} />
    </div>
  )
}

type Line = number | readonly [string, number]

function Doc({ label, lines }: { label: string; lines: readonly Line[] }) {
  return (
    <div className="compare-scene__doc">
      <span className="compare-scene__label">{label}</span>
      {lines.map((line, index) => {
        const [tone, width] = typeof line === 'number' ? [null, line] : line
        return (
          <span
            key={index}
            className={tone === null ? 'compare-scene__line' : `compare-scene__line compare-scene__line--${tone}`}
            style={{ width: `${width}%`, '--i': index } as CSSProperties}
          />
        )
      })}
      <span className="compare-scene__scan" />
    </div>
  )
}
