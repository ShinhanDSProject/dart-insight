import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem, TextField, TextSort } from '@/shared/api/textChanges'
import { Badge, Button, Card, Chip, FieldHint, FieldLabel, Icon, Input, MenuButton, MenuItem, Notice, Panel, SegmentedControl, Select, Skeleton } from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { communityQuotePath } from '@/shared/lib/communityQuoteLink'
import { AddToNote } from './AddToNote'
import { ChangeTypeHelp } from './ChangeTypeHelp'
import { CopyWithSourcesButton } from './CopyWithSourcesButton'
import { NumberChangesLine } from './NumberChangesLine'
import { RiskChangesCard } from './RiskChangesCard'
import { RowDiffBlock } from './RowDiffBlock'
import { SidePreview } from './SidePreview'
import { TextEventsArea } from './TextEventsSection'
import { TextEvidencePanel } from './TextEvidencePanel'
import { TextExplanationBox } from './TextExplanationBox'
import { TextFieldTable } from './TextFieldTable'
import { TextFoldedGroups } from './TextFoldedGroups'
import { TextListFooter } from './TextListFooter'
import { usePinnedChanges, usePinnedTextChanges } from '../hooks/usePinnedChanges'
import { useTextChanges } from '../hooks/useTextChanges'
import { useTextEvents } from '../hooks/useTextEvents'
import { useTextExplanations, type TextExplanations } from '../hooks/useTextExplanations'
import { useTextSearch } from '../hooks/useTextSearch'
import { TEXT_CARD_ATTRIBUTE, useTextCardKeys } from '../hooks/useTextCardKeys'
import { sectionAskQuestion } from '../model/askQuestion'
import { numberChanges } from '../model/numberChanges'
import { pinnedChangesText } from '../model/copyText'
import { RISK_BADGE, RISK_EMPTY } from '../model/riskChanges'
import { cardTypeLabel, comparedRowsOf, isNotCompared, isPairedPreviousTable, NOT_COMPARED_LABEL, NOT_COMPARED_NOTE, PAIRED_TABLE_CURRENT } from '../model/rowDiff'
import { PINNED_EMPTY, PINNED_LABEL, PINNED_NOTE } from '../model/pinnedList'
import type { SourceTarget, TextViewChange } from '../model/resultParams'
import {
  countFor,
  DELETED_NOTE,
  firstNotedIds,
  missingSideLabel,
  MOVED_NOTE,
  movedPaths,
  PRIORITY_NOTE,
  priorityLabel,
  showsNumbersOnlyMark,
  textStatusNotice,
  typeFilterLabel,
  typeFilterOptions,
} from '../model/textLabels'
import {
  ALL_SECTIONS,
  hasSearchFilter,
  resultCountLabel,
  SEARCH_MAX_LENGTH,
  SEARCH_TOO_SHORT,
  sectionOptions,
  type TextTypeFilter,
} from '../model/textFilter'
import { ALL_FIELDS_LABEL, resolveTextField, textFieldLabel } from '../model/textFields'
import { eventFieldCounts, eventListOf } from '../model/textEvents'
import { DEFAULT_LIST_EMPTY, DEFAULT_LIST_EMPTY_NOTE, defaultListNote, foldedTotal, isDefaultList, noteScopeLabel } from '../model/textGroups'
import { displaySectionPath } from '@/shared/lib/sectionTitle'

const sortOptions: { value: TextSort; label: string }[] = [
  { value: 'priority', label: '우선순위 순' },
  { value: 'document', label: '문서 순서' },
]

interface TextTabProps {
  analysis: Analysis
  /** 주소의 유형 거르기. CONTENT는 '내용 변경'(추가·삭제·수정, #304) */
  type: TextTypeFilter | null
  sort: TextSort
  /** 고른 최상위 섹션(3.7). null이면 전체 */
  section: string | null
  /** 검색어(3.7). null이면 검색하지 않음 */
  q: string | null
  /** 위험 관련 목차의 변경만 보는지(3.9) */
  risk: boolean
  /** 분야별 표에서 고른 분야(3.28). null이면 전체 */
  field: TextField | null
  /** 고정한 변경만 보는지(3.3) */
  pinned: boolean
  /** 근거를 보고 있는 변경(3.4) */
  selectedChangeId: number | null
  onChange: (changes: TextViewChange) => void
  onOpenSource: (target: SourceTarget) => void
  /** 고른 섹션의 변화를 AI에게 묻는다(질문을 보내고 AI 질문 탭으로 옮김) */
  onAsk: (question: string) => void
  /** 다른 질문을 보내는 중 */
  asking: boolean
}

