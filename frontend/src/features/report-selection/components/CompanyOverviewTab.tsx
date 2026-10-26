import type { ComponentType } from 'react'
import type { OverviewSectionProps } from '../model/overviewSections'
import { CompanyProfileCard } from './CompanyProfileCard'
import { FinancialTrendSection } from './FinancialTrendSection'

/**
 * 기업 개요 탭의 영역을 위에서부터 그리는 순서(FS-45~49).
 * 정해 둔 순서: AI 브리핑(FS-49, #333) → 기업 개황(FS-45) → 재무 흐름(FS-46, #330) → 주주·임원·배당(FS-47, #331)
 * → 최근 공시(FS-48, #332). 아직 없는 영역은 자리도 보이지 않는다.
 *
 * 영역을 더할 때: OverviewSectionProps를 받는 컴포넌트를 만들고 이 배열의 정해 둔 자리에 한 줄을 더한다.
 * 예) { key: 'financial-trends', Component: FinancialTrendsSection },
 * 각 영역은 Panel 하나로 자기 자료·로딩·오류를 맡는다(model/overviewSections.ts).
 */
const sections: ReadonlyArray<{ key: string; Component: ComponentType<OverviewSectionProps> }> = [
  { key: 'profile', Component: CompanyProfileCard },
  { key: 'financial-trends', Component: FinancialTrendSection },
]

export function CompanyOverviewTab(props: OverviewSectionProps) {
  return (
    <div className="company-overview">
      {sections.map(({ key, Component }) => (
        <Component key={key} {...props} />
      ))}
    </div>
  )
}
