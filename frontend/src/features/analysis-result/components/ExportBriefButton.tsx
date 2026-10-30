import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { getFinancialChanges } from '@/shared/api/results'
import { getSummary } from '@/shared/api/summary'
import { getTextChanges } from '@/shared/api/textChanges'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { downloadTextFile } from '@/shared/lib/download'
import { MenuItem } from '@/shared/ui'
import {
  briefFileName,
  buildAnalysisBriefMarkdown,
  type FinancialBriefGroup,
} from '../model/analysisBriefMarkdown'
import './export-brief-button.css'

export interface ExportBriefButtonProps {
  analysis: Analysis
}

export function ExportBriefButton({ analysis }: ExportBriefButtonProps) {
  const { state, run } = useAsyncAction<void>()

  const handleExport = () => {
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

      const financialGroups: FinancialBriefGroup[] = [
        {
          sjDiv: 'IS',
          label: '손익계산서',
          comparable: isChanges.statements.find((s) => s.sjDiv === 'IS')?.comparable ?? false,
          note: isChanges.statements.find((s) => s.sjDiv === 'IS')?.note ?? null,
          items: isChanges.items,
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

  const isLoading = state.status === 'loading'
  const isError = state.status === 'error'

  return (
    <div className="export-brief">
      {/* 머리의 '내보내기' 펼침 상자(MenuButton) 안 항목. 오류 문구가 보이도록 누른 뒤에도 상자를 닫지 않는다 */}
      <MenuItem
        onClick={handleExport}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? '내보내는 중…' : '브리프 내려받기'}
      </MenuItem>
      {match(isError)
        .with(true, () => (
          <p role="alert" className="export-brief__error">
            브리프를 내려받지 못했어요. 다시 시도해 주세요.
          </p>
        ))
        .with(false, () => null)
        .exhaustive()}
    </div>
  )
}
