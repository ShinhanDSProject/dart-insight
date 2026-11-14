import { useRef, useState, type ReactNode, type RefObject } from 'react'
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
import { RowDiffBlock } from './RowDiffBlock'
import { MergedPreview } from './MergedPreview'
import { SidePreview } from './SidePreview'
import { TextChangeBrowser } from './TextChangeBrowser'
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
import { TEXT_CARD_ATTRIBUTE, TEXT_DETAIL_ATTRIBUTE, useTextCardKeys } from '../hooks/useTextCardKeys'
import { sectionAskQuestion } from '../model/askQuestion'
import { mergedPreview } from '../model/mergedPreview'
import { numberChanges } from '../model/numberChanges'
import { canMergeChange, textDetailOf } from '../model/textBrowse'
import { pinnedChangesText } from '../model/copyText'
import { RISK_BADGE, RISK_EMPTY, RISK_FILTERED_SCOPE, RISK_NOTE, RISK_SCOPE } from '../model/riskChanges'
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
  TEXT_FOOTER_NOTE,
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
import { ALL_FIELDS_LABEL, fieldTableView, resolveTextField, textFieldLabel } from '../model/textFields'
import { eventFieldCounts, eventListOf } from '../model/textEvents'
import { DEFAULT_LIST_EMPTY, DEFAULT_LIST_EMPTY_NOTE, foldedTotal, isDefaultList, LIST_TITLE, listHeadNote, noteScopeLabel } from '../model/textGroups'
import { displaySectionPath } from '@/shared/lib/sectionTitle'

/** 거르기 줄에 늘 보이는 유형(3.55). 나머지는 '더 보기' 메뉴에 둔다 */
const MAIN_TYPE_FILTERS: (TextTypeFilter | null)[] = [null, 'CONTENT', 'ADDED', 'DELETED', 'MODIFIED']

const sortOptions: { value: TextSort; label: string }[] = [
  { value: 'document', label: '문서 순서' },
  { value: 'priority', label: '우선순위 순' },
]

/** 수정 카드를 한 글로 합쳐 볼지, 이전·현재를 나란히 볼지(3.53). 이 탭이 떠 있는 동안만 남는다 */
type ModifiedView = 'merged' | 'side'

const modifiedViewOptions: { value: ModifiedView; label: string }[] = [
  { value: 'merged', label: '합쳐 보기' },
  { value: 'side', label: '나란히 보기' },
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
  /** 목록에서 골라 상세 칸에 보이는 변경(3.54). null이면 첫 변경 */
  detailId?: number | null
  onChange: (changes: TextViewChange) => void
  onOpenSource: (target: SourceTarget) => void
  /** 고른 섹션의 변화를 AI에게 묻는다(질문을 보내고 AI 질문 탭으로 옮김) */
  onAsk: (question: string) => void
  /** 다른 질문을 보내는 중 */
  asking: boolean
}

