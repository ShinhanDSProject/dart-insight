import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import type { Executive, KeyFactChange, KeyFacts, KeyFactReport } from '@/shared/api/keyFacts'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, DataTable, Panel, PanelTitle } from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useKeyFacts } from '../hooks/useKeyFacts'
import {
  changeLine,
  changeMark,
  COLLAPSE_AFTER,
  groupTitles,
  pairDividends,
  pairShareholders,
  rowsOf,
  sectionView,
  type KeyFactGroupKind,
  type PairedRow,
  type SectionView,
} from '../model/keyFacts'

const NO_DATA_TITLE = '공시된 자료가 없어요'

/**
 * 기업 개요 탭의 '최대주주·임원·배당 변화'(#331, FS-47). 최신 정기보고서와 같은 종류의 1년 전 보고서를 나란히 놓고
 * 바뀐 항목을 먼저 보여 준다. 값은 공시 원문 그대로이고 해석·판단을 붙이지 않는다.
 */
export function KeyFactsSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useKeyFacts(corpCode)
  return (
    <Panel className="key-facts" aria-labelledby="key-facts-title">
      <PanelTitle id="key-facts-title">최대주주·임원·배당 변화</PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="최대주주·임원·배당 자료를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) => <KeyFactsView facts={data} />)
        .exhaustive()}
    </Panel>
  )
}

export function KeyFactsView({ facts }: { facts: KeyFacts }) {
  return match(facts.current)
    .with(null, () => <EmptyState title="이 기업의 정기보고서가 없어요" />)
    .with(P.nonNullable, (current) => (
      <>
        <ComparedReports current={current} previous={facts.previous} reason={facts.previousReason} />
        <div className="key-facts__groups">
          <ShareholderGroup facts={facts} />
          <ExecutiveGroup facts={facts} />
          <DividendGroup facts={facts} />
        </div>
      </>
    ))
    .exhaustive()
}

function ComparedReports({
  current,
  previous,
  reason,
}: {
  current: KeyFactReport
  previous: KeyFactReport | null
  reason: KeyFacts['previousReason']
}) {
  const reports = [{ role: '현재', report: current }]
  return (
    <>
      {match(previous)
        .with(null, () => (
          <p className="key-facts__intro">
            {current.reportName}의 공시 내용이에요. {reason?.message ?? '같은 종류의 1년 전 보고서가 없어 비교하지 않았어요.'}
          </p>
        ))
        .with(P.nonNullable, (p) => (
          <p className="key-facts__intro">
            {current.reportName}와 1년 전 같은 종류 보고서인 {p.reportName}의 공시 내용을 나란히 보여 드려요.
          </p>
        ))
        .exhaustive()}
      <DartSourceLine reports={previous === null ? reports : [...reports, { role: '이전', report: previous }]} />
    </>
  )
}

function ShareholderGroup({ facts }: { facts: KeyFacts }) {
  const group = facts.majorShareholders
  const current = sectionView(group.current)
  const previous = sectionView(group.previous)
  const compared = previous.kind === 'available'
  return (
    <GroupBlock kind="majorShareholders" current={current} previous={previous} changes={group.changes}>
      <PairedTable
        caption="최대주주와 특수관계인의 기말 소유 주식 지분율(%)"
        nameHeader="성명"
        valueHeader="기말 지분율(%)"
        rows={pairShareholders(rowsOf(previous), rowsOf(current))}
        compared={compared}
      />
    </GroupBlock>
  )
}

function DividendGroup({ facts }: { facts: KeyFacts }) {
  const group = facts.dividends
  const current = sectionView(group.current)
  const previous = sectionView(group.previous)
  return (
    <GroupBlock kind="dividends" current={current} previous={previous} changes={group.changes}>
      <PairedTable
        caption="배당에 관한 사항의 당기 값(단위는 구분에 적힌 그대로)"
        nameHeader="구분"
        valueHeader="당기"
        rows={pairDividends(rowsOf(previous), rowsOf(current))}
        compared={previous.kind === 'available'}
      />
    </GroupBlock>
  )
}

function ExecutiveGroup({ facts }: { facts: KeyFacts }) {
  const group = facts.executives
  const current = sectionView(group.current)
  const previous = sectionView(group.previous)
  const rows = rowsOf(current)
  return (
    <GroupBlock kind="executives" current={current} previous={previous} changes={group.changes}>
      <Collapsible count={rows.length} unit="명" always>
        <ExecutiveTable rows={rows} />
      </Collapsible>
    </GroupBlock>
  )
}

interface GroupBlockProps<T> {
  kind: KeyFactGroupKind
  current: SectionView<T>
  previous: SectionView<T>
  changes: KeyFactChange[]
  children: ReactNode
}

