import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import { useElementWidth } from '@/shared/hooks/useElementWidth'
import { cx } from '@/shared/lib/cx'
import {
  clusterCountLabel,
  clusterPreview,
  dotTimelineReducer,
  INITIAL_DOT_TIMELINE,
  layoutTimeline,
  nextItemId,
  tooltipAlign,
  type PlacedCluster,
  type PlacedItem,
  type PlacedPoint,
  type TimelineKey,
} from '@/shared/lib/dotTimeline'
import { formatDate, formatDateRange } from '@/shared/lib/reportLabels'
import { Button } from './Button'

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
  /** 마름모로 그려 다른 점과 모양으로 구분한다. 모음 점에 넣지 않고 늘 하나씩 그린다 */
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
  /** 모음 점 툴팁의 '외 N건은 표로 보기'를 누르면 부른다(같은 자료의 표 보기로 바꾸기). 없으면 글자로만 알린다 */
  onShowTable?: () => void
}

const KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

/**
 * 점 타임라인(FS-58, design-system.md 4-20). 가로는 시간축(월 눈금) 하나, 세로는 이름 붙은 줄이고 하나가 점 하나다.
 * 색은 한 가지이고 줄 위치·이름으로 묶음을 나눈다. emphasis 점은 마름모로 모양을 바꾼다.
 * 같은 줄에서 화면상 붙은 점이 비키기 자리 수(3)보다 많으면 건수를 쓴 모음 점 하나로 그린다(차트 폭이 바뀌면 다시 묶는다).
 * hover·키보드 초점에서 툴팁을 보이고, 점을 누르면(Enter) 원문을 새 창으로 연다.
 * 모음 점을 누르면(Enter·클릭) 툴팁(공시 제목 5개까지, 각각 원문 링크)을 고정해 열고 Esc·바깥 누르기로 닫는다.
 * 키보드: 점 묶음에 Tab으로 한 번 들어오고(로빙 tabindex) 좌우 화살표로 가로 순서, 위아래로 이웃 줄, Home·End로 처음·끝,
 * Esc로 툴팁을 닫는다. 모음 점은 대상 하나다. 툴팁 안의 링크는 점 다음 Tab으로 간다.
 * 툴팁에만 있는 값이 없도록 같은 자료의 표 보기는 부르는 쪽이 함께 둔다.
 */
