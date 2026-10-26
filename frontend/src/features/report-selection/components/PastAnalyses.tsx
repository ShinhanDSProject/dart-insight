import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { Panel, PanelTitle } from '@/shared/ui'
import { useCompanyAnalyses } from '@/shared/hooks/useCompanyAnalyses'
import { pastAnalysisLabel } from '@/shared/lib/pastAnalyses'

/**
 * 기업 화면 보고서 고르기 위의 '이미 분석한 비교'(#288). 누르면 결과 화면으로 바로 간다.
 * 목록이 없거나, 불러오는 중이거나, 불러오지 못하면 영역을 보이지 않는다(화면의 다른 기능을 막지 않음).
 */
export function PastAnalyses({ corpCode }: { corpCode: string }) {
  const { state } = useCompanyAnalyses(corpCode)
  return match(state)
    .with({ status: 'success', data: { items: P.when((items) => items.length > 0) } }, ({ data }) => (
      <PastAnalysesList items={data.items} />
    ))
    .with({ status: P.union('loading', 'success', 'error') }, () => null)
    .exhaustive()
}

export function PastAnalysesList({ items }: { items: CompanyAnalysisItem[] }) {
  return (
    <Panel className="past-analyses" aria-labelledby="past-analyses-title">
      <PanelTitle id="past-analyses-title">이미 분석한 비교</PanelTitle>
      <ul className="past-analyses__list">
        {items.map((item) => (
          <li key={item.analysisId}>
            <Link className="list-link" to={`/analyses/${item.analysisId}`}>{pastAnalysisLabel(item)}</Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
