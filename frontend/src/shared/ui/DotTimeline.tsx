import { useId, useReducer, useRef, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { cx } from '@/shared/lib/cx'
import {
  dotTimelineReducer,
  INITIAL_DOT_TIMELINE,
  layoutTimeline,
  nextPointId,
  tooltipAlign,
  type PlacedPoint,
  type TimelineKey,
} from '@/shared/lib/dotTimeline'
import { formatDate } from '@/shared/lib/reportLabels'

export interface DotTimelineRow {
  key: string
  label: string
  /** 줄 왼쪽에 보이는 건수(기간 전체) */
  count: number
}

export interface DotTimelinePoint {
  id: string
  /** DotTimelineRow.key */
  row: string
  /** YYYY-MM-DD */
  date: string
  title: string
  /** 누르면 새 창으로 여는 원문 주소. 확인하지 못했으면 null(점은 툴팁만 연다) */
  href: string | null
  /** 마름모로 그려 다른 점과 모양으로 구분한다 */
  emphasis?: boolean
  /** 툴팁 안에 두는 앱 안 동작(예: 이 보고서로 비교하기) */
  action?: { label: string; to: string }
}

interface DotTimelineProps {
  rows: readonly DotTimelineRow[]
  points: readonly DotTimelinePoint[]
  /** 가로축 기간(YYYY-MM-DD) */
  from: string
  to: string
  /** 차트 묶음의 접근 가능한 이름 */
  label: string
  /** emphasis 점(마름모)의 범례 이름. 없으면 범례를 두지 않는다 */
  emphasisLabel?: string
  /** emphasis가 아닌 점(동그라미)의 범례 이름 */
  otherLabel?: string
  /** 건수 단위(기본 '건') */
  unit?: string
}

const KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

/**
 * 점 타임라인(FS-58, design-system.md 4-20). 가로는 시간축(월 눈금) 하나, 세로는 이름 붙은 줄이고 하나가 점 하나다.
 * 색은 한 가지이고 줄 위치·이름으로 묶음을 나눈다. emphasis 점은 마름모로 모양을 바꾼다.
 * hover·키보드 초점에서 툴팁(제목·날짜·줄)을 보이고, 누르면(Enter) 원문을 새 창으로 연다.
 * 키보드: 점 묶음에 Tab으로 한 번 들어오고(로빙 tabindex) 좌우 화살표로 시간 순서, 위아래로 이웃 줄, Home·End로 처음·끝,
 * Esc로 툴팁을 닫는다. 툴팁의 동작 링크는 점 다음 Tab으로 간다.
 * 툴팁에만 있는 값이 없도록 같은 자료의 표 보기는 부르는 쪽이 함께 둔다.
 */
export function DotTimeline({ rows, points, from, to, label, emphasisLabel, otherLabel, unit = '건' }: DotTimelineProps) {
  const layout = layoutTimeline(rows, points, from, to)
  const [state, dispatch] = useReducer(dotTimelineReducer, INITIAL_DOT_TIMELINE)
  const refs = useRef(new Map<string, HTMLElement>())
  const tooltipId = useId()

  const newestId = layout.placed.at(-1)?.point.id ?? null
  const activeId = layout.placed.some((p) => p.point.id === state.activeId) ? state.activeId : newestId
  const active = layout.placed.find((p) => p.point.id === activeId) ?? null

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      dispatch({ type: 'hide' })
      return
    }
    if (!KEYS.includes(event.key) || !(event.target instanceof HTMLElement) || !event.target.dataset.pointId) return
    event.preventDefault()
    const next = nextPointId(layout.placed, activeId, event.key as TimelineKey)
    if (next === null) return
    dispatch({ type: 'show', id: next })
    refs.current.get(next)?.focus()
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    dispatch({ type: 'hide' })
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(document.activeElement)) return
    dispatch({ type: 'hide' })
  }

  return (
    <div className="dot-timeline">
      {emphasisLabel && (
        <ul className="dot-timeline__legend" aria-label="점 모양">
          <li>
            <span className="dot-timeline__mark dot-timeline__mark--emphasis" aria-hidden="true" />
            {emphasisLabel}
          </li>
          {otherLabel && (
            <li>
              <span className="dot-timeline__mark" aria-hidden="true" />
              {otherLabel}
            </li>
          )}
        </ul>
      )}
      <div
        className="dot-timeline__plot"
        role="group"
        aria-label={`${label}. 화살표 키로 점을 옮기고 Enter로 열어요.`}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPointerLeave={onPointerLeave}
        style={{ '--dot-timeline-rows': rows.length } as CSSProperties}
      >
        {rows.map((row, index) => (
          <span key={row.key} className="dot-timeline__label" style={{ gridRow: index + 1 }}>
            <span className="dot-timeline__name">{row.label}</span>
            <span className="dot-timeline__count">
              {row.count}
              {unit}
            </span>
          </span>
        ))}
        <div className="dot-timeline__area">
          {layout.ticks.map((tick) => (
            <span key={tick.date} className="dot-timeline__grid" style={{ left: `${tick.x}%` }} aria-hidden="true" />
          ))}
          {rows.map((row, index) => (
            <div key={row.key} className="dot-timeline__track">
              {layout.placed
                .filter((p) => p.rowIndex === index)
                .map((placed) => (
                  <TimelinePoint
                    key={placed.point.id}
                    placed={placed}
                    rowLabel={row.label}
                    focusable={placed.point.id === activeId}
                    register={(el) => {
                      if (el) refs.current.set(placed.point.id, el)
                      else refs.current.delete(placed.point.id)
                    }}
                    onShow={() => dispatch({ type: 'show', id: placed.point.id })}
                  />
                ))}
              {state.open && active?.rowIndex === index && (
                <TimelineTooltip id={tooltipId} placed={active} rowLabel={row.label} rowCount={rows.length} />
              )}
            </div>
          ))}
        </div>
        <div className="dot-timeline__axis" aria-hidden="true">
          {layout.ticks.map((tick) => (
            <span
              key={tick.date}
              className={cx('dot-timeline__tick', tick.major && 'dot-timeline__tick--major')}
              style={{ left: `${tick.x}%` }}
            >
              <span className="dot-timeline__tick-label">{tick.label}</span>
              {tick.yearLabel && <span className="dot-timeline__year">{tick.yearLabel}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface TimelinePointProps {
  placed: PlacedPoint<DotTimelinePoint>
  rowLabel: string
  focusable: boolean
  register: (el: HTMLElement | null) => void
  onShow: () => void
}

function TimelinePoint({ placed, rowLabel, focusable, register, onShow }: TimelinePointProps) {
  const { point, x, lane } = placed
  const name = `${point.title}, ${formatDate(point.date)} 접수, ${rowLabel}`
  const common = {
    className: cx('dot-timeline__point', point.emphasis && 'dot-timeline__point--emphasis'),
    style: { left: `${x}%`, '--lane': lane } as CSSProperties,
    tabIndex: focusable ? 0 : -1,
    'data-point-id': point.id,
    onPointerEnter: onShow,
    onFocus: onShow,
  }
  const mark = <span className="dot-timeline__dot" aria-hidden="true" />
  if (point.href === null) {
    return (
      <button type="button" ref={register} aria-label={`${name}, 원문 링크 확인 안 됨`} onClick={onShow} {...common}>
        {mark}
      </button>
    )
  }
  return (
    <a
      ref={register}
      href={point.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name}, DART 원문 새 창`}
      {...common}
    >
      {mark}
    </a>
  )
}

interface TimelineTooltipProps {
  id: string
  placed: PlacedPoint<DotTimelinePoint>
  rowLabel: string
  rowCount: number
}

function TimelineTooltip({ id, placed, rowLabel, rowCount }: TimelineTooltipProps) {
  const { point, x, lane, rowIndex } = placed
  // 위쪽 두 줄은 점 아래로, 나머지는 점 위로 띄워 차트 밖으로 덜 나가게 한다
  const below = rowIndex < Math.min(2, rowCount - 1)
  return (
    <div
      id={id}
      className={cx(
        'dot-timeline__tooltip',
        `dot-timeline__tooltip--${tooltipAlign(x)}`,
        below ? 'dot-timeline__tooltip--below' : 'dot-timeline__tooltip--above',
      )}
      style={{ left: `${x}%`, '--lane': lane } as CSSProperties}
    >
      <strong className="dot-timeline__tooltip-title">{point.title}</strong>
      <span className="dot-timeline__tooltip-meta">
        {formatDate(point.date)} 접수 · {rowLabel}
      </span>
      <span className="dot-timeline__tooltip-meta">
        {point.href === null ? '원문 링크를 확인하지 못했어요' : '누르면 DART 원문이 새 창으로 열려요'}
      </span>
      {point.action && (
        <Link className="dot-timeline__tooltip-action" to={point.action.to}>
          {point.action.label}
          <span className="visually-hidden"> ({point.title})</span>
        </Link>
      )}
    </div>
  )
}
