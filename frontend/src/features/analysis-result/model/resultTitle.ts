import { match, P } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { pageTitle } from '@/shared/lib/pageTitle'
import type { ResultTab } from './resultParams'

/** 결과 화면 탭 이름. 탭 목록과 브라우저 탭 제목이 같이 쓴다 */
export const resultTabLabels: Record<ResultTab, string> = {
  summary: '요약·설명',
  financial: '재무 수치 변화',
  text: '문장·내용 변화',
  ask: 'AI 질문',
  source: '원문 확인',
}

type TitleAnalysis = Pick<Analysis, 'corpName' | 'status'> & {
  previous: Pick<Analysis['previous'], 'reportName'>
  current: Pick<Analysis['current'], 'reportName'>
}

/**
 * 결과 화면의 브라우저 탭 제목. 예: '삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06) · AI 질문 · DART Insight'
 * 분석을 불러오기 전에는 화면 이름만 쓰고, 탭은 결과가 완료되어 탭이 보일 때만 붙인다.
 */
export function resultTitle(analysis: TitleAnalysis | null, tab: ResultTab): string {
  return match(analysis)
    .with(P.nullish, () => pageTitle(['분석 결과']))
    .otherwise((a) => {
      const comparison = `${a.corpName} ${a.previous.reportName} → ${a.current.reportName}`
      const tabLabel = a.status === 'COMPLETED' ? resultTabLabels[tab] : null
      return pageTitle([comparison, tabLabel])
    })
}