/**
 * W-03 ③ 문장·내용 변화(3.9). 유형(추가·삭제·수정을 함께 보는 '내용 변경' 포함, #304)으로 거르고, 기본은 문서 순서로 보여 준다(3.53, 우선순위 순서(2.6)는 고를 수 있음).
 * 수정된 문단은 이전·현재 글을 한 글로 합쳐 빠진 글과 새 글을 표시하고, '나란히 보기'로 바꿀 수 있다(3.53).
 * 최상위 섹션과 검색어로도 함께 거른다(3.7). 고른 값은 주소에 남아 공유된다.
 * 맨 위 '위험 요인 변화' 카드에 위험 관련 목차의 건수를 보이고 '위험 관련만'으로 거른다(3.9, FS-61).
 * 문장을 비교하지 못했으면 '변경 없음'이 아니라 사유를 보여 준다. 짝짓지 못한 항목은 숨기지 않고 '검토 필요'로 둔다.
 * 맨 위 분야별 표에서 분야마다 몇 건이 바뀌었는지 보이고, 칸을 눌러 그 분야로 거른다(3.28). 옛 분석에는 표가 없고 주소의 분야도 쓰지 않는다.
 * 맨 위에 한눈에 보기와 AI가 묶은 사건을 규모가 큰 순으로 보이고, 줄을 누르면 그 사건을 자세히 본다(3.37, #826). 만드는 중이거나 만들지 못하면 그 자리에 진행 표시나 안내를 두고 나머지는 그대로이며, 어느 사건에도 들어가지 않은 후보는 원문 그대로 보인다(3.38).
 * 거르지 않으면 기본 목록만 보이고 나머지는 아래 접힌 묶음에 둔다. 거르면 접힌 변경도 찾는다(3.29). 옛 분석에는 묶음이 없고 모든 변경이 목록에 있다.
 * 카드에는 '원문 비교'와 ⋯ 메뉴(고정, AI 한 줄 풀이, 노트, 커뮤니티 인용)를 둔다(3.31). 이력과 관련 수시공시는 원문 비교 창 안에 있다.
 * 카드마다 고정할 수 있고, '고정' 거르기를 고르면 이 분석에서 고정한 변경만 보여 준다(3.3, 이 브라우저에만 남음).
 * 표 변경 카드는 행을 비교했으면 양쪽 글 대신 행 건수와 바뀐 행을 보이고, 비교하지 않았으면 그렇게 표시한다(3.30).
 * 고정 보기에서는 고정한 변경을 원문·출처와 함께 한 번에 복사할 수 있다(FS-31).
 * 키보드로 카드를 옮겨 다니며(j·k·↑·↓) 근거를 열고(Enter) 고정할(p) 수 있다(#311).
 * 전체 변경과 고정 목록은 왼쪽 한 줄 목록과 오른쪽 상세로 보인다(3.54). 문서 순서면 목차 머리줄로 묶고, 고른 변경은 주소(tsel)에 남는다.
 * 키보드 이동은 목록 줄을 오가며 상세도 따라간다. 사건 안·접힌 묶음은 지금처럼 카드로 둔다.
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
  detailId = null,
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
  const [modifiedView, setModifiedView] = useState<ModifiedView>('merged')
  const pinnedList = usePinnedTextChanges(analysis.analysisId, pins.ids, pinned, pins.remove)
  const { view: textEvents, retry: retryEvents } = useTextEvents(analysis.analysisId)
  // 같은 변경의 '원문 비교' 버튼이 목록과 사건 안에 함께 있을 수 있어, 창을 연 버튼을 기억해 닫을 때 그리로 돌아간다
  const evidenceOpener = useRef<{ changeId: number; element: Element | null } | null>(null)
  const toggleEvidence = (changeId: number) => {
    evidenceOpener.current = { changeId, element: document.activeElement }
    onChange({ change: changeId === selectedChangeId ? null : changeId })
  }
  // 지금 목록·상세에 보이는 변경(고정 보기면 고정 목록). 키보드로 줄을 옮기면 상세도 따라간다
  const browsedItems = browsedItemsOf(pinned, pinnedList.view, state)
  const selectDetail = (changeId: number) => onChange({ detail: changeId })
  const nextInList = useRef<(() => void) | null>(null)
  useTextCardKeys({
    onToggleEvidence: toggleEvidence,
    onTogglePin: pins.toggle,
    onMoved: (changeId) => {
      if (browsedItems.some((i) => i.changeId === changeId)) selectDetail(changeId)
    },
    // 전체 변경 목록의 받아 둔 끝이면 '다음' 버튼처럼 다음 쪽을 불러와 이어 간다(고정 보기는 다 받아 둠)
    onPastEnd: () => nextInList.current?.(),
  })
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
    // 목록에 있는 변경이면 상세 칸에 그 변경을 남긴다(주소로 바로 연 경우에도 닫은 뒤 그 변경이 보이게)
    onChange(browsedItems.some((i) => i.changeId === changeId) ? { change: null, detail: changeId } : { change: null })
    // 닫으면 그 항목의 '원문 비교' 버튼으로 초점을 돌려준다
    const opener = evidenceOpener.current?.changeId === changeId ? evidenceOpener.current.element : null
    requestAnimationFrame(() => {
      const target = opener instanceof HTMLButtonElement && opener.isConnected ? opener : document.getElementById(evidenceButtonId(changeId))
      target?.focus()
    })
  }
  // 원문 비교 창은 카드 밖에서 하나만 연다. 고른 항목이 지금 목록(거르기·쪽·고정)에 없어도 연다(요약·주소에서 바로 온 경우, 펼친 묶음의 변경)
  const evidencePanel =
    selectedChangeId !== null && (
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
  const changeCard = (item: TextChangeItem, showTypeNote: boolean, idScope: string, inDetail: boolean) => (
    <ChangeCard
      // 상세 칸은 같은 자리에서 변경만 바뀌므로, 풀이·노트를 연 상태가 다음 변경으로 넘어가지 않게 변경마다 새로 그린다
      key={item.changeId}
      item={item}
      analysis={analysis}
      showTypeNote={showTypeNote}
      selected={item.changeId === selectedChangeId}
      inDetail={inDetail}
      idScope={idScope}
      pinned={pins.isPinned(item.changeId)}
      merged={modifiedView === 'merged'}
      explanations={explanations}
      onOpenSource={onOpenSource}
      onTogglePin={() => pins.toggle(item.changeId)}
      onToggle={() => toggleEvidence(item.changeId)}
    />
  )
  // 전체 변경과 고정 목록은 목록·상세로 보인다(3.54). 사건 안·접힌 묶음은 카드로 둔다
  const browser = (
    items: TextChangeItem[],
    total: number,
    grouped: boolean,
    footer?: ReactNode,
    paging?: { onLoadMore: () => void; loading: boolean; nextRef: RefObject<(() => void) | null> },
  ) => {
    const detail = textDetailOf(items, detailId, selectedChangeId)
    const noted = firstNotedIds(items)
    return (
      <TextChangeBrowser
        items={items}
        total={total}
        grouped={grouped}
        detail={detail}
        onSelect={selectDetail}
        onOpenOutside={toggleEvidence}
        detailTools={
          detail.kind === 'item' &&
          canMergeChange(detail.item) && (
            <SegmentedControl aria-label="수정된 글 보기" options={modifiedViewOptions} value={modifiedView} onChange={setModifiedView} />
          )
        }
        // 상세 칸의 카드는 목록을 대신하므로 요소 id 앞말을 붙이지 않는다(같은 변경이 접힌 묶음에 함께 있지 않음)
        renderDetail={(item) => changeCard(item, noted.has(item.changeId), '', true)}
        footer={footer}
        onLoadMore={paging?.onLoadMore}
        loadingMore={paging?.loading}
        nextRef={paging?.nextRef}
      />
    )
  }
  const changeList = (items: TextChangeItem[], idScope = '') => {
    const noted = firstNotedIds(items)
    return (
      <ol className="change-list">
        {items.map((item) => (
          <li key={item.changeId}>
            {changeCard(item, noted.has(item.changeId), idScope, false)}
          </li>
        ))}
      </ol>
    )
  }
  // 위험 요인 변화 상자 대신 분야 줄에 두는 칩(3.55). 무엇을 위험 관련으로 보는지는 화면 낭독기에 함께 읽힌다
  const riskChip = (
    <span className="text-risk">
      <Chip
        tone="attention"
        pressed={riskOnly}
        count={riskCounts?.all ?? null}
        disabled={!riskOnly && riskCounts?.all === 0}
        aria-describedby="text-risk-scope"
        onClick={() => onChange({ risk: !riskOnly })}
      >
        {RISK_BADGE}
      </Chip>
      <span id="text-risk-scope" className="visually-hidden">
        {RISK_SCOPE} {RISK_NOTE}
      </span>
    </span>
  )
  const headNote = listHeadNote({
    pinned,
    defaultList,
    narrowed: searched || riskOnly || field !== null,
    groupCounts,
    total: state.status === 'success' && state.items.length > 0 ? state.data.totalItems : null,
    grouped: sort === 'document',
  })
  const notice = textStatusNotice(analysis.textStatus, analysis.textMessage)
  const failed = analysis.textStatus === 'FAILED' || analysis.textStatus === null

  return (
    <Panel aria-label="전체 변경">
      {!failed && evidencePanel}
      {notice && (
        <Notice tone="attention" role="status">
          {notice}
        </Notice>
      )}
      {/* 한눈에 보기와 먼저 볼 변화를 탭 맨 위에 둔다(#826) */}
      {!failed && !noChanges && (
        <TextEventsArea
          analysis={analysis}
          view={textEvents}
          field={pinned ? null : field}
          listNarrowed={pinned || searched || riskOnly || type !== null}
          onRetry={retryEvents}
          onAsk={onAsk}
          onOpenEvidence={toggleEvidence}
          renderChanges={(items, eventId) => changeList(items, `event-${eventId}-`)}
        />
      )}
      {/* 첫 조회가 실패하면 아래 목록 자리의 오류 안내만 보인다 */}
      {!failed && !(state.status === 'error' && listing === null) && (
        <TextFieldTable
          listing={listing}
          field={pinned ? null : field}
          eventCounts={eventFieldCounts(eventListOf(textEvents))}
          onChoose={chooseField}
          extra={riskChip}
        />
      )}
      {/* 옛 분석은 분야별 표가 없어 위험 관련 칩만 따로 둔다 */}
      {!failed && fieldTableView(listing).kind === 'hidden' && <div className="text-risk-row">{riskChip}</div>}
      {/* 전체 변경 제목과 건수 한 줄(3.59). 거르면 결과 건수로 바뀐다 */}
      {!failed && (
        <div className="text-list-head">
          <h3 id="text-list-title" className="text-list-head__title" tabIndex={-1}>
            {LIST_TITLE}
          </h3>
          {headNote !== null && (
            <span className="panel__note" role="status">
              {headNote}
            </span>
          )}
        </div>
      )}
      {!failed && (
        <div className="text-filterbar">
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
            {/* 평소 설명은 화면 낭독기에만 읽히고, 너무 짧을 때만 보인다 */}
            {match(searchBox.search)
              .with({ kind: 'too-short' }, () => (
                <FieldHint id="text-query-hint" aria-live="polite">
                  {SEARCH_TOO_SHORT}
                </FieldHint>
              ))
              .with({ kind: P.union('empty', 'ready') }, () => (
                <span id="text-query-hint" className="visually-hidden" aria-live="polite">
                  바뀌기 전·후 글과 섹션 이름에서 찾아요.
                </span>
              ))
              .exhaustive()}
          </div>
          <div className="text-filters" role="group" aria-label="변경 유형">
            {typeFilterOptions(contentAvailable)
              .filter((option) => MAIN_TYPE_FILTERS.includes(option.value) || (!pinned && type === option.value))
              .map((option) => (
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
            <MoreTypeFilters
              options={typeFilterOptions(contentAvailable).filter((option) => !MAIN_TYPE_FILTERS.includes(option.value))}
              countOf={(value) => (field === null && counts ? countFor(counts, value) : null)}
              onChoose={(value) => {
                if (pinned || requestedType !== value) onChange({ type: value })
              }}
            />
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
            <Select
              aria-label="정렬"
              className="text-filterbar__sort"
              value={sort}
              onChange={(e) => {
                const next = e.target.value as TextSort
                if (next !== sort) onChange({ sort: next })
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
          <ChangeTypeHelp />
        </div>
      )}
      {!failed && riskOnly && (
        <p className="panel__note" role="status">
          {RISK_SCOPE} {searched && `${RISK_FILTERED_SCOPE} `}
          {RISK_NOTE}
        </p>
      )}

      {!failed &&
        pinned &&
        match(pinnedList.view)
          .with({ status: 'loading' }, () => <LoadingState message="고정한 변경을 불러오는 중이에요…" />)
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={pinnedList.reload} />)
          .with({ status: 'success' }, ({ items }) => (
            <>
              {items.length === 0 && <EmptyState title={PINNED_EMPTY} />}
              {items.length > 0 &&
                browser(
                  items,
                  items.length,
                  false,
                  <div className="change-list__more">
                    <span className="panel__note" role="status">
                      고정 {resultCountLabel(items.length)} · {PINNED_NOTE}
                    </span>
                    <CopyWithSourcesButton text={() => pinnedChangesText(analysis, items)} label="고정한 변경 출처 포함 복사" />
                  </div>,
                )}
            </>
          ))
          .exhaustive()}
      {!failed &&
        !pinned &&
        match(state)
          .with({ status: 'loading' }, () => <Skeleton label="문장·표 변화를 불러오는 중이에요…" shape="card" count={2} />)
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
          .with({ status: 'success' }, ({ data, items, more }) => (
            <>
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
              {items.length > 0 &&
                browser(
                  items,
                  data.totalItems,
                  sort === 'document',
                  <TextListFooter loaded={items.length} total={data.totalItems} more={more} onMore={loadMore} />,
                  { onLoadMore: loadMore, loading: more.status === 'loading', nextRef: nextInList },
                )}
            </>
          ))
          .exhaustive()}
      {/* 정렬을 바꿔 목록을 다시 불러와도 펼친 묶음이 접히지 않도록 목록 상태 밖에 둔다 */}
      {!failed && defaultList && groupCounts !== null && (
        <TextFoldedGroups analysisId={analysis.analysisId} counts={groupCounts} sort={sort} renderList={(items) => changeList(items)} />
      )}
      {/* 맨 아래 안내는 구분선 아래 한 줄(3.59). 페이지의 footer 영역과 겹치지 않게 div로 둔다 */}
      {!failed && (
        <div className="text-tab__footer">
          <DartSourceLine
            reports={[
              { role: '비교', report: analysis.previous },
              { role: '현재', report: analysis.current },
            ]}
          />
          <p>{TEXT_FOOTER_NOTE}</p>
        </div>
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
  /** 상세 칸의 카드인지(3.54). j·k 이동은 목록 줄이 대신하고, 근거·고정 단축키는 받는다 */
  inDetail: boolean
  /** 같은 변경이 화면에 두 번 보일 때(사건 안) 요소 id가 겹치지 않게 붙이는 앞말 */
  idScope: string
  /** 고정했는지(3.3) */
  pinned: boolean
  /** 수정된 글을 한 글로 합쳐 보이는지(3.53). 합칠 수 없으면 나란히 보인다 */
  merged: boolean
  explanations: TextExplanations
  onTogglePin: () => void
  onToggle: () => void
  onOpenSource: (target: SourceTarget) => void
}

function ChangeCard({
  item,
  analysis,
  showTypeNote,
  selected,
  inDetail,
  idScope,
  pinned,
  merged,
  explanations,
  onTogglePin,
  onToggle,
  onOpenSource,
}: ChangeCardProps) {
  const section = displaySectionPath(item.sectionPath)
  const review = item.changeType === 'REVIEW_NEEDED'
  const scope = noteScopeLabel(item.noteScope)
  const comparedRows = comparedRowsOf(item.rowDiff)
  const pairedPrevious = isPairedPreviousTable(item)
  const typeLabel = cardTypeLabel(item)
  // 합쳐 보기는 글 문단의 수정에만 쓴다. 표는 행 비교나 양쪽 글로 본다
  const mergedParts = merged && canMergeChange(item) ? mergedPreview(item.previousPreview, item.currentPreview) : null
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
      {...{ [TEXT_CARD_ATTRIBUTE]: item.changeId, ...(inDetail ? { [TEXT_DETAIL_ATTRIBUTE]: '' } : {}) }}
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
      {mergedParts !== null && <MergedPreview parts={mergedParts} />}
      {!review && comparedRows === null && mergedParts === null && (
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

/** 목록·상세에 보이는 변경. 고정 보기면 고정 목록, 아니면 불러온 전체 변경 목록. 불러오는 중이면 없음 */
function browsedItemsOf(
  pinned: boolean,
  pinnedView: { status: string; items?: TextChangeItem[] },
  listState: { status: string; items?: TextChangeItem[] },
): TextChangeItem[] {
  const view = pinned ? pinnedView : listState
  return view.status === 'success' ? (view.items ?? []) : []
}

/** 거르기 줄의 '더 보기'(3.55): 자주 쓰지 않는 유형을 메뉴로 고른다. 고른 유형은 칩 줄에 함께 보인다 */
function MoreTypeFilters({
  options,
  countOf,
  onChoose,
}: {
  options: { value: TextTypeFilter | null; label: string }[]
  countOf: (value: TextTypeFilter | null) => number | null
  onChoose: (value: TextTypeFilter | null) => void
}) {
  if (options.length === 0) return null
  return (
    <MenuButton label="더 보기" trigger="chip" align="start" aria-label="다른 유형으로 거르기">
      {(close) =>
        options.map((option) => {
          const count = countOf(option.value)
          return (
            <MenuItem
              key={option.label}
              onClick={() => {
                onChoose(option.value)
                close()
              }}
            >
              {option.label}
              {count !== null && ` ${count}`}
            </MenuItem>
          )
        })
      }
    </MenuButton>
  )
}
