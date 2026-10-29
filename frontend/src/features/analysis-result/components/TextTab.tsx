import { useState } from 'react'
import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem, TextSort } from '@/shared/api/textChanges'
import { Badge, Button, ButtonLink, Card, Chip, FieldHint, FieldLabel, Icon, Input, Notice, Panel, SegmentedControl, Select, Skeleton } from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { communityQuotePath } from '@/shared/lib/communityQuoteLink'
import { AddToNote } from './AddToNote'
import { ChangeTypeHelp } from './ChangeTypeHelp'
import { CopyWithSourcesButton } from './CopyWithSourcesButton'
import { NumberChangesLine } from './NumberChangesLine'
import { RiskChangesCard } from './RiskChangesCard'
import { TextEvidencePanel } from './TextEvidencePanel'
import { TextExplanationBox } from './TextExplanationBox'
import { usePinnedChanges, usePinnedTextChanges } from '../hooks/usePinnedChanges'
import { useTextChanges } from '../hooks/useTextChanges'
import { useTextExplanations, type TextExplanations } from '../hooks/useTextExplanations'
import { useTextSearch } from '../hooks/useTextSearch'
import { TEXT_CARD_ATTRIBUTE, useTextCardKeys } from '../hooks/useTextCardKeys'
import { sectionAskQuestion } from '../model/askQuestion'
import { numberChanges } from '../model/numberChanges'
import { pinnedChangesText } from '../model/copyText'
import { RISK_BADGE, RISK_EMPTY } from '../model/riskChanges'
import { PINNED_EMPTY, PINNED_LABEL, PINNED_NOTE } from '../model/pinnedList'
import type { SourceTarget, TextViewChange } from '../model/resultParams'
import {
  changeTypeLabel,
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
  moreLabel,
  resultCountLabel,
  SEARCH_MAX_LENGTH,
  SEARCH_TOO_SHORT,
  sectionOptions,
  type TextTypeFilter,
} from '../model/textFilter'
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
 * 카드마다 고정할 수 있고, '고정' 거르기를 고르면 이 분석에서 고정한 변경만 보여 준다(3.3, 이 브라우저에만 남음).
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
  pinned,
  selectedChangeId,
  onChange,
  onOpenSource,
  onAsk,
  asking,
}: TextTabProps) {
  // type은 실제로 쓴 거르기다. '내용 변경'이 없는 분석에서 주소의 CONTENT는 전체로 본다
  const { state, counts, sections, riskCounts, contentAvailable, type, reload, loadMore } = useTextChanges(analysis.analysisId, {
    type: requestedType,
    sort,
    section,
    q,
    risk,
  })
  const searchBox = useTextSearch(q, (next) => onChange({ q: next }))
  // 받은 풀이는 거르기·정렬을 바꿔도 이 탭이 떠 있는 동안 남는다(3.11)
  const explanations = useTextExplanations(analysis.analysisId)
  const pins = usePinnedChanges(analysis.analysisId)
  const pinnedList = usePinnedTextChanges(analysis.analysisId, pins.ids, pinned, pins.remove)
  const toggleEvidence = (changeId: number) => onChange({ change: changeId === selectedChangeId ? null : changeId })
  useTextCardKeys({ onToggleEvidence: toggleEvidence, onTogglePin: pins.toggle })
  const searched = hasSearchFilter({ section, q })
  // 위험 관련만 보는 중이면(고정 보기가 아닐 때) 섹션·검색어처럼 거른 결과로 본다
  const riskOnly = risk && !pinned
  // 섹션을 골랐을 때만 그 섹션 변화를 묻는 버튼을 둔다(목차 밖 본문은 빼고)
  const sectionQuestion = sectionAskQuestion(section)
  const clearFilters = () => {
    searchBox.setInput('')
    onChange({ type: null, section: null, q: null, risk: false })
  }
  const showPinned = () => {
    searchBox.setInput('')
    onChange({ pinned: true })
  }
  // 고른 항목이 지금 목록(거르기·쪽·고정)에 없어도 근거는 연다(요약·주소에서 바로 온 경우)
  const outsideEvidence = (items: TextChangeItem[]) =>
    selectedChangeId !== null &&
    !items.some((i) => i.changeId === selectedChangeId) && (
      <TextEvidencePanel
        key={selectedChangeId}
        analysis={analysis}
        changeId={selectedChangeId}
        onClose={() => onChange({ change: null })}
        onOpenSource={onOpenSource}
        onAsk={onAsk}
        asking={asking}
      />
    )
  const changeList = (items: TextChangeItem[]) => {
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
              pinned={pins.isPinned(item.changeId)}
              explanations={explanations}
              onOpenSource={onOpenSource}
              onAsk={onAsk}
              asking={asking}
              onTogglePin={() => pins.toggle(item.changeId)}
              onToggle={() => toggleEvidence(item.changeId)}
              onClose={() => {
                onChange({ change: null })
                // 닫으면 그 항목의 '원문 비교' 버튼으로 초점을 돌려준다
                requestAnimationFrame(() => document.getElementById(evidenceButtonId(item.changeId))?.focus())
              }}
            />
          </li>
        ))}
      </ol>
    )
  }
  const notice = textStatusNotice(analysis.textStatus, analysis.textMessage)
  const failed = analysis.textStatus === 'FAILED' || analysis.textStatus === null

  return (
    <Panel aria-label="문장·내용 변화">
      {notice && (
        <Notice tone="attention" role="status">
          {notice}
        </Notice>
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
              {sectionOptions(sections ?? [], section).map((option) => (
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
                count={counts && countFor(counts, option.value)}
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
              {(searched || riskOnly) && items.length > 0 && (
                <p className="panel__note" role="status">
                  조건에 맞는 변경 {resultCountLabel(data.totalItems)}
                </p>
              )}
              {items.length === 0 &&
                match({ searched, riskOnly, type })
                  .with({ searched: true }, () => (
                    <EmptyState title="찾는 문장이 없어요">
                      <p>섹션이나 검색어를 바꾸거나, 조건을 지우고 전체 변경을 볼 수 있어요.</p>
                      <Button variant="secondary" onClick={clearFilters}>
                        조건 지우기
                      </Button>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: true }, () => (
                    <EmptyState title={RISK_EMPTY}>
                      <Button variant="secondary" onClick={() => onChange({ risk: false })}>
                        전체 변경 보기
                      </Button>
                    </EmptyState>
                  ))
                  .with({ searched: false, riskOnly: false, type: null }, () => <EmptyState title="두 보고서 사이에 바뀐 문장·표가 없어요." />)
                  .with({ searched: false, riskOnly: false, type: P.nonNullable }, ({ type: current }) => (
                    <EmptyState title={`${typeFilterLabel(current)} 항목이 없어요.`}>
                      <p>'전체'를 고르면 다른 유형의 변화도 볼 수 있어요.</p>
                    </EmptyState>
                  ))
                  .exhaustive()}
              {outsideEvidence(items)}
              {items.length > 0 && (
                <>
                  {changeList(items)}
                  <div className="change-list__more">
                    <span className="panel__note" role="status">
                      {items.length} / {data.totalItems}건
                    </span>
                    {items.length < data.totalItems && (
                      <Button variant="secondary" disabled={more.status === 'loading'} onClick={loadMore}>
                        {more.status === 'loading' ? '불러오는 중…' : moreLabel(items.length, data.totalItems)}
                      </Button>
                    )}
                  </div>
                  {match(more)
                    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={loadMore} />)
                    .with({ status: P.union('idle', 'loading') }, () => null)
                    .exhaustive()}
                </>
              )}
            </>
          ))
          .exhaustive()}
      {!failed && (
        <>
          <DartSourceLine
            reports={[
              { role: '비교', report: analysis.previous },
              { role: '현재', report: analysis.current },
            ]}
          />
          <p className="panel__note">
            원문에서 문단·표 단위로 비교했고, 숫자만 바뀐 표는 '재무 수치 변화'와 겹쳐 뒤로 미뤘어요.
          </p>
        </>
      )}
    </Panel>
  )
}

