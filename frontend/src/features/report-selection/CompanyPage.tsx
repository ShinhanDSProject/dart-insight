import type { CSSProperties, ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import { Skeleton, Tabs, type TabItem } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { companyPageTitle } from '@/shared/lib/pageTitle'
import { CompanyOverviewTab } from './components/CompanyOverviewTab'
import { FavoriteToggle } from './components/FavoriteToggle'
import { ReportCompareView } from './components/ReportCompareView'
import { useCompactHeader } from './hooks/useCompactHeader'
import { useCompany } from './hooks/useCompany'
import { useCompanyView } from './hooks/useCompanyView'
import { useRecordCurrentCompany } from '@/shared/hooks/useCurrentCompany'
import type { CompanyView } from './model/companyView'
import './report-selection.css'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
}

const viewTabs: readonly TabItem<CompanyView>[] = [
  { value: 'overview', label: '기업 개요' },
  { value: 'compare', label: '보고서 비교' },
]

const viewTitles: Record<CompanyView, string> = {
  overview: '기업 개요',
  compare: '보고서 고르기',
}

/**
 * 기업 화면. 회사명 아래 탭 '기업 개요 | 보고서 비교'(주소 ?view=overview|compare, FS-45).
 * 기본은 보고서 비교라 ?view가 없던 기존 주소와 흐름은 그대로다.
 * 탭마다 자기 자료를 따로 불러오므로 한쪽이 OpenDART 오류여도 다른 탭은 열린다.
 * 탭 줄은 화면 위에 붙고, 회사명이 화면 위로 나가면 작게 접혀 탭 줄 오른쪽에 회사명만 남는다(FS-58, CompanyFrame).
 */
export function CompanyPage() {
  const { corpCode = '' } = useParams()
  const { view, selectView } = useCompanyView()
  const { state, reload } = useCompany(corpCode)
  useDocumentTitle(
    companyPageTitle(
      match(state)
        .with({ status: 'success' }, ({ data }) => data.corpName)
        .with({ status: P.union('loading', 'error') }, () => null)
        .exhaustive(),
      viewTitles[view],
    ),
  )

  return (
    <section className="page">
      <Breadcrumb />
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton label="기업 정보를 불러오는 중입니다…" shape="line" count={2} className="company-skeleton" />
        ))
        .with({ status: 'error' }, ({ error }) => (
          <>
            <h1 className="page__title">기업</h1>
            <ErrorState error={error} onRetry={reload} messages={errorMessages} />
          </>
        ))
        .with({ status: 'success' }, ({ data }) => (
          <CompanyFrame company={data} view={view} onSelectView={selectView}>
            {match(view)
              .with('overview', () => <CompanyOverviewTab corpCode={corpCode} company={data} />)
              .with('compare', () => <ReportCompareView corpCode={corpCode} />)
              .exhaustive()}
          </CompanyFrame>
        ))
        .exhaustive()}
    </section>
  )
}

interface CompanyFrameProps {
  company: Company
  view: CompanyView
  onSelectView: (view: CompanyView) => void
  children: ReactNode
}

/**
 * 회사명과 위에 붙는 탭 줄(FS-58). 탭 줄 바로 위의 센티넬이 화면 밖으로 나가면 data-compact로 접는다.
 * 접혀도 탭 줄 높이는 그대로라(회사명은 이미 있던 자리에 나타나기만 함) 아래 내용이 튀지 않는다.
 * 탭 줄 높이는 --company-bar-height로 넘겨, 기업 개요의 바로 가기 바가 그 밑에 붙는다.
 */
function CompanyFrame({ company, view, onSelectView, children }: CompanyFrameProps) {
  // 왼쪽 메뉴 '지금 보는 기업'을 이 기업으로 바꾼다(#502)
  useRecordCurrentCompany({ corpCode: company.corpCode, corpName: company.corpName, stockCode: company.stockCode })
  const { sentinelRef, barRef, compact, height } = useCompactHeader<HTMLDivElement, HTMLDivElement>()
  return (
    <>
      <CompanyHeading company={company} />
      <div ref={sentinelRef} className="company-bar__sentinel" aria-hidden="true" />
      <div ref={barRef} className="company-bar" data-compact={compact ? '' : undefined}>
        <Tabs label="기업 화면" items={viewTabs} value={view} onChange={onSelectView} />
        {/* 회사명(h1)은 위에 그대로 있어 화면 읽기 도구에는 한 번만 읽힌다 */}
        <span className="company-bar__name" aria-hidden="true">
          {company.corpName}
        </span>
      </div>
      <div className="company-body" style={{ '--company-bar-height': `${height}px` } as CSSProperties}>
        {children}
      </div>
    </>
  )
}

function CompanyHeading({ company }: { company: Company }) {
  return (
    <div className="company-heading">
      <h1 className="page__title company-title">
        {company.corpName}
        <span className="company-title__code">{company.listed ? company.stockCode : '비상장'}</span>
      </h1>
      <FavoriteToggle company={company} />
    </div>
  )
}

function Breadcrumb() {
  return (
    <nav className="breadcrumb" aria-label="현재 위치">
      <Link to="/">기업 검색</Link> / 기업
    </nav>
  )
}
