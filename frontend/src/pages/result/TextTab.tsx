import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '../../api/analyses'
import {
  getTextChanges,
  type ChangeType,
  type TextChangeCounts,
  type TextChangeItem,
  type TextChangeList,
  type TextSort,
} from '../../api/textChanges'
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView'
import { TextEvidencePanel } from './TextEvidencePanel'
import {
  changeTypeLabel,
  changeTypeOptions,
  countFor,
  DELETED_NOTE,
  missingSideLabel,
  PRIORITY_NOTE,
  priorityLabel,
  textStatusNotice,
} from './textLabels'

const PAGE_SIZE = 20

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'done'; data: TextChangeList; items: TextChangeItem[]; more: 'idle' | 'loading' | { error: unknown } }

interface TextTabProps {
  analysis: Analysis
  type: ChangeType | null
  sort: TextSort
  /** 근거를 보고 있는 변경(3.4) */
  selectedChangeId: number | null
  onChange: (changes: { type?: ChangeType | null; sort?: TextSort; change?: number | null }) => void
}

/**
 * W-03 ③ 문장·내용 변화(3.9). 추가·삭제·수정·검토 필요로 거르고, 기본은 우선순위 순서(2.6)로 보여 준다.
 * 문장을 비교하지 못했으면 '변경 없음'이 아니라 사유를 보여 준다. 짝짓지 못한 항목은 숨기지 않고 '검토 필요'로 둔다.
 */