export function DotTimeline({
  rows,
  points,
  from,
  to,
  label,
  emphasisLabel,
  otherLabel,
  unit = '건',
  onShowTable,
}: DotTimelineProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(areaRef)
  const layout = useMemo(() => layoutTimeline(rows, points, from, to, width), [rows, points, from, to, width])
  const [state, dispatch] = useReducer(dotTimelineReducer, INITIAL_DOT_TIMELINE)
  const refs = useRef(new Map<string, HTMLElement>())
  const tooltipId = useId()

  const newestId = layout.items.at(-1)?.id ?? null
  const activeId = layout.items.some((p) => p.id === state.activeId) ? state.activeId : newestId
  const active = layout.items.find((p) => p.id === activeId) ?? null
  // 폭이 바뀌어 가리키던 대상이 없어지면 툴팁도 닫힌 것으로 본다
  const open = state.open && active !== null && active.id === state.activeId

  // 고정한 툴팁은 차트 바깥을 누르면 닫는다(포인터로 눌러도 초점이 옮겨지지 않는 브라우저가 있어 따로 듣는다)
  useEffect(() => {
    if (!state.pinned) return
    function onPointerDown(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && plotRef.current?.contains(event.target)) return
      dispatch({ type: 'close' })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [state.pinned])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement)) return
    const onPoint = Boolean(event.target.dataset.pointId)
    if (event.key === 'Escape') {
      // 툴팁 안에서 닫았으면 그 툴팁을 연 점으로 초점을 돌린다(초점에서 다시 열리지 않게 닫기를 뒤에 둔다)
      if (!onPoint && activeId !== null) refs.current.get(activeId)?.focus()
      dispatch({ type: 'close' })
      return
    }
    if (!KEYS.includes(event.key) || !onPoint) return
    event.preventDefault()
    const next = nextItemId(layout.items, activeId, event.key as TimelineKey)
    if (next === null) return
    dispatch({ type: 'focus', id: next })
    refs.current.get(next)?.focus()
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    dispatch({ type: 'close' })
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(document.activeElement)) return
    dispatch({ type: 'leave' })
  }

  function register(id: string) {
    return (el: HTMLElement | null) => {
      if (el) refs.current.set(id, el)
      else refs.current.delete(id)
    }
  }

  const hasCluster = layout.items.some((item) => item.kind === 'cluster')

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
          {hasCluster && (
            <li>
              <span className="dot-timeline__mark dot-timeline__mark--cluster" aria-hidden="true">
                N
              </span>
              가까운 공시 N{unit} 모음
            </li>
          )}
        </ul>
      )}
      <div
        ref={plotRef}
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
        <div ref={areaRef} className="dot-timeline__area">
          {layout.ticks.map((tick) => (
            <span key={tick.date} className="dot-timeline__grid" style={{ left: `${tick.x}%` }} aria-hidden="true" />
          ))}
          {rows.map((row, index) => (
            <div key={row.key} className="dot-timeline__track">
              {layout.items
                .filter((item) => item.rowIndex === index)
                .map((item) =>
                  match(item)
                    .with({ kind: 'point' }, (placed) => (
                      <TimelinePoint
                        key={placed.id}
                        placed={placed}
                        rowLabel={row.label}
                        focusable={placed.id === activeId}
                        register={register(placed.id)}
                        onHover={() => dispatch({ type: 'hover', id: placed.id })}
                        onFocus={() => dispatch({ type: 'focus', id: placed.id })}
                      />
                    ))
                    .with({ kind: 'cluster' }, (cluster) => (
                      <TimelineCluster
                        key={cluster.id}
                        cluster={cluster}
                        rowLabel={row.label}
                        unit={unit}
                        focusable={cluster.id === activeId}
                        expanded={open && cluster.id === activeId}
                        tooltipId={tooltipId}
                        register={register(cluster.id)}
                        onHover={() => dispatch({ type: 'hover', id: cluster.id })}
                        onFocus={() => dispatch({ type: 'focus', id: cluster.id })}
                        onToggle={() => dispatch({ type: 'toggle-pin', id: cluster.id })}
                      />
                    ))
                    .exhaustive(),
                )}
              {open && active?.rowIndex === index && (
                <TimelineTooltip
                  id={tooltipId}
                  item={active}
                  rowLabel={row.label}
                  rowCount={rows.length}
                  unit={unit}
                  pinned={state.pinned}
                  onShowTable={onShowTable}
                />
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
  onHover: () => void
  onFocus: () => void
}

function TimelinePoint({ placed, rowLabel, focusable, register, onHover, onFocus }: TimelinePointProps) {
  const { point, x, lane } = placed
  const name = `${point.title}, ${formatDate(point.date)} 접수, ${rowLabel}`
  const common = {
    className: cx('dot-timeline__point', point.emphasis && 'dot-timeline__point--emphasis'),
    style: { left: `${x}%`, '--lane': lane } as CSSProperties,
    tabIndex: focusable ? 0 : -1,
    'data-point-id': point.id,
    onPointerEnter: onHover,
    onFocus,
  }
  const mark = <span className="dot-timeline__dot" aria-hidden="true" />
  if (point.href === null) {
    return (
      <button type="button" ref={register} aria-label={`${name}, 원문 링크 확인 안 됨`} onClick={onFocus} {...common}>
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

interface TimelineClusterProps {
  cluster: PlacedCluster<DotTimelinePoint>
  rowLabel: string
  unit: string
  focusable: boolean
  expanded: boolean
  tooltipId: string
  register: (el: HTMLElement | null) => void
  onHover: () => void
  onFocus: () => void
  onToggle: () => void
}

/** 모음 점: 건수를 쓴 조금 큰 동그라미. 누르면(Enter·클릭) 툴팁을 고정해 열고 다시 누르면 닫는다 */
function TimelineCluster({
  cluster,
  rowLabel,
  unit,
  focusable,
  expanded,
  tooltipId,
  register,
  onHover,
  onFocus,
  onToggle,
}: TimelineClusterProps) {
  const { x, size, points, from, to } = cluster
  return (
    <button
      type="button"
      ref={register}
      className={cx('dot-timeline__point', 'dot-timeline__cluster', `dot-timeline__cluster--size-${size}`)}
      style={{ left: `${x}%`, '--lane': 0 } as CSSProperties}
      tabIndex={focusable ? 0 : -1}
      data-point-id={cluster.id}
      aria-label={`${rowLabel} 공시 ${points.length}${unit} 모음, ${formatDateRange(from, to)} 접수`}
      aria-expanded={expanded}
      aria-controls={expanded ? tooltipId : undefined}
      onPointerEnter={onHover}
      onFocus={onFocus}
      onClick={onToggle}
    >
      <span className="dot-timeline__cluster-dot" aria-hidden="true">
        {clusterCountLabel(points.length)}
      </span>
    </button>
  )
}

interface TimelineTooltipProps {
  id: string
  item: PlacedItem<DotTimelinePoint>
  rowLabel: string
  rowCount: number
  unit: string
  pinned: boolean
  onShowTable?: () => void
}

function TimelineTooltip({ id, item, rowLabel, rowCount, unit, pinned, onShowTable }: TimelineTooltipProps) {
  const { x, rowIndex } = item
  const lane = match(item)
    .with({ kind: 'point' }, (p) => p.lane)
    .with({ kind: 'cluster' }, () => 0)
    .exhaustive()
  // 위쪽 두 줄은 점 아래로, 나머지는 점 위로 띄워 차트 밖으로 덜 나가게 한다
  const below = rowIndex < Math.min(2, rowCount - 1)
  return (
    <div
      id={id}
      className={cx(
        'dot-timeline__tooltip',
        `dot-timeline__tooltip--${tooltipAlign(x)}`,
        below ? 'dot-timeline__tooltip--below' : 'dot-timeline__tooltip--above',
        item.kind === 'cluster' && `dot-timeline__cluster--size-${item.size}`,
        pinned && 'dot-timeline__tooltip--pinned',
      )}
      style={{ left: `${x}%`, '--lane': lane } as CSSProperties}
    >
      {match(item)
        .with({ kind: 'point' }, ({ point }) => <PointTooltipBody point={point} rowLabel={rowLabel} />)
        .with({ kind: 'cluster' }, (cluster) => (
          <ClusterTooltipBody cluster={cluster} rowLabel={rowLabel} unit={unit} onShowTable={onShowTable} />
        ))
        .exhaustive()}
    </div>
  )
}

function PointTooltipBody({ point, rowLabel }: { point: DotTimelinePoint; rowLabel: string }) {
  return (
    <>
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
    </>
  )
}

interface ClusterTooltipBodyProps {
  cluster: PlacedCluster<DotTimelinePoint>
  rowLabel: string
  unit: string
  onShowTable?: () => void
}

/** 모음 점 툴팁: 묶음·건수, 기간, 최근 공시 제목 5개까지(각각 원문 링크), 나머지 건수 */
function ClusterTooltipBody({ cluster, rowLabel, unit, onShowTable }: ClusterTooltipBodyProps) {
  const { shown, rest } = clusterPreview(cluster)
  return (
    <>
      <strong className="dot-timeline__tooltip-title">
        {rowLabel} {cluster.points.length}
        {unit}
      </strong>
      <span className="dot-timeline__tooltip-meta">{formatDateRange(cluster.from, cluster.to)} 접수 · 최근 순서</span>
      <ul className="dot-timeline__tooltip-list">
        {shown.map((point) => (
          <li key={point.id}>
            <time className="dot-timeline__tooltip-date" dateTime={point.date}>
              {formatDate(point.date).slice(5)}
            </time>
            {point.href === null ? (
              <span>
                {point.title}
                <span className="dot-timeline__tooltip-meta"> (원문 링크 확인 안 됨)</span>
              </span>
            ) : (
              <a href={point.href} target="_blank" rel="noopener noreferrer">
                {point.title}
                <span className="visually-hidden"> ({formatDate(point.date)} 접수, DART 원문 새 창)</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      {rest > 0 &&
        (onShowTable ? (
          <Button variant="link" className="dot-timeline__tooltip-more" onClick={onShowTable}>
            외 {rest}
            {unit}은 표로 보기
          </Button>
        ) : (
          <span className="dot-timeline__tooltip-meta">
            외 {rest}
            {unit}은 표로 볼 수 있어요
          </span>
        ))}
    </>
  )
}
