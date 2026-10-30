import { match, P } from 'ts-pattern'
import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import { Button, FieldHint, FieldLabel, ReportCard, ReportCardPair, SegmentedControl, Select } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { basisOptions } from '@/shared/lib/comparisonBasis'
import { customCandidates, reportOptionLabel, type PairLookup } from '../model/pairSelection'
import { ReportDetail } from './ReportDetail'

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
 * W-01 ② 비교 기준과 두 보고서 고르기(2.1, #549).
 * 비교 기준 세그먼트 아래에 이전·현재 보고서 카드 두 장을 나란히 둔다(현재는 옅은 바탕, 오른쪽).
 * 비교 기준을 바꾸면 왼쪽 이전 보고서만 바뀐다. 카드마다 고르기 칸과 '보고서 자세히'가 붙는다.
 */
export function PairSelector(props: PairSelectorProps) {
  const { items, basis, current, previous, lookup, onBasisChange, onCurrentChange } = props

  return (
    <div className="pair">
      <div className="pair__basis">
        <FieldLabel as="span" id="basis-label">
          비교 기준
        </FieldLabel>
        <SegmentedControl aria-labelledby="basis-label" options={basisOptions} value={basis} onChange={onBasisChange} />
        <FieldHint>전년 동기는 작년 같은 기간 보고서와 비교해요. 계절에 따른 차이를 덜 받아요.</FieldHint>
      </div>

      <ReportCardPair>
        <ReportCard side="previous" report={previous} emptyText={<PreviousEmpty {...props} />}>
          <div className="report-card__extra">
            <PreviousControl {...props} />
            {previous && <ReportDetail key={previous.rceptNo} rceptNo={previous.rceptNo} />}
          </div>
        </ReportCard>
        <ReportCard side="current" report={current}>
          <div className="report-card__extra">
            <FieldLabel htmlFor="pair-current">현재 보고서 바꾸기</FieldLabel>
            <Select id="pair-current" value={current.rceptNo} onChange={(e) => onCurrentChange(e.target.value)}>
              {items.map((r, i) => (
                <option key={r.rceptNo} value={r.rceptNo}>
                  {reportOptionLabel(r)}
                  {i === 0 ? ' · 최신' : ''}
                </option>
              ))}
            </Select>
            <ReportDetail key={current.rceptNo} rceptNo={current.rceptNo} />
          </div>
        </ReportCard>
      </ReportCardPair>
      {match(lookup)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={props.onRetry} />)
        .with({ status: P.union('idle', 'loading', 'success') }, () => null)
        .exhaustive()}
    </div>
  )
}

/** 이전 보고서가 아직 없을 때 카드에 보이는 문구 */
function PreviousEmpty({ basis, lookup }: PairSelectorProps) {
  if (basis === 'CUSTOM') return <>아래에서 이전 보고서를 고르세요.</>
  return match(lookup)
    .with({ status: 'loading' }, () => <>비교 기준에 맞는 보고서를 찾는 중…</>)
    .with({ status: 'success' }, ({ data }) => <>{data.reason ?? '비교 기준에 맞는 이전 보고서가 없어요.'}</>)
    .with({ status: P.union('idle', 'error') }, () => <>이전 보고서를 정하지 못했어요.</>)
    .exhaustive()
}

/** 직접 선택이면 이전 보고서 고르는 칸, 아니면 자동 지정 안내나 '직접 선택으로 고르기' */
function PreviousControl({ items, basis, current, previous, lookup, onBasisChange, onPreviousChange }: PairSelectorProps) {
  if (basis === 'CUSTOM') {
    const candidates = customCandidates(items, current)
    return (
      <>
        <FieldLabel htmlFor="pair-previous">이전 보고서 고르기</FieldLabel>
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

  return match(lookup)
    .with({ status: 'success' }, () =>
      previous ? (
        <FieldHint>비교 기준에 따라 자동으로 정했어요.</FieldHint>
      ) : (
        <Button variant="secondary" onClick={() => onBasisChange('CUSTOM')}>
          직접 선택으로 고르기
        </Button>
      ),
    )
    .with({ status: P.union('idle', 'loading', 'error') }, () => null)
    .exhaustive()
}
