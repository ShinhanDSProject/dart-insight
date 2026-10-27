import { useCallback, useMemo } from 'react'
import type { FsDiv } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { parseCorps, parseFsDiv, parseReportType, serializeCorps } from '../model/companyComparison'

/** 주소에 두는 비교 조건(ST-6): ?corps=고유번호,…&type=ANNUAL&fs=CFS. 같은 주소로 같은 비교를 다시 연다 */
export function useComparisonQuery() {
  const { params, update } = useQueryParams()
  const corpsParam = params.get('corps')
  const corps = useMemo(() => parseCorps(corpsParam), [corpsParam])
  const type = parseReportType(params.get('type'))
  const fsDiv = parseFsDiv(params.get('fs'))

  const setCorps = useCallback((next: readonly string[]) => update({ corps: serializeCorps(next) }), [update])
  const setType = useCallback((next: ReportType) => update({ type: next }), [update])
  const setFsDiv = useCallback((next: FsDiv) => update({ fs: next }), [update])
  return { corps, type, fsDiv, setCorps, setType, setFsDiv }
}
