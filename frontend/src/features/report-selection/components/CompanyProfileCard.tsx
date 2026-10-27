import { useId } from 'react'
import { match, P } from 'ts-pattern'
import type { CompanyOverview } from '@/shared/api/companies'
import { Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { formatDate } from '@/shared/lib/reportLabels'
import { overviewFacts, type OverviewFact } from '../model/companyOverview'
import { useCompanyOverview } from '../hooks/useCompanyOverview'
import type { OverviewSectionProps } from '../model/overviewSections'

const errorMessages: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 기업 개황을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 기업 개황을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

const refreshErrorMessages: Record<string, string> = {
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘었어요',
  DART_REQUEST_FAILED: 'OpenDART에 연결하지 못했어요',
}

/** 기업 개황 카드(FS-45). OpenDART 기업개황(company.json) 값을 고치지 않고 보여 주고, 받은 날짜와 출처를 함께 적는다. */
export function CompanyProfileCard({ corpCode }: OverviewSectionProps) {
  const titleId = useId()
  const { state, reload } = useCompanyOverview(corpCode)

  return (
    <Panel aria-labelledby={titleId}>
      <PanelTitle id={titleId}>기업 개황</PanelTitle>
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton label="기업 개황을 불러오는 중입니다… 처음 여는 기업은 OpenDART에서 받아 오느라 조금 걸려요." shape="line" count={6} />
        ))
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success', data: { available: false } }, () => (
          <EmptyState title="OpenDART에 이 기업의 개황 자료가 없어요.">
            <p>보고서 비교 탭에서 정기보고서를 확인해 보세요.</p>
          </EmptyState>
        ))
        .with({ status: 'success' }, ({ data }) => <ProfileFacts overview={data} />)
        .exhaustive()}
    </Panel>
  )
}

function ProfileFacts({ overview }: { overview: CompanyOverview }) {
  const fetchedOn = formatDate(overview.fetchedAt.slice(0, 10))
  return (
    <>
      {overview.refreshError !== null && (
        <Notice tone="attention" role="status">
          {refreshErrorMessages[overview.refreshError] ?? 'OpenDART에서 최신 개황을 받지 못했어요'}. {fetchedOn}에 받아 둔
          개황을 보여 줘요.
        </Notice>
      )}
      <dl className="facts company-profile">
        {overviewFacts(overview).map((fact) => (
          <div className="facts__row" key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              <FactValue fact={fact} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="dart-source">출처: OpenDART 기업개황 · {fetchedOn} 받음</p>
    </>
  )
}

function FactValue({ fact }: { fact: OverviewFact }) {
  return match(fact)
    .with({ value: P.nullish }, () => <span className="facts__meta">공시에 없음</span>)
    .with({ value: P.string, href: P.string }, ({ value, href }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {value}
        <span aria-hidden="true"> ↗</span>
        <span className="visually-hidden">(새 창)</span>
      </a>
    ))
    .with({ value: P.string }, ({ value }) => <>{value}</>)
    .exhaustive()
}
