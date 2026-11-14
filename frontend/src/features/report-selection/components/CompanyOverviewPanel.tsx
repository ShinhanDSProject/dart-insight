import { match } from 'ts-pattern'
import { Skeleton } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { useCompany } from '../hooks/useCompany'
import { CompanyOverviewTab } from './CompanyOverviewTab'
import '../report-selection.css'

/**
 * 기업 화면 밖(분석 결과의 '기업 개요' 탭, #589)에서 기업 개요를 그린다. 기업 정보를 받아 CompanyOverviewTab에 넘긴다.
 * 분석 결과에서는 AI 에이전트 패널로만 질문을 받으므로 'AI에게 묻기' 칸은 뺀다(#909)
 */
export function CompanyOverviewPanel({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompany(corpCode)
  return match(state)
    .with({ status: 'loading' }, () => <Skeleton label="기업 정보를 불러오는 중이에요…" shape="block" />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
    .with({ status: 'success' }, ({ data }) => <CompanyOverviewTab corpCode={corpCode} company={data} showAsk={false} />)
    .exhaustive()
}