function evidenceButtonId(changeId: number): string {
  return `text-evidence-button-${changeId}`
}

interface ChangeCardProps {
  item: TextChangeItem
  analysis: Analysis
  /** 종류 안내 문장(삭제·위치 이동)을 붙일지. 목록에서 그 종류의 첫 카드에만 붙인다(#393) */
  showTypeNote: boolean
  selected: boolean
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
  // '숫자만 바뀜' 카드에만 바뀐 숫자 쌍을 보인다(짝이 확실하지 않으면 null이라 숨김)
  const numbers = item.changeType === 'NUMERIC_UPDATE' ? numberChanges(item.previousPreview, item.currentPreview) : null
  // 풀이 상자를 펼쳤는지는 카드 안 상태(주소에 남기지 않음). 처음 펼칠 때만 부른다
  const [explainOpen, setExplainOpen] = useState(false)
  const explainId = `text-explain-${item.changeId}`
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
      aria-label={`${section} ${changeTypeLabel(item.changeType)}`}
    >
      <div className="change-card__head">
        <h3 className="change-card__title">{section}</h3>
        <Badge tone={review ? 'attention' : 'accent'}>{changeTypeLabel(item.changeType)}</Badge>
        {item.priority && <Badge>{priorityLabel(item.priority.level)}</Badge>}
        {item.blockType === 'TABLE' && <Badge>표</Badge>}
        {showsNumbersOnlyMark(item) && <Badge>숫자만 바뀜</Badge>}
        {item.riskRelated && <Badge>{RISK_BADGE}</Badge>}
        <Button
          variant="icon"
          className="change-card__pin"
          aria-pressed={pinned}
          aria-label={pinned ? `고정 해제: ${section}` : `고정: ${section}`}
          title={pinned ? '고정 해제' : '고정'}
          onClick={onTogglePin}
        >
          <Icon name={pinned ? 'star-filled' : 'star'} size={16} />
        </Button>
      </div>
      {review ? (
        <p className="change-card__review">
          {item.reviewReason ?? '두 보고서의 항목을 짝짓지 못했어요.'} 빠진 것으로 숨기지 않고 여기에 보여 줘요.
        </p>
      ) : (
        // 카드에는 이전·현재 문단을 3줄씩만 보이고, 전체는 '원문 비교' 창에서 본다(#507)
        <div className="change-card__sides change-card__sides--clamped">
          <SidePreview
            role={`이전 · ${analysis.previous.reportName}`}
            text={item.previousPreview}
            missing={missingSideLabel(item.changeType, 'previous')}
            removed={item.changeType === 'DELETED'}
          />
          <SidePreview
            role={`현재 · ${analysis.current.reportName}`}
            text={item.currentPreview}
            missing={missingSideLabel(item.changeType, 'current')}
            added={item.changeType === 'ADDED'}
          />
        </div>
      )}
      {numbers !== null && <NumberChangesLine changes={numbers} />}
      {showTypeNote && item.changeType === 'DELETED' && <p className="panel__note">{DELETED_NOTE}</p>}
      <MovedPaths item={item} withNote={showTypeNote} />
      <div className="change-card__actions">
        <Button variant="secondary" id={evidenceButtonId(item.changeId)} aria-haspopup="dialog" onClick={onToggle}>
          원문 비교
        </Button>
        <Button
          variant="secondary"
          className="change-card__explain"
          aria-expanded={explainOpen}
          aria-controls={explainOpen ? explainId : undefined}
          onClick={toggleExplain}
        >
          {explainOpen ? '풀이 접기' : 'AI 한 줄 풀이'}
        </Button>
        {!review && Boolean(analysis.corpCode) && (
          <ButtonLink
            variant="secondary"
            to={communityQuotePath({
              corpCode: analysis.corpCode,
              analysisId: analysis.analysisId,
              kind: 'TEXT_CHANGE',
              changeId: item.changeId,
            })}
          >
            커뮤니티에 인용
          </ButtonLink>
        )}
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
      <AddToNote target={{ kind: 'TEXT_CHANGE', changeId: item.changeId }} analysisId={analysis.analysisId} label={section} />
      {explainOpen && (
        <TextExplanationBox
          id={explainId}
          entry={explanations.entryOf(item.changeId)}
          analysis={analysis}
          onRetry={() => explanations.request(item.changeId)}
          onOpenSource={onOpenSource}
        />
      )}
      {selected && (
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

interface SidePreviewProps {
  role: string
  text: string | null
  missing: string
  added?: boolean
  removed?: boolean
}

function SidePreview({ role, text, missing, added = false, removed = false }: SidePreviewProps) {
  return (
    <div className="change-side">
      <span className="change-side__role">{role}</span>
      {text === null ? (
        <p className="change-side__missing">{missing}</p>
      ) : (
        <p className={`change-side__text${added ? ' change-side__text--added' : ''}${removed ? ' change-side__text--removed' : ''}`}>
          <span className="change-side__body">
            {added && <span className="visually-hidden">추가된 내용: </span>}
            {removed && <span className="change-side__tag">삭제됨</span>}
            {text}
          </span>
        </p>
      )}
    </div>
  )
}
