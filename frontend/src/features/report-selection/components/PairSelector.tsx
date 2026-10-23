import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import { Button, FieldHint, FieldLabel, SegmentedControl, Select } from '@/shared/ui'
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
        <FieldLabel as="span" id="basis-label">
          비교 기준
        </FieldLabel>
        <SegmentedControl aria-labelledby="basis-label" options={basisOptions} value={basis} onChange={onBasisChange} />
        <FieldHint>기본 비교 기준은 결정 전이라 전년 동기로 두었어요.</FieldHint>
      </div>

      <div className="pair__slots">
        <div className="pair__slot">
          <PreviousSlot {...props} />
        </div>
        <div className="pair__slot">
          <FieldLabel htmlFor="pair-current">
            현재 보고서 <FieldHint>· 오른쪽에 고정</FieldHint>
          </FieldLabel>
          <Select
            id="pair-current"
            value={current.rceptNo}
            onChange={(e) => onCurrentChange(e.target.value)}
          >
            {items.map((r, i) => (
              <option key={r.rceptNo} value={r.rceptNo}>
                {reportOptionLabel(r)}
                {i === 0 ? ' · 최신' : ''}
              </option>
            ))}
          </Select>
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
        <FieldLabel htmlFor="pair-previous">
          비교 보고서 <FieldHint>· 왼쪽에 표시</FieldHint>
        </FieldLabel>
        <Select
          id="pair-previous"
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
        </Select>
        <FieldHint>현재 보고서보다 앞선 기간의 보고서만 고를 수 있어요.</FieldHint>
      </>
    )
  }

  return (
    <>
      <FieldLabel as="span">
        비교 보고서 <FieldHint>· 왼쪽에 표시</FieldHint>
      </FieldLabel>
      {lookup.kind === 'loading' && <p className="pair__value pair__value--muted">비교 기준에 맞는 보고서를 찾는 중…</p>}
      {lookup.kind === 'done' && previous && (
        <p className="pair__value">
          {reportOptionLabel(previous)}
          <FieldHint> · 기준에 따라 자동 지정</FieldHint>
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