/**
 * W-03 ③ 문장·내용 변화(3.9). 유형(추가·삭제·수정을 함께 보는 '내용 변경' 포함, #304)으로 거르고, 기본은 우선순위 순서(2.6)로 보여 준다.
 * 최상위 섹션과 검색어로도 함께 거른다(3.7). 고른 값은 주소에 남아 공유된다.
 * 맨 위 '위험 요인 변화' 카드에 위험 관련 목차의 건수를 보이고 '위험 관련만'으로 거른다(3.9, FS-61).
 * 문장을 비교하지 못했으면 '변경 없음'이 아니라 사유를 보여 준다. 짝짓지 못한 항목은 숨기지 않고 '검토 필요'로 둔다.
 * 맨 위 분야별 표에서 분야마다 몇 건이 바뀌었는지 보이고, 칸을 눌러 그 분야로 거른다(3.28). 옛 분석에는 표가 없고 주소의 분야도 쓰지 않는다.
 * 표 아래에 AI가 묶은 주요 사건을 카드로 보인다(3.37). 만드는 중이거나 만들지 못하면 그 자리에 진행 표시나 안내를 두고 나머지는 그대로이며, 어느 사건에도 들어가지 않은 후보는 원문 그대로 보인다(3.38).
 * 거르지 않으면 기본 목록만 보이고 나머지는 아래 접힌 묶음에 둔다. 거르면 접힌 변경도 찾는다(3.29). 옛 분석에는 묶음이 없고 모든 변경이 목록에 있다.
 * 카드에는 '원문 비교'와 ⋯ 메뉴(고정, AI 한 줄 풀이, 노트, 커뮤니티 인용)를 둔다(3.31). 이력과 관련 수시공시는 원문 비교 창 안에 있다.
 * 카드마다 고정할 수 있고, '고정' 거르기를 고르면 이 분석에서 고정한 변경만 보여 준다(3.3, 이 브라우저에만 남음).
 * 표 변경 카드는 행을 비교했으면 양쪽 글 대신 행 건수와 바뀐 행을 보이고, 비교하지 않았으면 그렇게 표시한다(3.30).
 * 고정 보기에서는 고정한 변경을 원문·출처와 함께 한 번에 복사할 수 있다(FS-31).
 * 키보드로 카드를 옮겨 다니며(j·k·↑·↓) 근거를 열고(Enter) 고정할(p) 수 있다(#311).
 */
