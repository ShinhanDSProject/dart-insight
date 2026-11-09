import { useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { TextChangeItem, TextListGroup, TextSort } from '@/shared/api/textChanges'
import { Button, Skeleton } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useTextChangeGroup } from '../hooks/useTextChanges'
import { resultCountLabel } from '../model/textFilter'
import { FOLDED_NOTE, FOLDED_TITLE, foldedGroups, foldedTotal, type FoldedGroup, type GroupCounts } from '../model/textGroups'
import { TextListFooter } from './TextListFooter'

interface TextFoldedGroupsProps {
  analysisId: number
  counts: GroupCounts
  sort: TextSort
  /** 받은 변경을 카드 목록으로 그린다 */
  renderList: (items: TextChangeItem[]) => ReactNode
}

/** 기본 목록에서 접은 변경의 묶음(3.29). 건수는 분석 전체를 세고, 묶음의 변경은 처음 펼칠 때 불러온다 */
export function TextFoldedGroups({ analysisId, counts, sort, renderList }: TextFoldedGroupsProps) {
  const [opened, setOpened] = useState<ReadonlySet<TextListGroup>>(new Set())
  // 처음에는 묶음 줄도 접어 한 줄 버튼만 보인다(3.55)
  const [shown, setShown] = useState(false)
  const groups = foldedGroups(counts)
  if (groups.length === 0) return null
  const toggle = (group: TextListGroup) => {
    const next = new Set(opened)
    if (!next.delete(group)) next.add(group)
    setOpened(next)
  }
  return (
    <section className="text-folded" aria-labelledby="text-folded-title">
      {/* 전체 변경 맨 아래 한 줄: 여는 버튼과 묶음 이름(3.59) */}
      <div className="text-folded__line">
        <h3 id="text-folded-title" className="text-folded__title">
          <button
            type="button"
            className="text-folded__toggle"
            aria-expanded={shown}
            aria-controls={shown ? 'text-folded-groups' : undefined}
            onClick={() => setShown((v) => !v)}
          >
            {FOLDED_TITLE} {resultCountLabel(foldedTotal(counts))} {shown ? '접기 ▴' : '보기 ▾'}
          </button>
        </h3>
        {!shown && <span className="panel__note">{groups.map((entry) => entry.label).join(', ')}</span>}
      </div>
      {shown && (
        <div id="text-folded-groups" className="text-folded__groups">
          <p className="panel__note">{FOLDED_NOTE}</p>
          {groups.map((entry) => (
            <FoldedGroupRow
              key={entry.group}
              entry={entry}
              open={opened.has(entry.group)}
              onToggle={() => toggle(entry.group)}
              analysisId={analysisId}
              sort={sort}
              renderList={renderList}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface FoldedGroupRowProps {
  entry: FoldedGroup
  open: boolean
  onToggle: () => void
  analysisId: number
  sort: TextSort
  renderList: (items: TextChangeItem[]) => ReactNode
}

function FoldedGroupRow({ entry, open, onToggle, analysisId, sort, renderList }: FoldedGroupRowProps) {
  const listId = `text-folded-${entry.group}`
  return (
    <div className="text-folded__group">
      <div className="text-folded__head">
        <Button variant="secondary" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={onToggle}>
          {entry.label} {resultCountLabel(entry.count)} {open ? '접기' : '펼치기'}
        </Button>
        <span className="panel__note">{entry.description}</span>
      </div>
      {open && (
        <div id={listId} className="text-folded__list">
          <FoldedGroupList analysisId={analysisId} group={entry.group} sort={sort} renderList={renderList} />
        </div>
      )}
    </div>
  )
}

interface FoldedGroupListProps {
  analysisId: number
  group: TextListGroup
  sort: TextSort
  renderList: (items: TextChangeItem[]) => ReactNode
}

function FoldedGroupList({ analysisId, group, sort, renderList }: FoldedGroupListProps) {
  const { state, reload, loadMore } = useTextChangeGroup(analysisId, group, sort)
  return match(state)
    .with({ status: 'loading' }, () => <Skeleton label="접어 둔 변경을 불러오는 중입니다…" shape="card" count={2} />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
    .with({ status: 'success' }, ({ data, items, more }) => (
      <>
        {renderList(items)}
        <TextListFooter loaded={items.length} total={data.totalItems} more={more} onMore={loadMore} />
      </>
    ))
    .exhaustive()
}
