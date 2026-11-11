import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatInteger } from '@/shared/lib/numberFormat'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui'
import { barPercent } from '../model/adminConsole'

/** 콘솔 화면 머리: 제목·설명과 오른쪽 조작 */
export function ConsoleHeader({ title, lead, aside }: { title: string; lead: ReactNode; aside?: ReactNode }) {
  return (
    <header className="console-head">
      <div>
        <h1 className="console-head__title">{title}</h1>
        <p className="console-head__lead">{lead}</p>
      </div>
      {aside && <div className="console-head__aside">{aside}</div>}
    </header>
  )
}

/** 핵심 지표 한 칸. tone은 주의가 필요할 때만(색만으로 구분하지 않도록 보조 문구를 함께 씀) */
export function KpiTile({
  label,
  value,
  detail,
  tone = 'default',
  to,
}: {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'attention' | 'danger'
  /** 누르면 갈 곳(예: 신고 처리) */
  to?: string
}) {
  const body = (
    <>
      <span className="kpi__bar" aria-hidden="true" />
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      <span className="kpi__detail">{detail}</span>
    </>
  )
  return to ? (
    <Link to={to} className={cx('kpi', 'kpi--link', `kpi--${tone}`)}>
      {body}
    </Link>
  ) : (
    <div className={cx('kpi', `kpi--${tone}`)}>{body}</div>
  )
}

/** 제목이 있는 콘솔 카드 */
export function ConsoleCard({
  title,
  note,
  className,
  children,
  titleId,
}: {
  title: string
  note?: ReactNode
  className?: string
  children: ReactNode
  titleId: string
}) {
  return (
    <section className={cx('console-card', className)} aria-labelledby={titleId}>
      <div className="console-card__head">
        <h2 className="console-card__title" id={titleId}>
          {title}
        </h2>
        {note && <span className="console-card__note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

export interface RankRow {
  key: string
  label: string
  value: number
  /** 누르면 갈 곳 */
  to?: string
}

/** 이름 · 막대 · 수 목록(상위 기업, 요금제별 관심). 막대는 가장 큰 값 기준이고 수는 글자로 함께 둔다. 0이면 막대를 그리지 않는다 */
export function RankList({ rows, label, tone = 'current' }: { rows: RankRow[]; label: string; tone?: 'current' | 'accent' }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  return (
    <ul className="rank" aria-label={label}>
      {rows.map((row, i) => (
        <li key={row.key} className="rank__row">
          <span className="rank__idx" aria-hidden="true">{i + 1}</span>
          {row.to ? (
            <Link to={row.to} className="rank__name">
              {row.label}
            </Link>
          ) : (
            <span className="rank__name">{row.label}</span>
          )}
          <span className="rank__track" aria-hidden="true">
            {row.value > 0 && (
              <span className={cx('rank__bar', `rank__bar--${tone}`)} style={{ width: `${barPercent(row.value, max)}%` }} />
            )}
          </span>
          <span className="rank__value">{formatInteger(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** 쪽 넘기기: 'N건 중 a–b'와 이전·다음 */
export function Pager({
  page,
  last,
  total,
  size,
  onChange,
}: {
  page: number
  last: number
  total: number
  size: number
  onChange: (page: number) => void
}) {
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)
  return (
    <div className="pager">
      <span className="pager__range">
        {formatInteger(total)}건 중 {formatInteger(from)}–{formatInteger(to)}
      </span>
      <Button variant="secondary" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        이전
      </Button>
      <Button variant="secondary" disabled={page >= last} onClick={() => onChange(page + 1)}>
        다음
      </Button>
    </div>
  )
}