export function TextTab({
  analysis,
  type: requestedType,
  sort,
  section,
  q,
  risk,
  field: requestedField,
  pinned,
  selectedChangeId,
  onChange,
  onOpenSource,
  onAsk,
  asking,
}: TextTabProps) {
  // type은 실제로 쓴 거르기다. '내용 변경'이 없는 분석에서 주소의 CONTENT는 전체로 본다
  const { state, counts, sections, riskCounts, listing, contentAvailable, type, reload, loadMore } = useTextChanges(analysis.analysisId, {
    type: requestedType,
    sort,
    section,
    q,
    risk,
    field: requestedField,
  })
  // 옛 분석은 서버가 분야를 무시하므로 주소에 있어도 고르지 않은 것으로 본다
  const field = resolveTextField(requestedField, listing)
  const searchBox = useTextSearch(q, (next) => onChange({ q: next }))
  // 받은 풀이는 거르기·정렬을 바꿔도 이 탭이 떠 있는 동안 남는다(3.11)
  const explanations = useTextExplanations(analysis.analysisId)
  const pins = usePinnedChanges(analysis.analysisId)
  const pinnedList = usePinnedTextChanges(analysis.analysisId, pins.ids, pinned, pins.remove)
  const { view: textEvents, retry: retryEvents } = useTextEvents(analysis.analysisId)
  // 같은 변경의 '원문 비교' 버튼이 목록과 사건 안에 함께 있을 수 있어, 창을 연 버튼을 기억해 닫을 때 그리로 돌아간다
  const evidenceOpener = useRef<{ changeId: number; element: Element | null } | null>(null)
  const toggleEvidence = (changeId: number) => {
    evidenceOpener.current = { changeId, element: document.activeElement }
    onChange({ change: changeId === selectedChangeId ? null : changeId })
  }
  useTextCardKeys({ onToggleEvidence: toggleEvidence, onTogglePin: pins.toggle })
  const searched = hasSearchFilter({ section, q })
  // 위험 관련만 보는 중이면(고정 보기가 아닐 때) 섹션·검색어처럼 거른 결과로 본다
  const riskOnly = risk && !pinned
  // 섹션을 골랐을 때만 그 섹션 변화를 묻는 버튼을 둔다(목차 밖 본문은 빼고)
  const sectionQuestion = sectionAskQuestion(section)
  const groupCounts = listing?.groupCounts ?? null
  const defaultList = !pinned && isDefaultList({ type, section, q, risk, field })
  const folded = groupCounts !== null && foldedTotal(groupCounts) > 0
  // 변경이 한 건도 없는 분석은 빈 화면 안내만 두고 사건 자리를 두지 않는다
  const noChanges = defaultList && !folded && state.status === 'success' && state.items.length === 0
  const clearFilters = () => {
    searchBox.setInput('')
    onChange({ type: null, section: null, q: null, risk: false, field: null })
  }
  const chooseField = (next: TextField | null) => {
    if (next !== null) searchBox.setInput('')
    onChange({ field: next })
  }
  const showPinned = () => {
    searchBox.setInput('')
    onChange({ pinned: true })
  }
  const closeEvidence = (changeId: number) => {
    onChange({ change: null })
    // 닫으면 그 항목의 '원문 비교' 버튼으로 초점을 돌려준다
    const opener = evidenceOpener.current?.changeId === changeId ? evidenceOpener.current.element : null
    requestAnimationFrame(() => {
      const target = opener instanceof HTMLButtonElement && opener.isConnected ? opener : document.getElementById(evidenceButtonId(changeId))
      target?.focus()
    })
  }
  // 고른 항목이 지금 목록(거르기·쪽·고정)에 없어도 근거는 연다(요약·주소에서 바로 온 경우, 펼친 묶음의 변경)
  const outsideEvidence = (items: TextChangeItem[]) =>
    selectedChangeId !== null &&
    !items.some((i) => i.changeId === selectedChangeId) && (
      <TextEvidencePanel
        key={selectedChangeId}
        analysis={analysis}
        changeId={selectedChangeId}
        onClose={() => closeEvidence(selectedChangeId)}
        onOpenSource={onOpenSource}
        onAsk={onAsk}
        asking={asking}
      />
    )
  const changeList = (items: TextChangeItem[], inlineEvidence = true, idScope = '') => {
    const noted = firstNotedIds(items)
    return (
      <ol className="change-list">
        {items.map((item) => (
          <li key={item.changeId}>
            <ChangeCard
              item={item}
              analysis={analysis}
              showTypeNote={noted.has(item.changeId)}
              selected={item.changeId === selectedChangeId}
              inlineEvidence={inlineEvidence}
              idScope={idScope}
              pinned={pins.isPinned(item.changeId)}
              explanations={explanations}
              onOpenSource={onOpenSource}
              onAsk={onAsk}
              asking={asking}
              onTogglePin={() => pins.toggle(item.changeId)}
              onToggle={() => toggleEvidence(item.changeId)}
              onClose={() => closeEvidence(item.changeId)}
            />
          </li>
        ))}
      </ol>
    )
  }
  const notice = textStatusNotice(analysis.textStatus, analysis.textMessage)
  const failed = analysis.textStatus === 'FAILED' || analysis.textStatus === null

  return (
    <Panel aria-label="문장 변화">
      {notice && (
        <Notice tone="attention" role="status">
          {notice}
        </Notice>
      )}
      {/* 첫 조회가 실패하면 아래 목록 자리의 오류 안내만 보인다 */}
      {!failed && !(state.status === 'error' && listing === null) && (
        <TextFieldTable listing={listing} field={pinned ? null : field} eventCounts={eventFieldCounts(eventListOf(textEvents))} onChoose={chooseField} />
      )}
      {!failed && !noChanges && (
        <TextEventsArea
          analysis={analysis}
          view={textEvents}
          scope={{ pinned, searched, riskOnly, type, field }}
          onRetry={retryEvents}
          onOpenEvidence={toggleEvidence}
          renderChanges={(items, eventId) => changeList(items, false, `event-${eventId}-`)}
        />
      )}
      {!failed && (
        <RiskChangesCard counts={riskCounts} risk={riskOnly} searched={searched} onToggle={(next) => onChange({ risk: next })} />
      )}
      {!failed && (
        <div className="text-search">
          <div className="text-search__field">
            <FieldLabel htmlFor="text-section">섹션</FieldLabel>
            <Select
              id="text-section"
              className="text-search__section"
              value={section ?? ALL_SECTIONS}
              onChange={(e) => onChange({ section: e.target.value === ALL_SECTIONS ? null : e.target.value })}
            >
              {sectionOptions(sections ?? [], section, field === null).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {sectionQuestion !== null && (
              <Button
                variant="secondary"
                className="text-search__ask"
                disabled={asking}
                aria-label={`이 항목 변화 AI에게 묻기: ${sectionQuestion}`}
                onClick={() => onAsk(sectionQuestion)}
              >
                이 항목 변화 AI에게 묻기
              </Button>
            )}
          </div>
          <div className="text-search__field text-search__field--grow">
            <FieldLabel htmlFor="text-query">문장 검색</FieldLabel>
            <Input
              id="text-query"
              type="search"
              className="text-search__input"
              placeholder="바뀐 글이나 섹션 이름으로 찾기"
              maxLength={SEARCH_MAX_LENGTH}
              value={searchBox.input}
              invalid={searchBox.search.kind === 'too-short'}
              aria-describedby="text-query-hint"
              onChange={(e) => searchBox.setInput(e.target.value)}
            />
            <FieldHint id="text-query-hint" aria-live="polite">
              {match(searchBox.search)
                .with({ kind: 'too-short' }, () => SEARCH_TOO_SHORT)
                .with({ kind: P.union('empty', 'ready') }, () => '바뀌기 전·후 글과 섹션 이름에서 찾아요.')
                .exhaustive()}
            </FieldHint>
          </div>
        </div>
      )}
      {!failed && (
        <div className="text-controls">
          <div className="text-filters" role="group" aria-label="변경 유형">
            {typeFilterOptions(contentAvailable).map((option) => (
              <Chip
                key={option.label}
                tone={option.value === 'REVIEW_NEEDED' ? 'attention' : 'neutral'}
                pressed={!pinned && type === option.value}
                // 응답의 유형 건수는 분야를 보지 않아, 분야를 고르면 목록과 맞지 않으므로 숨긴다
                count={field === null && counts ? countFor(counts, option.value) : null}
                onClick={() => {
                  if (pinned || requestedType !== option.value) onChange({ type: option.value })
                }}
              >
                {option.label}
              </Chip>
            ))}
            <Chip
              pressed={pinned}
              count={pins.ids.length}
              onClick={() => {
                if (!pinned) showPinned()
              }}
            >
              {PINNED_LABEL}
            </Chip>
          </div>
          {!pinned && (
            <SegmentedControl
              aria-label="정렬"
              options={sortOptions}
              value={sort}
              onChange={(next) => {
                if (next !== sort) onChange({ sort: next })
              }}
            />
          )}
          <p className="panel__note text-controls__note">{pinned ? PINNED_NOTE : PRIORITY_NOTE}</p>
          <ChangeTypeHelp />
        </div>
      )}

      {!failed &&
        pinned &&
        match(pinnedList.view)
          .with({ status: 'loading' }, () => <LoadingState message="고정한 변경을 불러오는 중이에요…" />)
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={pinnedList.reload} />)
          .with({ status: 'success' }, ({ items }) => (
            <>
              {items.length === 0 && <EmptyState title={PINNED_EMPTY} />}
              {outsideEvidence(items)}
              {items.length > 0 && (
                <>
                  {changeList(items)}
                  <div className="change-list__more">
                    <span className="panel__note" role="status">
                      고정 {resultCountLabel(items.length)}
                    </span>
                    <CopyWithSourcesButton
                      text={() => pinnedChangesText(analysis, items)}
                      label="고정한 변경 출처 포함 복사"
                    />
                  </div>
                </>
              )}
            </>
          ))
          .exhaustive()}
      {!failed &&
        !pinned &&
        match(state)
          .with({ status: 'loading' }, () => <Skeleton label="문장·표 변화를 불러오는 중입니다…" shape="card" count={2} />)
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
          .with({ status: 'success' }, ({ data, items, more }) => (
            <>
              {(searched || riskOnly || field !== null) && items.length > 0 && (
                <p className="panel__note" role="status">
                  조건에 맞는 변경 {resultCountLabel(data.totalItems)}
                </p>
              )}
              {defaultList && groupCounts !== null && (
                <p className="panel__note" role="status">
                  {defaultListNote(groupCounts)}
                </p>
              )}
              {items.length === 0 &&
                match({ searched, riskOnly, field, type, folded })
                  .with({ searched: true }, () => (
                    <EmptyState title="찾는 문장이 없어요">
                      <p>섹션이나 검색어를 바꾸거나, 조건을 지우고 전체 변경을 볼 수 있어요.</p>
                      <Button variant="secondary" onClick={clearFilters}>
                        조건 지우기
                      </Button>
                    </EmptyState>
                  ))
                  // 분야와 다른 거르기가 함께 걸려 0건이면 어느 한쪽이 없다고 말할 수 없다
                  .with({ searched: false, riskOnly: true, field: P.nonNullable }, { searched: false, riskOnly: false, field: P.nonNullable, type: P.nonNullable }, () => (
                    <EmptyState title="조건에 맞는 변경이 없어요.">
                      <Button variant="secondary" onClick={clearFilters}>
                        조건 지우기
                      </Button>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: true, field: null }, () => (
                    <EmptyState title={RISK_EMPTY}>
                      <Button variant="secondary" onClick={() => onChange({ risk: false })}>
                        전체 변경 보기
                      </Button>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: false, field: P.nonNullable, type: null }, ({ field: current }) => (
                    <EmptyState title={`${textFieldLabel(current)} 변경이 없어요.`}>
                      <Button variant="secondary" onClick={() => chooseField(null)}>
                        {ALL_FIELDS_LABEL}
                      </Button>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: false, field: null, type: null, folded: true }, () => (
                    <EmptyState title={DEFAULT_LIST_EMPTY}>
                      <p>{DEFAULT_LIST_EMPTY_NOTE}</p>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: false, field: null, type: null, folded: false }, () => <EmptyState title="두 보고서 사이에 바뀐 문장·표가 없어요." />)
                  .with({ searched: false, riskOnly: false, field: null, type: P.nonNullable }, ({ type: current }) => (
                    <EmptyState title={`${typeFilterLabel(current)} 항목이 없어요.`}>
                      <p>'전체'를 고르면 다른 유형의 변화도 볼 수 있어요.</p>
                    </EmptyState>
                  ))
                  .exhaustive()}
              {outsideEvidence(items)}
              {items.length > 0 && (
                <>
                  {changeList(items)}
                  <TextListFooter loaded={items.length} total={data.totalItems} more={more} onMore={loadMore} />
                </>
              )}
            </>
          ))
          .exhaustive()}
      {/* 정렬을 바꿔 목록을 다시 불러와도 펼친 묶음이 접히지 않도록 목록 상태 밖에 둔다 */}
      {!failed && defaultList && groupCounts !== null && (
        <TextFoldedGroups analysisId={analysis.analysisId} counts={groupCounts} sort={sort} renderList={(items) => changeList(items, false)} />
      )}
      {!failed && (
        <>
          <DartSourceLine
            reports={[
              { role: '비교', report: analysis.previous },
              { role: '현재', report: analysis.current },
            ]}
          />
          <p className="panel__note">
            원문에서 문단·표 단위로 비교했고, 숫자만 바뀐 표는 '재무 수치' 탭과 겹쳐 뒤로 미뤘어요.
          </p>
        </>
      )}
    </Panel>
  )
}

