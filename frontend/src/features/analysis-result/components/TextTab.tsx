import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { ChangeType, TextChangeItem, TextSort } from '@/shared/api/textChanges'
import { Badge, Button, Card, Chip, FieldHint, FieldLabel, Input, Notice, Panel, SegmentedControl, Select } from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { TextEvidencePanel } from './TextEvidencePanel'
import { useTextChanges } from '../hooks/useTextChanges'
import { useTextSearch } from '../hooks/useTextSearch'
import type { SourceTarget, TextViewChange } from '../model/resultParams'
import {
  changeTypeLabel,
  changeTypeOptions,
  countFor,
  DELETED_NOTE,
  missingSideLabel,
  PRIORITY_NOTE,
  priorityLabel,
  textStatusNotice,
} from '../model/textLabels'
import {
  ALL_SECTIONS,
  hasSearchFilter,
  moreLabel,
  resultCountLabel,
  SEARCH_MAX_LENGTH,
  SEARCH_TOO_SHORT,
  sectionOptions,
} from '../model/textFilter'
import { displaySectionPath } from '@/shared/lib/sectionTitle'

const sortOptions: { value: TextSort; label: string }[] = [
  { value: 'priority', label: '우선순위 순' },
  { value: 'document', label: '문서 순서' },
]

interface TextTabProps {
  analysis: Analysis
  type: ChangeType | null
  sort: TextSort
  /** 고른 최상위 섹션(3.7). null이면 전체 */
  section: string | null
  /** 검색어(3.7). null이면 검색하지 않음 */
  q: string | null
  /** 근거를 보고 있는 변경(3.4) */
  selectedChangeId: number | null
  onChange: (changes: TextViewChange) => void
  onOpenSource: (target: SourceTarget) => void
}

/**
 * W-03 ③ 문장·내용 변화(3.9). 추가·삭제·수정·검토 필요로 거르고, 기본은 우선순위 순서(2.6)로 보여 준다.
 * 최상위 섹션과 검색어로도 함께 거른다(3.7). 고른 값은 주소에 남아 공유된다.
 * 문장을 비교하지 못했으면 '변경 없음'이 아니라 사유를 보여 준다. 짝짓지 못한 항목은 숨기지 않고 '검토 필요'로 둔다.
 */