export function TextTab({ analysis, type, sort, selectedChangeId, onChange }: TextTabProps) {
  const [state, setState] = useState<ListState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)
  // 거르기·정렬이 바뀌면 늘어난다. '더 보기' 응답이 늦게 와도 지금 목록을 덮지 않게 한다
  const generation = useRef(0)

  useEffect(() => {
    let cancelled = false
    const gen = generation
    setState({ kind: 'loading' })
    getTextChanges(analysis.analysisId, { type, sort, page: 0, size: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data, items: data.items, more: 'idle' })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
      gen.current += 1
    }
  }, [analysis.analysisId, type, sort, retry])

  // 불러오는 동안에도 거르기 단추의 건수를 그대로 둔다(초점과 자리가 흔들리지 않게)
  const [counts, setCounts] = useState<TextChangeCounts | null>(null)
  if (state.kind === 'done' && state.data.counts !== counts) {
    setCounts(state.data.counts)
  }

  async function loadMore() {
    if (state.kind !== 'done' || state.more === 'loading') return
    const current = state
    const started = generation.current
    setState({ ...current, more: 'loading' })
    try {
      const next = await getTextChanges(analysis.analysisId, { type, sort, page: current.data.page + 1, size: PAGE_SIZE })
      if (generation.current !== started) return
      setState({ kind: 'done', data: next, items: [...current.items, ...next.items], more: 'idle' })
    } catch (error) {
      if (generation.current !== started) return
      setState({ ...current, more: { error } })
    }
  }

  const notice = textStatusNotice(analysis.textStatus, analysis.textMessage)
  const failed = analysis.textStatus === 'FAILED' || analysis.textStatus === null

  return (
    <section className="panel" aria-label="문장·내용 변화">
      {notice && (
        <div className="notice notice--attention" role="status">
          {notice}
        </div>
      )}
      {!failed && (
        <div className="text-controls">
          <div className="text-filters" role="group" aria-label="변경 유형">
            {changeTypeOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`pill${option.value === 'REVIEW_NEEDED' ? ' pill--attention' : ''}`}
                aria-pressed={type === option.value}
                onClick={() => {
                  if (type !== option.value) onChange({ type: option.value })
                }}
              >
                {option.label}
                {counts && <span className="pill__count"> {countFor(counts, option.value)}</span>}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="정렬">
            <button
              type="button"
              className="segmented__item"
              aria-pressed={sort === 'priority'}
              onClick={() => {
                if (sort !== 'priority') onChange({ sort: 'priority' })
              }}
            >
              우선순위 순
            </button>
            <button
              type="button"
              className="segmented__item"
              aria-pressed={sort === 'document'}
              onClick={() => {
                if (sort !== 'document') onChange({ sort: 'document' })
              }}
            >
              문서 순서
            </button>
          </div>
          <p className="panel__note text-controls__note">{PRIORITY_NOTE}</p>
        </div>
      )}

      {!failed && state.kind === 'loading' && <LoadingState message="문장·표 변화를 불러오는 중입니다…" />}
      {!failed && state.kind === 'error' && <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} />}
      {!failed && state.kind === 'done' && state.items.length === 0 && (
        <EmptyState title={type === null ? '두 보고서 사이에 바뀐 문장·표가 없어요.' : `${changeTypeLabel(type)} 항목이 없어요.`}>
          {type !== null && <p>'전체'를 고르면 다른 유형의 변화도 볼 수 있어요.</p>}
        </EmptyState>
      )}
      {!failed && state.kind === 'done' && selectedChangeId !== null && !state.items.some((i) => i.changeId === selectedChangeId) && (
        // 고른 항목이 지금 목록(거르기·쪽)에 없어도 근거는 연다(요약·주소에서 바로 온 경우)
        <div className="change-list__outside">
          <p className="panel__note">지금 목록에 보이지 않는 항목의 근거예요.</p>
          <TextEvidencePanel
            key={selectedChangeId}
            analysis={analysis}
            changeId={selectedChangeId}
            onClose={() => onChange({ change: null })}
          />
        </div>
      )}
      {!failed && state.kind === 'done' && state.items.length > 0 && (
        <>
          <ol className="change-list">
            {state.items.map((item) => (
              <li key={item.changeId}>
                <ChangeCard
                  item={item}
                  analysis={analysis}
                  selected={item.changeId === selectedChangeId}
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
              {state.items.length} / {state.data.totalItems}건
            </span>
            {state.items.length < state.data.totalItems && (
              <button type="button" className="button button--secondary" disabled={state.more === 'loading'} onClick={() => void loadMore()}>
                {state.more === 'loading' ? '불러오는 중…' : '더 보기'}
              </button>
            )}
          </div>
          {typeof state.more === 'object' && <ErrorState error={state.more.error} onRetry={() => void loadMore()} />}
        </>
      )}
      {!failed && (
        <p className="panel__note">
          원문에서 문단·표 단위로 비교했고, 숫자만 바뀐 표는 '재무 수치 변화'와 겹쳐 뒤로 미뤘어요.
        </p>
      )}
    </section>
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
}

function ChangeCard({ item, analysis, selected, onToggle, onClose }: ChangeCardProps) {
  const review = item.changeType === 'REVIEW_NEEDED'
  return (
    <article className={`change-card${review ? ' change-card--review' : ''}${selected ? ' change-card--selected' : ''}`} aria-label={`${item.sectionPath} ${changeTypeLabel(item.changeType)}`}>
      <div className="change-card__head">
        <h3 className="change-card__title">{item.sectionPath}</h3>
        <span className={`badge${review ? ' badge--attention' : ' badge--strong'}`}>{changeTypeLabel(item.changeType)}</span>
        {item.priority && <span className="badge">{priorityLabel(item.priority.level)}</span>}
        {item.blockType === 'TABLE' && <span className="badge">표</span>}
        {item.numbersOnly && <span className="badge">숫자만 바뀜</span>}
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
        <button
          type="button"
          id={evidenceButtonId(item.changeId)}
          className="button button--secondary"
          aria-expanded={selected}
          onClick={onToggle}
        >
          {selected ? '근거 닫기' : '근거 상세'}
        </button>
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
      {selected && <TextEvidencePanel key={item.changeId} analysis={analysis} changeId={item.changeId} onClose={onClose} />}
    </article>
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