function evidenceButtonId(changeId: number, idScope = ''): string {
  return `text-evidence-button-${idScope}${changeId}`
}

interface ChangeCardProps {
  item: TextChangeItem
  analysis: Analysis
  /** 종류 안내 문장(삭제·위치 이동)을 붙일지. 목록에서 그 종류의 첫 카드에만 붙인다(#393) */
  showTypeNote: boolean
  selected: boolean
  /** 고르면 카드가 원문 비교 창을 여는지. 펼친 묶음의 카드는 탭이 대신 연다 */
  inlineEvidence: boolean
  /** 같은 변경이 화면에 두 번 보일 때(사건 안) 요소 id가 겹치지 않게 붙이는 앞말 */
  idScope: string
  /** 고정했는지(3.3) */
  pinned: boolean
  explanations: TextExplanations
  onTogglePin: () => void
  onToggle: () => void
  onClose: () => void
  onOpenSource: (target: SourceTarget) => void
  onAsk: (question: string) => void
  asking: boolean
}

function ChangeCard({
  item,
  analysis,
  showTypeNote,
  selected,
  inlineEvidence,
  idScope,
  pinned,
  explanations,
  onTogglePin,
  onToggle,
  onClose,
  onOpenSource,
  onAsk,
  asking,
}: ChangeCardProps) {
  const section = displaySectionPath(item.sectionPath)
  const review = item.changeType === 'REVIEW_NEEDED'
  const scope = noteScopeLabel(item.noteScope)
  const comparedRows = comparedRowsOf(item.rowDiff)
  const pairedPrevious = isPairedPreviousTable(item)
  const typeLabel = cardTypeLabel(item)
  // '숫자만 바뀜' 카드에만 바뀐 숫자 쌍을 보인다(짝이 확실하지 않으면 null이라 숨김). 행을 비교했으면 바뀐 행이 대신한다
  const numbers = item.changeType === 'NUMERIC_UPDATE' && comparedRows === null ? numberChanges(item.previousPreview, item.currentPreview) : null
  // 풀이 상자를 펼쳤는지는 카드 안 상태(주소에 남기지 않음). 처음 펼칠 때만 부른다
  const [explainOpen, setExplainOpen] = useState(false)
  // 메뉴에서 '노트에 담기'를 고른 횟수. 닫으면 null(저장 뒤 다시 고를 때도 열리도록 횟수로 알린다)
  const [noteRequest, setNoteRequest] = useState<number | null>(null)
  const explainId = `text-explain-${idScope}${item.changeId}`
  const toggleExplain = () => {
    if (!explainOpen) explanations.request(item.changeId)
    setExplainOpen(!explainOpen)
  }
  return (
    <Card
      as="article"
      tone={review ? 'attention' : 'default'}
      selected={selected}
      className="change-card"
      // 키보드로 옮겨 오는 카드(#311). Tab 순서에는 넣지 않는다
      tabIndex={-1}
      {...{ [TEXT_CARD_ATTRIBUTE]: item.changeId }}
      aria-label={`${section} ${typeLabel}`}
    >
      <div className="change-card__head">
        <h3 className="change-card__title">{section}</h3>
        <Badge tone={review ? 'attention' : 'accent'}>{typeLabel}</Badge>
        {item.priority && <Badge>{priorityLabel(item.priority.level)}</Badge>}
        {item.blockType === 'TABLE' && <Badge>표</Badge>}
        {isNotCompared(item.rowDiff) && <Badge>{NOT_COMPARED_LABEL}</Badge>}
        {showsNumbersOnlyMark(item) && <Badge>숫자만 바뀜</Badge>}
        {item.riskRelated && <Badge>{RISK_BADGE}</Badge>}
        {pinned && <Badge>고정됨</Badge>}
        {item.raisedFromNote === true && <Badge>주석에서 올림</Badge>}
        {item.listGroup === 'NOTE' && scope !== null && <Badge>{scope}</Badge>}
      </div>
      {review && (
        <Notice as="p" tone="attention" className="change-card__review">
          {item.reviewReason ?? '두 보고서의 항목을 짝짓지 못했어요.'} 빠진 것으로 숨기지 않고 여기에 보여 줘요.
        </Notice>
      )}
      {comparedRows !== null && <RowDiffBlock diff={comparedRows} />}
      {!review && comparedRows === null && (
        // 카드에는 이전·현재 문단을 3줄씩만 보이고, 전체는 '원문 비교' 창에서 본다(#507)
        <div className="change-card__sides change-card__sides--clamped">
          <SidePreview
            role={`이전 · ${analysis.previous.reportName}`}
            text={item.previousPreview}
            missing={missingSideLabel(item.changeType, 'previous')}
            removed={item.changeType === 'DELETED' && !pairedPrevious}
          />
          <SidePreview
            role={`현재 · ${analysis.current.reportName}`}
            text={item.currentPreview}
            missing={pairedPrevious ? PAIRED_TABLE_CURRENT : missingSideLabel(item.changeType, 'current')}
            added={item.changeType === 'ADDED'}
          />
        </div>
      )}
      {isNotCompared(item.rowDiff) && <p className="panel__note">{NOT_COMPARED_NOTE}</p>}
      {numbers !== null && <NumberChangesLine changes={numbers} />}
      {showTypeNote && item.changeType === 'DELETED' && !pairedPrevious && <p className="panel__note">{DELETED_NOTE}</p>}
      <MovedPaths item={item} withNote={showTypeNote} />
      <div className="change-card__actions">
        <Button variant="secondary" id={evidenceButtonId(item.changeId, idScope)} aria-haspopup="dialog" onClick={onToggle}>
          원문 비교
        </Button>
        <MenuButton label={<Icon name="ellipsis" size={16} />} trigger="icon" align="start" aria-label={`메뉴: ${section}`}>
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  onTogglePin()
                  close()
                }}
              >
                {pinned ? '고정 해제' : '고정'}
              </MenuItem>
              <MenuItem
                aria-expanded={explainOpen}
                aria-controls={explainOpen ? explainId : undefined}
                onClick={() => {
                  toggleExplain()
                  close()
                }}
              >
                {explainOpen ? '풀이 접기' : 'AI 한 줄 풀이'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setNoteRequest((count) => (count ?? 0) + 1)
                  close()
                }}
              >
                노트에 담기
              </MenuItem>
              {!review && Boolean(analysis.corpCode) && (
                <Link
                  className="menu-button__item"
                  to={communityQuotePath({
                    corpCode: analysis.corpCode,
                    analysisId: analysis.analysisId,
                    kind: 'TEXT_CHANGE',
                    changeId: item.changeId,
                  })}
                >
                  커뮤니티에 인용
                </Link>
              )}
            </>
          )}
        </MenuButton>
        {item.priority && item.priority.reasons.length > 0 && (
          <details className="change-card__why">
            <summary>우선순위를 정한 규칙</summary>
            <ul>
              {item.priority.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {noteRequest !== null && (
        <AddToNote
          target={{ kind: 'TEXT_CHANGE', changeId: item.changeId }}
          analysisId={analysis.analysisId}
          label={section}
          openRequest={noteRequest}
          onClose={() => setNoteRequest(null)}
        />
      )}
      {explainOpen && (
        <TextExplanationBox
          id={explainId}
          entry={explanations.entryOf(item.changeId)}
          analysis={analysis}
          onRetry={() => explanations.request(item.changeId)}
          onOpenSource={onOpenSource}
        />
      )}
      {selected && inlineEvidence && (
        <TextEvidencePanel
          key={item.changeId}
          analysis={analysis}
          changeId={item.changeId}
          onClose={onClose}
          onOpenSource={onOpenSource}
          onAsk={onAsk}
          asking={asking}
        />
      )}
    </Card>
  )
}

/** 위치 이동이면 옮기기 전·후 섹션 경로를 함께 보여 준다(같은 섹션이면 순서만 바뀜) */
function MovedPaths({ item, withNote }: { item: TextChangeItem; withNote: boolean }) {
  const paths = movedPaths(item)
  if (paths === null) return null
  return (
    <p className="panel__note change-card__moved">
      {paths.sameSection
        ? `같은 섹션(${displaySectionPath(paths.to)}) 안에서 순서만 바뀌었어요.`
        : `옮기기 전: ${displaySectionPath(paths.from)} → 옮긴 뒤: ${displaySectionPath(paths.to)}`}
      {withNote && ` ${MOVED_NOTE}`}
    </p>
  )
}
