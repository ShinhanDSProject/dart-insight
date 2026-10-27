import { useState } from 'react'
import { match } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import type { FsDiv } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { reportTypeLabel } from '@/shared/lib/reportLabels'
import { Panel, PanelTitle, SegmentedControl, type SegmentOption } from '@/shared/ui'
import { CompanyPicker } from './components/CompanyPicker'
import { ComparisonTable } from './components/ComparisonTable'
import { useCompanyComparison } from './hooks/useCompanyComparison'
import { useComparisonQuery } from './hooks/useComparisonQuery'
import {
  addCompany,
  buildColumns,
  FULL_MESSAGE,
  MAX_COMPANIES,
  MIN_COMPANIES,
  PERIOD_MISMATCH_MESSAGE,
  periodsDiffer,
  removeCompany,
} from './model/companyComparison'
import './company-comparison.css'

const typeOptions: readonly SegmentOption<ReportType>[] = (['ANNUAL', 'HALF', 'Q1', 'Q3'] as const).map((value) => ({
  value,
  label: reportTypeLabel(value),
}))

const fsDivOptions: readonly SegmentOption<FsDiv>[] = [
  { value: 'CFS', label: '연결' },
  { value: 'OFS', label: '별도' },
]

/** 표 위 한 줄 안내. 기업이 모자라면 고르기 안내, 대상 기간이 다르면 경고 */
function statusMessage(count: number, periodMismatch: boolean): string {
  if (count < MIN_COMPANIES) {
    return `비교할 기업을 ${MIN_COMPANIES}곳 이상 골라 주세요. 위 검색 칸이나 관심 기업에서 최대 ${MAX_COMPANIES}곳까지 고를 수 있어요.`
  }
  if (periodMismatch) return `${PERIOD_MISMATCH_MESSAGE}. 기업마다 결산월이나 최신 보고서가 달라 대상 기간이 다를 수 있어요.`
  return `${count}곳을 같은 종류 보고서로 나란히 보여 드려요.`
}

/**
 * 여러 기업 나란히 보기(FS-56, #412). 2~4곳을 고르면 기업마다 고른 종류의 최신 보고서 주요계정·비율을 한 표에 놓는다.
 * 기존 주요 재무 흐름 API를 기업마다 부르고(API 변경 없음), 비율은 shared/lib/financialRatios로 코드가 계산한다.
 * 비교 조건은 주소에 두어(?corps=&type=&fs=) 같은 주소로 같은 비교를 다시 연다. 정렬·순위·평가 문구는 두지 않는다.
 */
export function CompanyComparisonPage() {
  useDocumentTitle(pageTitle(['기업 나란히 보기']))
  const { corps, type, fsDiv, setCorps, setType, setFsDiv } = useComparisonQuery()
  const { loads, retry } = useCompanyComparison(corps, fsDiv)
  const [names, setNames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  const columns = buildColumns(corps, loads, fsDiv, type, names)
  const nameOf = (corpCode: string) => columns.find((c) => c.corpCode === corpCode)?.name ?? corpCode

  function add(company: Company) {
    match(addCompany(corps, company.corpCode))
      .with({ status: 'added' }, ({ corps: next }) => {
        setNames((prev) => ({ ...prev, [company.corpCode]: company.corpName }))
        setMessage(null)
        setCorps(next)
      })
      .with({ status: 'full' }, () => setMessage(FULL_MESSAGE))
      .with({ status: 'duplicate' }, () => undefined)
      .exhaustive()
  }

  function remove(corpCode: string) {
    setMessage(null)
    setCorps(removeCompany(corps, corpCode))
  }

  return (
    <section className="page company-compare">
      <h1 className="page__title">기업 나란히 보기</h1>
      <p className="page__lead">
        {MIN_COMPANIES}~{MAX_COMPANIES}곳을 고르면 기업마다 고른 종류의 최신 보고서에서 주요계정과 비율을 한 표에 나란히 보여
        드려요. 기업은 고른 순서대로 놓고, 순위를 매기지 않아요.
      </p>

      <Panel aria-labelledby="company-compare-pick">
        <PanelTitle id="company-compare-pick">비교할 기업</PanelTitle>
        <CompanyPicker corps={corps} nameOf={nameOf} onAdd={add} onRemove={remove} message={message} />
      </Panel>

      <Panel aria-labelledby="company-compare-table">
        <div className="company-compare__head-row">
          <PanelTitle id="company-compare-table">주요 수치</PanelTitle>
          <div className="company-compare__controls">
            <SegmentedControl aria-label="보고서 종류" options={typeOptions} value={type} onChange={setType} />
            <SegmentedControl aria-label="재무제표 기준" options={fsDivOptions} value={fsDiv} onChange={setFsDiv} />
          </div>
        </div>
        {/* 안내·경고는 늘 같은 한 줄 자리에 둬, 나타나고 사라질 때 표가 위아래로 밀리지 않게 한다(#424) */}
        <p
          className={periodsDiffer(columns) ? 'company-compare__status company-compare__status--attention' : 'company-compare__status'}
          role="status"
        >
          {statusMessage(corps.length, periodsDiffer(columns))}
        </p>
        <ComparisonTable columns={columns} type={type} onRetry={retry} />
        <p className="panel__note">
          {fsDiv === 'CFS' ? '연결' : '별도'} 기준 · 재무상태표는 기말 잔액, 손익은 사업연도 시작부터 누적 금액이에요
          (연환산하지 않아요). 금액 단위는 원이고 조·억으로 줄여 보여 드려요. 값이 없으면 0이 아니라 '자료 없음'이에요.
        </p>
        <p className="panel__note">비율은 주요계정 값으로 코드가 계산했어요. 업종이나 기준값과 비교하지 않아요.</p>
        <p className="panel__note">
          출처: DART(OpenDART 단일회사 주요계정). 열 머리글에서 근거 보고서의 DART 원문을 열 수 있어요.
        </p>
      </Panel>
    </section>
  )
}
