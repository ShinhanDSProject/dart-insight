import { Link, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import { Tabs, type TabItem } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { companyPageTitle } from '@/shared/lib/pageTitle'
import { CompanyOverviewTab } from './components/CompanyOverviewTab'
import { FavoriteToggle } from './components/FavoriteToggle'
import { ReportCompareView } from './components/ReportCompareView'
import { useCompany } from './hooks/useCompany'
import { useCompanyView } from './hooks/useCompanyView'
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
        .with({ status: 'loading' }, () => <LoadingState message="기업 정보를 불러오는 중입니다…" />)
        .with({ status: 'error' }, ({ error }) => (
          <>
            <h1 className="page__title">기업</h1>
            <ErrorState error={error} onRetry={reload} messages={errorMessages} />
          </>
        ))
        .with({ status: 'success' }, ({ data }) => (
          <>
            <CompanyHeading company={data} />
            <Tabs label="기업 화면" items={viewTabs} value={view} onChange={selectView} />
            {match(view)
              .with('overview', () => <CompanyOverviewTab corpCode={corpCode} company={data} />)
              .with('compare', () => <ReportCompareView corpCode={corpCode} />)
              .exhaustive()}
          </>
        ))
        .exhaustive()}
    </section>
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