export function TextTab({ analysis, type, sort, section, q, selectedChangeId, onChange, onOpenSource }: TextTabProps) {
  const { state, counts, sections, reload, loadMore } = useTextChanges(analysis.analysisId, { type, sort, section, q })
  const searchBox = useTextSearch(q, (next) => onChange({ q: next }))
  const filtered = hasSearchFilter({ section, q })
  const clearFilters = () => {
    searchBox.setInput('')
    onChange({ type: null, section: null, q: null })
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
            {changeTypeOptions.map((option) => (
              <Chip
                key={option.label}
                tone={option.value === 'REVIEW_NEEDED' ? 'attention' : 'neutral'}
                pressed={type === option.value}
                count={counts && countFor(counts, option.value)}
                onClick={() => {
                  if (type !== option.value) onChange({ type: option.value })
                }}
              >
                {option.label}
              </Chip>
            ))}
          </div>
          <SegmentedControl
            aria-label="정렬"
            options={sortOptions}
            value={sort}
            onChange={(next) => {
              if (next !== sort) onChange({ sort: next })
            }}
          />
          <p className="panel__note text-controls__note">{PRIORITY_NOTE}</p>
        </div>
      )}

      {!failed &&
        match(state)
          .with({ status: 'loading' }, () => <LoadingState message="문장·표 변화를 불러오는 중입니다…" />)
          .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
          .with({ status: 'success' }, ({ data, items, more }) => (
            <>
              {filtered && items.length > 0 && (
                <p className="panel__note" role="status">
                  조건에 맞는 변경 {resultCountLabel(data.totalItems)}
                </p>
              )}
              {items.length === 0 &&
                match({ filtered, type })
                  .with({ filtered: true }, () => (
                    <EmptyState title="찾는 문장이 없어요">
                      <p>섹션이나 검색어를 바꾸거나, 조건을 지우고 전체 변경을 볼 수 있어요.</p>
                      <Button variant="secondary" onClick={clearFilters}>
                        조건 지우기
                      </Button>
                    </EmptyState>
                  ))
                  .with({ filtered: false, type: null }, () => <EmptyState title="두 보고서 사이에 바뀐 문장·표가 없어요." />)
                  .with({ filtered: false, type: P.nonNullable }, ({ type: current }) => (
                    <EmptyState title={`${changeTypeLabel(current)} 항목이 없어요.`}>
                      <p>'전체'를 고르면 다른 유형의 변화도 볼 수 있어요.</p>
                    </EmptyState>
                  ))
                  .exhaustive()}
              {selectedChangeId !== null && !items.some((i) => i.changeId === selectedChangeId) && (
                // 고른 항목이 지금 목록(거르기·쪽)에 없어도 근거는 연다(요약·주소에서 바로 온 경우)
                <div className="change-list__outside">
                  <p className="panel__note">지금 목록에 보이지 않는 항목의 근거예요.</p>
                  <TextEvidencePanel
                    key={selectedChangeId}
                    analysis={analysis}
                    changeId={selectedChangeId}
                    onClose={() => onChange({ change: null })}
                    onOpenSource={onOpenSource}
                  />
                </div>
              )}
              {items.length > 0 && (
                <>
                  <ol className="change-list">
                    {items.map((item) => (
                      <li key={item.changeId}>
                        <ChangeCard
                          item={item}
                          analysis={analysis}
                          selected={item.changeId === selectedChangeId}
                          onOpenSource={onOpenSource}
                          onToggle={() => onChange({ change: item.changeId === selectedChangeId ? null : item.changeId })}
                          onClose={() => {
                            onChange({ change: null })
                            // 닫으면 그 항목의 '근거 상세' 버튼으로 초점을 돌려준다
                            requestAnimationFrame(() => document.getElementById(evidenceButtonId(item.changeId))?.focus())
                          }}
                        />
                      </li>
                    ))}
                  </ol>
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
  selected: boolean
  onToggle: () => void
  onClose: () => void
  onOpenSource: (target: SourceTarget) => void
}

function ChangeCard({ item, analysis, selected, onToggle, onClose, onOpenSource }: ChangeCardProps) {
  const review = item.changeType === 'REVIEW_NEEDED'
  return (
    <Card
      as="article"
      tone={review ? 'attention' : 'default'}
      selected={selected}
      className="change-card"
      aria-label={`${displaySectionPath(item.sectionPath)} ${changeTypeLabel(item.changeType)}`}
    >
      <div className="change-card__head">
        <h3 className="change-card__title">{displaySectionPath(item.sectionPath)}</h3>
        <Badge tone={review ? 'attention' : 'accent'}>{changeTypeLabel(item.changeType)}</Badge>
        {item.priority && <Badge>{priorityLabel(item.priority.level)}</Badge>}
        {item.blockType === 'TABLE' && <Badge>표</Badge>}
        {item.numbersOnly && <Badge>숫자만 바뀜</Badge>}
      </div>
      {review ? (
        <p className="change-card__review">
          {item.reviewReason ?? '두 보고서의 항목을 짝짓지 못했어요.'} 빠진 것으로 숨기지 않고 여기에 보여 줘요.
        </p>
      ) : (
        <div className="change-card__sides">
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
      {item.changeType === 'DELETED' && <p className="panel__note">{DELETED_NOTE}</p>}
      <div className="change-card__actions">
        <Button variant="secondary" id={evidenceButtonId(item.changeId)} aria-expanded={selected} onClick={onToggle}>
          {selected ? '근거 닫기' : '근거 상세'}
        </Button>
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
      {selected && (
        <TextEvidencePanel key={item.changeId} analysis={analysis} changeId={item.changeId} onClose={onClose} onOpenSource={onOpenSource} />
      )}
    </Card>
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
          {added && <span className="visually-hidden">추가된 내용: </span>}
          {removed && <span className="visually-hidden">빠진 내용: </span>}
          {text}
        </p>
      )}
    </div>
  )
}
