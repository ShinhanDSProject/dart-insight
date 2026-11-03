import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { MenuItem } from '@/shared/ui'
import { useExportBrief } from '../hooks/useExportBrief'
import './export-brief-button.css'

export interface ExportBriefButtonProps {
  analysis: Analysis
}

export function ExportBriefButton({ analysis }: ExportBriefButtonProps) {
  const { state, exportBrief: handleExport } = useExportBrief(analysis)

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