/** 한 묶음: 제목, 결산기준일, 바뀐 항목, 표. 현재 보고서에 자료가 없으면 '공시된 자료가 없어요' */
function GroupBlock<T>({ kind, current, previous, changes, children }: GroupBlockProps<T>) {
  const titleId = `key-facts-${kind}`
  return (
    <section className="key-facts__group" aria-labelledby={titleId}>
      <h3 id={titleId} className="key-facts__title">
        {groupTitles[kind]}
      </h3>
      {match(current)
        .with({ kind: P.union('no-data', 'no-report') }, () => <EmptyState title={NO_DATA_TITLE} />)
        .with({ kind: 'unavailable' }, () => (
          <EmptyState title="지금은 자료를 불러오지 못했어요">
            <p>잠시 뒤 다시 열어 주세요.</p>
          </EmptyState>
        ))
        .with({ kind: 'available' }, (view) => (
          <>
            {view.settlementDate !== null && (
              <p className="key-facts__meta">결산기준일 {formatDate(view.settlementDate)}</p>
            )}
            <ChangeSummary kind={kind} previous={previous} changes={changes} />
            {children}
          </>
        ))
        .exhaustive()}
    </section>
  )
}

/** 바뀐 항목을 먼저 보인다. 이전 보고서와 비교하지 못했으면 그 이유 */
function ChangeSummary<T>({
  kind,
  previous,
  changes,
}: {
  kind: KeyFactGroupKind
  previous: SectionView<T>
  changes: KeyFactChange[]
}) {
  return match(previous)
    .with({ kind: 'no-report' }, () => <p className="key-facts__note">비교할 1년 전 보고서가 없어요.</p>)
    .with({ kind: 'no-data' }, () => (
      <p className="key-facts__note">1년 전 보고서에는 공시된 자료가 없어 비교하지 않았어요.</p>
    ))
    .with({ kind: 'unavailable' }, () => (
      <p className="key-facts__note">1년 전 보고서의 자료를 불러오지 못해 비교하지 않았어요.</p>
    ))
    .with({ kind: 'available' }, () =>
      changes.length === 0 ? (
        <p className="key-facts__note">1년 전 보고서와 비교해 바뀐 항목이 없어요.</p>
      ) : (
        <ul className="key-facts__changes" aria-label={`${groupTitles[kind]} 바뀐 항목`}>
          {changes.map((change) => {
            const mark = changeMark(change.type)
            return (
              <li key={`${change.type}-${change.name}-${change.stockKind ?? ''}-${change.field}`}>
                <Badge className="key-facts__mark">
                  <span aria-hidden="true">{mark.symbol}</span> {mark.label}
                </Badge>{' '}
                {changeLine(kind, change)}
              </li>
            )
          })}
        </ul>
      ),
    )
    .exhaustive()
}

/** 행이 많으면 '전체 보기'로 펼친다. always면 행 수와 상관없이 접어 둔다 */
function Collapsible({
  count,
  unit,
  always = false,
  children,
}: {
  count: number
  unit: string
  always?: boolean
  children: ReactNode
}) {
  if (!always && count <= COLLAPSE_AFTER) return <>{children}</>
  return (
    <details className="key-facts__details">
      <summary>
        전체 보기 ({count}
        {unit})
      </summary>
      {children}
    </details>
  )
}

function PairedTable({
  caption,
  nameHeader,
  valueHeader,
  rows,
  compared,
}: {
  caption: string
  nameHeader: string
  valueHeader: string
  rows: PairedRow[]
  compared: boolean
}) {
  return (
    <Collapsible count={rows.length} unit="줄">
      <DataTable caption={caption} density="dense">
        <thead>
          <tr>
            <th scope="col">{nameHeader}</th>
            <th scope="col">주식 종류</th>
            {compared && (
              <th scope="col" className="num">
                1년 전 {valueHeader}
              </th>
            )}
            <th scope="col" className="num">
              {compared ? `현재 ${valueHeader}` : valueHeader}
            </th>
            {compared && <th scope="col">변화</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.name}</th>
              <td>{row.stockKind ?? '-'}</td>
              {compared && <td className="num">{row.before ?? '-'}</td>}
              <td className="num">{row.after ?? '-'}</td>
              {compared && <td>{row.changed ? <Badge>바뀜</Badge> : '-'}</td>}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Collapsible>
  )
}

function ExecutiveTable({ rows }: { rows: Executive[] }) {
  return (
    <DataTable caption="현재 보고서의 임원 현황" density="dense">
      <thead>
        <tr>
          <th scope="col">성명</th>
          <th scope="col">직위</th>
          <th scope="col">등기 구분</th>
          <th scope="col">상근 여부</th>
          <th scope="col">임기 만료일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.name ?? ''}-${index}`}>
            <th scope="row">{row.name ?? '-'}</th>
            <td>{row.position ?? '-'}</td>
            <td>{row.registeredType ?? '-'}</td>
            <td>{row.fullTime ?? '-'}</td>
            <td>{row.termEnd ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
