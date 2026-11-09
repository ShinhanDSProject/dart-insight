import { useRef, useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { Button } from '@/shared/ui'
import { EmptyState } from '@/shared/ui/StateView'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { TEXT_CARD_ATTRIBUTE } from '../hooks/useTextCardKeys'
import { RISK_BADGE } from '../model/riskChanges'
import { cardTypeLabel } from '../model/rowDiff'
import { rowPreviewText, sectionRuns, type TextDetail } from '../model/textBrowse'

interface TextChangeBrowserProps {
  items: TextChangeItem[]
  /** 거른 결과 전체 건수(더 불러오기 전 포함) */
  total: number
  /** 목차 머리줄로 묶을지. 문서 순서일 때만 묶는다 */
  grouped: boolean
  detail: TextDetail
  onSelect: (changeId: number) => void
  /** 상세 칸 머리줄 오른쪽에 둘 도구(합쳐 보기 전환 등) */
  detailTools?: ReactNode
  renderDetail: (item: TextChangeItem) => ReactNode
  /** 목록에 없는 변경을 주소로 골랐을 때 원문 비교 창으로 연다 */
  onOpenOutside: (changeId: number) => void
  /** 목록 아래(더 보기 등) */
  footer?: ReactNode
}

type Pane = 'list' | 'detail'

/** 목록과 상세가 한 칸씩 보이는 좁은 화면인지. analysis-result.css의 .change-browser 기준 폭과 같다 */
const NARROW_QUERY = '(max-width: 900px)'

function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
}

/**
 * 전체 변경의 목록·상세 보기(3.54). 넓은 화면은 왼쪽 목록과 오른쪽 상세를 함께 보이고,
 * 좁은 화면은 목록만 보이다가 줄을 고르면 상세로 넘어가고 '목록으로'로 돌아온다(CSS가 칸을 숨김).
 * 목록 줄은 키보드 이동(j·k) 대상이고, 상세의 카드는 이동 대상에서 뺀다.
 */
export function TextChangeBrowser({
  items,
  total,
  grouped,
  detail,
  onSelect,
  detailTools,
  renderDetail,
  onOpenOutside,
  footer,
}: TextChangeBrowserProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [pane, setPane] = useState<Pane>('list')
  const detailRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const selectedId = detail.kind === 'item' ? detail.item.changeId : null
  const runs = grouped ? sectionRuns(items) : [{ key: 'all', sectionPath: '', items }]

  const choose = (changeId: number, openDetail: boolean) => {
    // 고른 변경이 접힌 묶음 안이면 그 묶음을 편다
    setCollapsed((current) => {
      const run = runs.find((r) => r.items.some((i) => i.changeId === changeId))
      if (run === undefined || !current.has(run.key)) return current
      const next = new Set(current)
      next.delete(run.key)
      return next
    })
    onSelect(changeId)
    if (openDetail) {
      setPane('detail')
      // 좁은 화면에서만 상세로 초점을 옮긴다. 넓은 화면은 줄에 남아 j·k로 이어 옮길 수 있다
      if (isNarrow()) requestAnimationFrame(() => detailRef.current?.focus())
    }
  }
  const step = (by: number) => {
    if (detail.kind !== 'item') return
    const target = items[detail.index + by]
    if (target !== undefined) choose(target.changeId, false)
  }
  const backToList = () => {
    setPane('list')
    requestAnimationFrame(() => {
      const row = selectedId === null ? null : listRef.current?.querySelector<HTMLElement>(`[${TEXT_CARD_ATTRIBUTE}="${selectedId}"]`)
      row?.focus()
    })
  }
  const toggleRun = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="change-browser" data-pane={pane}>
      <nav className="change-browser__list" aria-label="변경 목록" ref={listRef}>
        {runs.map((run) => {
          const open = !collapsed.has(run.key)
          const listId = `change-run-${run.key.replace(/[^a-zA-Z0-9]/g, '')}-${run.items[0].changeId}`
          return (
            <div key={run.key} className="change-browser__run">
              {grouped && (
                <button
                  type="button"
                  className="change-browser__run-head"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggleRun(run.key)}
                >
                  <span className="change-browser__run-title">{displaySectionPath(run.sectionPath)}</span>
                  <span className="change-browser__run-count">
                    {run.items.length}건 <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                  </span>
                </button>
              )}
              {open && (
                <ol id={listId} className="change-browser__rows">
                  {run.items.map((item) => (
                    <li key={item.changeId}>
                      <ChangeRow
                        item={item}
                        withSection={!grouped}
                        selected={item.changeId === selectedId}
                        onChoose={() => choose(item.changeId, true)}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
        {footer}
      </nav>
      <section className="change-browser__detail" aria-label="고른 변경" tabIndex={-1} ref={detailRef}>
        <div className="change-browser__detail-head">
          <Button variant="secondary" className="change-browser__back" onClick={backToList}>
            ← 목록으로
          </Button>
          {detail.kind === 'item' && (
            <>
              <span className="panel__note" aria-live="polite">
                {detail.index + 1} / {total}
              </span>
              <Button variant="secondary" disabled={detail.index === 0} onClick={() => step(-1)}>
                ↑ 이전 (k)
              </Button>
              <Button variant="secondary" disabled={detail.index >= items.length - 1} onClick={() => step(1)}>
                다음 (j) ↓
              </Button>
            </>
          )}
          {detail.kind === 'item' && detailTools}
        </div>
        {match(detail)
          .with({ kind: 'item' }, ({ item }) => renderDetail(item))
          .with({ kind: 'outside' }, ({ changeId }) => (
            <EmptyState title="고른 변경이 지금 목록에 없어요">
              <p>거르기나 정렬 밖에 있는 변경이에요. 원문 비교 창으로 열어 볼 수 있어요.</p>
              <Button variant="secondary" onClick={() => onOpenOutside(changeId)}>
                원문 비교 열기
              </Button>
            </EmptyState>
          ))
          .with({ kind: 'none' }, () => null)
          .exhaustive()}
      </section>
    </div>
  )
}

function ChangeRow({ item, withSection, selected, onChoose }: { item: TextChangeItem; withSection: boolean; selected: boolean; onChoose: () => void }) {
  const typeLabel = cardTypeLabel(item)
  const text = rowPreviewText(item)
  return (
    <button
      type="button"
      className="change-row"
      data-change-type={item.changeType}
      aria-current={selected ? 'true' : undefined}
      {...{ [TEXT_CARD_ATTRIBUTE]: item.changeId }}
      onClick={onChoose}
    >
      <span className="change-row__dot" aria-hidden="true" />
      <span className="change-row__type">{typeLabel}</span>
      <span className="change-row__text">
        {withSection && <span className="change-row__section">{displaySectionPath(item.sectionPath)} · </span>}
        {text === '' ? '(글 없음)' : text}
      </span>
      {item.priority?.level === 'HIGH' && <span className="change-row__mark">높음</span>}
      {item.riskRelated && <span className="change-row__mark change-row__mark--risk">{RISK_BADGE}</span>}
    </button>
  )
}
