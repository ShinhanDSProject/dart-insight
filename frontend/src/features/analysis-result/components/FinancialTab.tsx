import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { FinancialChangeItem, FinancialOrder, SjDiv, StatementSummary } from '@/shared/api/results'
import {
  Button,
  DataTable,
  DataTableRow,
  FieldHint,
  FieldLabel,
  Icon,
  Input,
  Notice,
  Panel,
  SegmentedControl,
  Select,
  Skeleton,
  SortableHeader,
} from '@/shared/ui'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { downloadTextFile } from '@/shared/lib/download'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { EvidencePanel } from './EvidencePanel'
import { FinancialChart } from './FinancialChart'
import {
  amountPeriodLabel,
  formatAmount,
  formatChange,
  formatRate,
  missingValueLabel,
  isProfitState,
  shortCalcLabel,
  unitLabel,
  unitOptions,
  type AmountUnit,
} from '../model/format'
import { useAccountSearch } from '../hooks/useAccountSearch'
import { useFinancialChanges } from '../hooks/useFinancialChanges'
import { ACCOUNT_SEARCH_MAX_LENGTH, filterAccounts, foundAccountsLabel } from '../model/accountFilter'
import { accountLabel, componentName } from '../model/accountLabel'
import { scaleLine } from '../model/changeScale'
import { buildFinancialCsv, csvFileName } from '../model/financialCsv'
import type { FinancialViewChange, SourceTarget } from '../model/resultParams'
import {
  ariaSortOf,
  nextFinancialSort,
  originalOrder,
  sortFinancialItems,
  type FinancialSort,
} from '../model/financialSort'

const viewOptions = [
  { value: 'all', label: '전체 계정' },
  { value: 'changed', label: '변경 항목만' },
] as const

const statementOptions: { sjDiv: SjDiv; label: string }[] = [
  { sjDiv: 'BS', label: '재무상태표' },
  { sjDiv: 'IS', label: '손익계산서' },
  { sjDiv: 'CIS', label: '포괄손익계산서' },
  { sjDiv: 'CF', label: '현금흐름표' },
  { sjDiv: 'SCE', label: '자본변동표' },
]

const orderOptions: { value: FinancialOrder; label: string }[] = [
  { value: 'document', label: '원문 순서' },
  { value: 'scale', label: '규모 큰 순' },
]

const ACCOUNT_SEARCH_INPUT_ID = 'fin-account-query'

interface FinancialTabProps {
  analysis: Analysis
  sjDiv: SjDiv
  changedOnly: boolean
  unit: AmountUnit
  /** 계정 찾기 검색어(FS-14). null이면 모든 계정 */
  accountQuery: string | null
  /** 계정 목록 순서(#480). scale이면 서버가 규모(기준 대비 비율의 절댓값) 큰 순으로 준다. 주소에 남는다 */
  order: FinancialOrder
  /** 근거를 보고 있는 계정(3.3) */
  selectedChangeId: number | null
  onChange: (changes: FinancialViewChange) => void
  /** 근거 패널의 '이 계정 변화 AI에게 묻기'(3.10). 질문을 보내고 AI 질문 탭으로 옮긴다 */
  onAsk: (question: string) => void
  asking: boolean
  onOpenSource?: (target: SourceTarget) => void
  onOpenText?: (changeId: number) => void
}

/** W-03 ② 재무 수치 변화(3.1). 이 분석의 결과만 보여 준다. 계정 이름을 누르면 수치 근거(3.3)를 오른쪽 패널로 연다.
 * 증감액·증감률 머리글로 정렬하고, 계산하지 못한 행은 정렬해도 맨 아래에 둔다(FS-4 AC9).
 * 계정 이름으로 찾으면 받아 둔 계정을 화면에서 걸러 표·차트·CSV에 함께 쓴다(FS-14).
 * 증감 옆에 매출액·자산총계 대비 크기를 보조 줄로 보이고, '규모 큰 순'으로 고를 수 있다(#480, FS-63). */
