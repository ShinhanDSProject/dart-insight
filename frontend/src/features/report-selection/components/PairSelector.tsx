import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import { Button } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { basisOptions } from '@/shared/lib/comparisonBasis'
import { customCandidates, reportOptionLabel } from '../model/pairSelection'

export type PairLookup =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; key: string; previous: ReportItem | null; reason: string | null }
  | { kind: 'error'; error: unknown }

interface PairSelectorProps {
  items: ReportItem[]
  basis: ComparisonBasis
  current: ReportItem
  previous: ReportItem | null
  lookup: PairLookup
  onBasisChange: (basis: ComparisonBasis) => void
  onCurrentChange: (rceptNo: string) => void
  onPreviousChange: (rceptNo: string | null) => void
  onRetry: () => void
}

/**
 * W-01 ② 비교 기준과 두 보고서 고르기(2.1).
 * 현재 보고서는 오른쪽에 두고, 비교 기준을 바꾸면 왼쪽 비교 보고서만 바뀐다.
 */
export function PairSelector(props: PairSelectorProps) {
  const { items, basis, current, lookup, onBasisChange, onCurrentChange } = props

  return (
    <div className="pair">
      <div className="pair__basis">
        <span className="pair__label" id="basis-label">
          비교 기준
        </span>
        <div className="segmented" role="group" aria-labelledby="basis-label">
          {basisOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="segmented__item"
              aria-pressed={basis === option.value}
              onClick={() => onBasisChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="pair__hint">기본 비교 기준은 결정 전이라 전년 동기로 두었어요.</span>
      </div>

      <div className="pair__slots">
        <div className="pair__slot">
          <PreviousSlot {...props} />
        </div>
        <div className="pair__slot">
          <label htmlFor="pair-current" className="pair__label">
            현재 보고서 <span className="pair__hint">· 오른쪽에 고정</span>
          </label>
          <select
            id="pair-current"
            className="select"
            value={current.rceptNo}
            onChange={(e) => onCurrentChange(e.target.value)}
          >
            {items.map((r, i) => (
              <option key={r.rceptNo} value={r.rceptNo}>
                {reportOptionLabel(r)}
                {i === 0 ? ' · 최신' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {lookup.kind === 'error' && <ErrorState error={lookup.error} onRetry={props.onRetry} />}
    </div>
  )
}

function PreviousSlot({ items, basis, current, previous, lookup, onBasisChange, onPreviousChange }: PairSelectorProps) {
  if (basis === 'CUSTOM') {
    const candidates = customCandidates(items, current)
    return (
      <>
        <label htmlFor="pair-previous" className="pair__label">
          비교 보고서 <span className="pair__hint">· 왼쪽에 표시</span>
        </label>
        <select
          id="pair-previous"
          className="select"
          value={previous?.rceptNo ?? ''}
          onChange={(e) => onPreviousChange(e.target.value || null)}
          disabled={candidates.length === 0}
        >
          <option value="">{candidates.length === 0 ? '고를 수 있는 이전 보고서가 없어요' : '보고서를 고르세요'}</option>
          {candidates.map((r) => (
            <option key={r.rceptNo} value={r.rceptNo}>
              {reportOptionLabel(r)}
            </option>
          ))}
        </select>
        <span className="pair__hint">현재 보고서보다 앞선 기간의 보고서만 고를 수 있어요.</span>
      </>
    )
  }

  return (
    <>
      <span className="pair__label">
        비교 보고서 <span className="pair__hint">· 왼쪽에 표시</span>
      </span>
      {lookup.kind === 'loading' && <p className="pair__value pair__value--muted">비교 기준에 맞는 보고서를 찾는 중…</p>}
      {lookup.kind === 'done' && previous && (
        <p className="pair__value">
          {reportOptionLabel(previous)}
          <span className="pair__hint"> · 기준에 따라 자동 지정</span>
        </p>
      )}
      {lookup.kind === 'done' && !previous && (
        <div className="pair__value pair__value--missing" role="status">
          <p>{lookup.reason ?? '비교 기준에 맞는 이전 보고서가 없어요.'}</p>
          <Button variant="secondary" onClick={() => onBasisChange('CUSTOM')}>
            직접 선택으로 고르기
          </Button>
        </div>
      )}
    </>
  )
}
