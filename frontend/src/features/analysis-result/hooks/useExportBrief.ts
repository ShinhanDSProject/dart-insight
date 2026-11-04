import type { Analysis } from '@/shared/api/analyses'
import { getFinancialChanges, type FinancialChangeList } from '@/shared/api/results'
import { getSummary } from '@/shared/api/summary'
import { getTextChanges } from '@/shared/api/textChanges'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { downloadTextFile } from '@/shared/lib/download'
import {
  briefFileName,
  buildAnalysisBriefMarkdown,
  type FinancialBriefGroup,
} from '../model/analysisBriefMarkdown'

/**
 * 손익 계정을 손익계산서(IS)에 두지 않고 포괄손익계산서(CIS)에만 둔 회사는 IS가 비어 있다.
 * 그때는 CIS를 받아 손익 묶음으로 쓴다(핵심 숫자의 inIncome과 같은 순서).
 */
export async function incomeChanges(analysisId: number, isChanges: FinancialChangeList) {
  const total = (sjDiv: 'IS' | 'CIS') => isChanges.statements.find((s) => s.sjDiv === sjDiv)?.total ?? 0
  if (total('IS') > 0 || total('CIS') === 0) return { sjDiv: 'IS' as const, label: '손익계산서', changes: isChanges }
  const cisChanges = await getFinancialChanges(analysisId, 'CIS', true, undefined, 'scale')
  return { sjDiv: 'CIS' as const, label: '포괄손익계산서', changes: cisChanges }
}

/** 비교 브리프 Markdown 내려받기(#515, LLM 없음). 머리의 '내보내기' 메뉴와 채팅의 '비교 브리프 내려받기' 액션이 같이 쓴다 */
export function useExportBrief(analysis: Analysis) {
  const { state, run } = useAsyncAction<void>()

  const exportBrief = () => {
    run(async () => {
      const [summaryResult, isChanges, bsChanges, cfChanges, riskChanges] = await Promise.all([
        getSummary(analysis.analysisId).catch((error: unknown) => {
          throw error
        }),
        getFinancialChanges(analysis.analysisId, 'IS', true, undefined, 'scale'),
        getFinancialChanges(analysis.analysisId, 'BS', true, undefined, 'scale'),
        getFinancialChanges(analysis.analysisId, 'CF', true, undefined, 'scale'),
        analysis.textStatus === 'COMPLETED'
          ? getTextChanges(analysis.analysisId, {
              types: [],
              sort: 'priority',
              section: null,
              q: null,
              risk: true,
              page: 0,
              size: 5,
            })
          : Promise.resolve(null),
      ])

      const income = await incomeChanges(analysis.analysisId, isChanges)
      const financialGroups: FinancialBriefGroup[] = [
        {
          sjDiv: income.sjDiv,
          label: income.label,
          comparable: income.changes.statements.find((s) => s.sjDiv === income.sjDiv)?.comparable ?? false,
          note: income.changes.statements.find((s) => s.sjDiv === income.sjDiv)?.note ?? null,
          items: income.changes.items,
        },
        {
          sjDiv: 'BS',
          label: '재무상태표',
          comparable: bsChanges.statements.find((s) => s.sjDiv === 'BS')?.comparable ?? false,
          note: bsChanges.statements.find((s) => s.sjDiv === 'BS')?.note ?? null,
          items: bsChanges.items,
        },
        {
          sjDiv: 'CF',
          label: '현금흐름표',
          comparable: cfChanges.statements.find((s) => s.sjDiv === 'CF')?.comparable ?? false,
          note: cfChanges.statements.find((s) => s.sjDiv === 'CF')?.note ?? null,
          items: cfChanges.items,
        },
      ]

      const markdown = buildAnalysisBriefMarkdown({
        analysis,
        summary: summaryResult,
        financialGroups,
        riskTextChanges: riskChanges?.items ?? [],
      })

      downloadTextFile(briefFileName(analysis), markdown, 'text/markdown;charset=utf-8')
    })
  }

  return { state, exportBrief }
}