export function FinancialTab({
  analysis,
  sjDiv,
  changedOnly,
  unit,
  accountQuery,
  order,
  selectedChangeId,
  onChange,
  onAsk,
  asking,
  onOpenSource,
  onOpenText,
}: FinancialTabProps) {
  const { state, reload, statements } = useFinancialChanges(analysis.analysisId, sjDiv, changedOnly, order)
  const selected = statements.find((s) => s.sjDiv === sjDiv)
  const basis = selected?.amountBasis ?? null
  const currency = state.status === 'success' ? (state.data.items.find((i) => i.currency)?.currency ?? null) : null
  // 표 정렬은 공유할 화면 상태가 아니라서 컴포넌트 상태로 둔다(ST-6)
  const [sort, setSort] = useState<FinancialSort>(originalOrder)
  const searchBox = useAccountSearch(accountQuery, (q) => onChange({ q }))
  // 지우면 바로 다시 입력할 수 있게 입력창으로 초점을 옮긴다
  const clearSearch = () => {
    searchBox.clear()
    document.getElementById(ACCOUNT_SEARCH_INPUT_ID)?.focus()
  }
  // 찾은 계정. 표·차트·CSV가 모두 이 목록을 쓴다
  const shownItems = state.status === 'success' ? filterAccounts(state.data.items, accountQuery) : []

  // CSV는 표와 같은 재무제표·보기·찾기·정렬의 계정을 그대로 옮긴다. 불러오는 중·오류·빈 결과면 받지 않는다(FS-8 R4)
  const exportItems = sortFinancialItems(shownItems, sort)
  const downloadCsv = () => {
    const statementLabel = statementOptions.find((o) => o.sjDiv === sjDiv)?.label ?? sjDiv
    const csv = buildFinancialCsv({
      statementLabel,
      items: exportItems,
      previousRceptNo: analysis.previous.rceptNo,
      currentRceptNo: analysis.current.rceptNo,
    })
    downloadTextFile(
      csvFileName(analysis.corpName, analysis.previous.reportName, analysis.current.reportName, statementLabel),
      csv,
    )
  }

  // 근거를 연 버튼(차트 막대 또는 표의 계정 이름). 패널을 닫으면 그 버튼으로 초점을 돌려준다
  const openerRef = useRef<HTMLElement | null>(null)
  const openEvidence = (changeId: number) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    onChange({ change: changeId === selectedChangeId ? null : changeId })
  }

  // 근거 패널이 열리면 본문 폭이 줄어 표가 다시 그려지므로, 고른 계정 행이 화면 밖으로 밀리지 않게 한다
  useEffect(() => {
    if (selectedChangeId === null) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(evidenceButtonId(selectedChangeId))?.scrollIntoView?.({ block: 'nearest' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [selectedChangeId])

  return (
    <Panel aria-label="재무 수치 변화">
      <div className="fin-controls">
        <FieldLabel htmlFor="fin-statement">재무제표</FieldLabel>
        <Select
          id="fin-statement"
          value={sjDiv}
          onChange={(e) => onChange({ sj: e.target.value as SjDiv })}
        >
          {statementOptions.map((option) => {
            const summary = statements.find((s) => s.sjDiv === option.sjDiv)
            return (
              <option key={option.sjDiv} value={option.sjDiv}>
                {statementOptionLabel(option.label, summary)}
              </option>
            )
          })}
        </Select>
        <span className="fin-controls__basis">{analysis.fsDiv === 'OFS' ? '별도' : '연결'} 재무제표 기준</span>
        <SegmentedControl
          aria-label="보기"
          options={viewOptions}
          value={changedOnly ? 'changed' : 'all'}
          onChange={(view) => onChange({ changed: view === 'changed' })}
        />
        <FieldLabel htmlFor="fin-order">정렬</FieldLabel>
        <Select
          id="fin-order"
          value={order}
          onChange={(e) => {
            // 고른 순서가 보이도록 머리글 정렬은 풀어 둔다
            setSort(originalOrder)
            onChange({ order: e.target.value as FinancialOrder })
          }}
        >
          {orderOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <FieldLabel htmlFor="fin-unit">단위</FieldLabel>
        <Select id="fin-unit" value={unit} onChange={(e) => onChange({ unit: e.target.value as AmountUnit })}>
          {unitOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <div className="fin-search">
          <FieldLabel htmlFor={ACCOUNT_SEARCH_INPUT_ID}>계정 찾기</FieldLabel>
          <div className="fin-search__box">
            <Input
              id={ACCOUNT_SEARCH_INPUT_ID}
              type="text"
              className="fin-search__input"
              placeholder="예: 차입금"
              autoComplete="off"
              maxLength={ACCOUNT_SEARCH_MAX_LENGTH}
              value={searchBox.input}
              aria-describedby={accountQuery !== null ? 'fin-account-count' : undefined}
              onChange={(e) => searchBox.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchBox.input !== '') clearSearch()
              }}
            />
            {searchBox.input !== '' && (
              <Button variant="icon" className="fin-search__clear" aria-label="검색어 지우기" onClick={clearSearch}>
                <Icon name="x" size={16} />
              </Button>
            )}
          </div>
          <FieldHint id="fin-account-count" className="fin-search__count" aria-live="polite">
            {accountQuery !== null && state.status === 'success' ? foundAccountsLabel(shownItems.length) : ''}
          </FieldHint>
        </div>
        <Button className="fin-controls__export" disabled={exportItems.length === 0} onClick={downloadCsv}>
          CSV 내려받기
        </Button>
      </div>

      {selected && !selected.comparable && (
        <Notice tone="attention" role="status">
          {selected.label}는 비교하지 않아요. {selected.note}
        </Notice>
      )}

      {match(state)
        .with({ status: 'loading' }, () => <Skeleton label="계정별 결과를 불러오는 중입니다…" shape="block" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success', data: { items: [] } }, () => (
          <EmptyState title={changedOnly ? '바뀐 계정이 없어요.' : '이 재무제표에는 계정이 없어요.'}>
            {changedOnly && <p>'전체 계정'을 고르면 값이 같은 계정도 볼 수 있어요.</p>}
          </EmptyState>
        ))
        // 받은 계정은 있지만 찾는 이름이 없을 때. 재무제표·보기 고르기는 위에 그대로 둔다(FS-14)
        .with(
          { status: 'success' },
          () => shownItems.length === 0,
          () => (
            <EmptyState title="찾는 계정이 없어요">
              <p>계정 이름의 일부만 입력해도 찾을 수 있어요.</p>
              <Button onClick={clearSearch}>검색어 지우기</Button>
            </EmptyState>
          ),
        )
        .with({ status: 'success' }, () => (
          <>
          {selected?.comparable !== false && (
            <FinancialChart
              items={shownItems}
              statementLabel={selected?.label ?? ''}
              unit={unit}
              currency={currency}
              previousPeriod={amountPeriodLabel(analysis.previous, basis)}
              currentPeriod={amountPeriodLabel(analysis.current, basis)}
              selectedChangeId={selectedChangeId}
              onSelect={openEvidence}
            />
          )}
          <DataTable
            caption={`계정별 이전 값, 현재 값, 증감액, 증감률. 계정 이름을 누르면 근거를 볼 수 있어요. 단위 ${unitLabel(unit, currency)}`}
            density="dense"
            stickyHeader
            scrollClassName="fin-table__scroll"
          >
            <thead>
              <tr>
                <th scope="col">계정</th>
                <th scope="col" className="num">
                  이전 · {amountPeriodLabel(analysis.previous, basis)}
                </th>
                <th scope="col" className="num">
                  현재 · {amountPeriodLabel(analysis.current, basis)}
                </th>
                <SortableHeader
                  numeric
                  sort={ariaSortOf(sort, 'changeAmount')}
                  onSort={() => setSort((s) => nextFinancialSort(s, 'changeAmount'))}
                >
                  증감액
                </SortableHeader>
                <SortableHeader
                  numeric
                  sort={ariaSortOf(sort, 'changeRate')}
                  onSort={() => setSort((s) => nextFinancialSort(s, 'changeRate'))}
                >
                  증감률
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {exportItems.map((item) => (
                <ChangeRow
                  key={item.changeId}
                  item={item}
                  unit={unit}
                  selected={item.changeId === selectedChangeId}
                  onSelect={() => openEvidence(item.changeId)}
                />
              ))}
            </tbody>
          </DataTable>
          </>
        ))
        .exhaustive()}
      {selectedChangeId !== null && (
        <EvidencePanel
          key={selectedChangeId}
          analysis={analysis}
          changeId={selectedChangeId}
          unit={unit}
          onAsk={onAsk}
          asking={asking}
          onOpenSource={onOpenSource}
          onOpenText={onOpenText}
          onClose={() => {
            const id = selectedChangeId
            const opener = openerRef.current
            onChange({ change: null })
            // 닫으면 근거를 연 버튼(없으면 그 계정 이름 버튼)으로 초점을 돌려준다
            requestAnimationFrame(() =>
              (opener?.isConnected ? opener : document.getElementById(evidenceButtonId(id)))?.focus(),
            )
          }}
        />
      )}
      <DartSourceLine
        reports={[
          { role: '비교', report: analysis.previous },
          { role: '현재', report: analysis.current },
        ]}
      />
      <p className="panel__note">
        단위 {unitLabel(unit, currency)}. 증가·감소는 ▲▼와 부호로 표시하고 좋고 나쁨의 평가와 구분해요. 없는 값은 0으로 보지 않아요.
        '매출액 대비'·'자산총계 대비'는 증감액을 현재 보고서의 기준 계정 값으로 나눈 크기예요.
      </p>
    </Panel>
  )
}

/** 재무제표 고르기 문구. 받은 개수가 있으면 붙인다 */
function statementOptionLabel(label: string, summary: StatementSummary | undefined): string {
  if (summary === undefined) return label
  if (!summary.comparable) return `${label} · 비교 안 함`
  return `${label} · 바뀐 ${summary.changed} / 전체 ${summary.total}`
}

function evidenceButtonId(changeId: number): string {
  return `evidence-button-${changeId}`
}

interface ChangeRowProps {
  item: FinancialChangeItem
  unit: AmountUnit
  selected: boolean
  onSelect: () => void
}

function ChangeRow({ item, unit, selected, onSelect }: ChangeRowProps) {
  const previous = formatAmount(item.previousAmount, unit) ?? missingValueLabel(item.calcStatus, 'previous')
  const current = formatAmount(item.currentAmount, unit) ?? missingValueLabel(item.calcStatus, 'current')
  const change = formatChange(item.changeAmount, unit)
  const rate = formatRate(item.changeRate)
  const reason = shortCalcLabel(item.calcStatus)
  const scale = scaleLine(item.scale)
  return (
    <DataTableRow selected={selected}>
      <th scope="row">
        <Button
          variant="link"
          id={evidenceButtonId(item.changeId)}
          aria-pressed={selected}
          aria-label={`${accountLabel(item)} 근거 ${selected ? '닫기' : '보기'}`}
          onClick={onSelect}
        >
          {item.accountName}
          {componentName(item.accountDetail) && <span className="fin-account__component"> · {componentName(item.accountDetail)}</span>}
        </Button>
      </th>
      <td className="num">{previous}</td>
      <td className="num">{current}</td>
      {change === null ? (
        <td className="num fin-table__reason" colSpan={2} title={item.calcMessage ?? undefined}>
          {reason}
        </td>
      ) : (
        <>
          <td className="num">
            {change}
            {scale !== null && <span className="fin-table__scale">{scale}</span>}
          </td>
          <td className={`num${rate === null && !isProfitState(item.calcStatus) ? ' fin-table__reason' : ''}`} title={item.calcMessage ?? undefined}>
            {rate ?? reason}
          </td>
        </>
      )}
    </DataTableRow>
  )
}
