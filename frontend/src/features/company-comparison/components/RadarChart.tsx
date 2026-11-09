import { useId } from 'react'
import { formatRadarValue, RADAR_AXES, radarEdges, radarRadii, type RadarSeries } from '../model/radarChart'

const SIZE = { width: 440, height: 340 }
const CENTER = { x: SIZE.width / 2, y: SIZE.height / 2 }
const RADIUS = 120
const RINGS = [0.25, 0.5, 0.75, 1]

/** 축 i 위 반지름 r(0~1) 점. 첫 축은 위쪽이고 시계 방향으로 돈다 */
function point(axis: number, r: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * axis) / RADAR_AXES.length - Math.PI / 2
  return { x: CENTER.x + Math.cos(angle) * RADIUS * r, y: CENTER.y + Math.sin(angle) * RADIUS * r }
}

function polygon(radii: readonly number[]): string {
  return radii
    .map((r, axis) => point(axis, r))
    .map(({ x, y }) => `${x},${y}`)
    .join(' ')
}

/** 축 이름은 그래프 바깥쪽으로 붙인다 */
function anchorOf(x: number): 'middle' | 'start' | 'end' {
  if (Math.abs(x - CENTER.x) < 1) return 'middle'
  return x > CENTER.x ? 'start' : 'end'
}

/**
 * 기업 나란히 보기 방사형 그래프(#778). 표를 대신하지 않고 표 위에서 기업끼리 차이가 큰 축을 보여 준다.
 * 색은 고른 순서의 범주 색(series-1~4)이고 좋고 나쁨을 뜻하지 않는다. 계산 불가 값은 점을 찍지 않고 범례에 적는다.
 */
export function RadarChart({ series }: { series: readonly RadarSeries[] }) {
  const titleId = useId()
  const radii = radarRadii(series)
  return (
    <figure className="radar-chart">
      <svg
        className="radar-chart__svg"
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {`${series.map((s) => s.name).join(', ')}의 ${RADAR_AXES.join('·')}을 겹쳐 그린 방사형 그래프. 정확한 값은 아래 표에 있어요.`}
        </title>
        {RINGS.map((r) => (
          <polygon key={r} className="radar-chart__ring" points={polygon(RADAR_AXES.map(() => r))} />
        ))}
        {RADAR_AXES.map((name, axis) => {
          const end = point(axis, 1)
          const label = point(axis, 1.18)
          return (
            <g key={name}>
              <line className="radar-chart__axis" x1={CENTER.x} y1={CENTER.y} x2={end.x} y2={end.y} />
              <text className="radar-chart__label" x={label.x} y={label.y} textAnchor={anchorOf(label.x)} dominantBaseline="middle">
                {name}
              </text>
            </g>
          )
        })}
        {series.map((s, index) => (
          <g key={s.corpCode} className={`radar-chart__series radar-chart__series--${index + 1}`}>
            {/* 계산 불가 축이 있으면 면을 닫지 않고, 값이 있는 이웃 축끼리만 잇는다 */}
            {radii[index].every((r) => r !== null) ? (
              <polygon className="radar-chart__area" points={polygon(radii[index])} />
            ) : (
              radarEdges(radii[index]).map(([from, to]) => {
                const a = point(from, radii[index][from] as number)
                const b = point(to, radii[index][to] as number)
                return <line key={from} className="radar-chart__edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              })
            )}
            {radii[index].map((r, axis) => {
              if (r === null) return null
              const { x, y } = point(axis, r)
              return (
                <circle key={RADAR_AXES[axis]} className="radar-chart__dot" cx={x} cy={y} r={4}>
                  <title>{`${s.name} · ${RADAR_AXES[axis]} ${formatRadarValue(axis, s.values[axis])}`}</title>
                </circle>
              )
            })}
          </g>
        ))}
      </svg>
      <figcaption className="radar-chart__caption">
        <ul className="radar-chart__legend">
          {series.map((s, index) => {
            const missing = RADAR_AXES.filter((_, axis) => s.values[axis] === null)
            return (
              <li key={s.corpCode} className="radar-chart__legend-item">
                <span className={`radar-chart__swatch radar-chart__swatch--${index + 1}`} aria-hidden="true" />
                <span>{s.name}</span>
                {missing.length > 0 && <span className="radar-chart__missing">계산 불가 · {missing.join(', ')}</span>}
              </li>
            )
          })}
        </ul>
        <p className="radar-chart__note">
          모양은 고른 기업끼리의 상대 크기예요. 축마다 가장 작은 값이 안쪽, 가장 큰 값이 바깥쪽이고, 좋고 나쁨이나 순위가 아니에요.
          증가율은 전년 동기 대비이고, 정확한 값은 아래 표에 있어요.
        </p>
      </figcaption>
    </figure>
  )
}
