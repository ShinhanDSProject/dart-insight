import { useState } from 'react'
import type { ReportItem } from '@/shared/api/reports'
import { Badge, Button, DataTable, DataTableRow } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { correctionLabel, dataStatusHelp, dataStatusLabel, formatDate, periodLabel } from '@/shared/lib/reportLabels'
import { RECENT_YEARS, visibleReports } from '../model/reportVisibility'

interface ReportTableProps {
  items: ReportItem[]
  current: ReportItem | null
  previous: ReportItem | null
  onSelectCurrent: (report: ReportItem) => void
}

/**
 * W-01 ② 정기보고서 표. 보고서 이름을 누르면 현재 보고서로 고른다.
 * 처음에는 최근 3개 사업연도만 보이고(고른 현재·비교 보고서는 늘 보임), 이전 보고서는 펼쳐서 본다.
 */
export function ReportTable({ items, current, previous, onSelectCurrent }: ReportTableProps) {
  const [expanded, setExpanded] = useState(false)
  const { rows, hiddenCount } = visibleReports(items, [current?.rceptNo, previous?.rceptNo], expanded)

  return (
    <>
      <DataTable caption="정기보고서 목록. 보고서 이름을 누르면 현재 보고서로 고릅니다.">
        <thead>
          <tr>
            <th scope="col">보고서</th>
            <th scope="col">대상 기간</th>
            <th scope="col">제출일</th>
            <th scope="col">정정 여부</th>
            <th scope="col">자료 상태</th>
            <th scope="col">원문</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((report) => {
            const isCurrent = current?.rceptNo === report.rceptNo
            const isPrevious = previous?.rceptNo === report.rceptNo
            return (
              <DataTableRow key={report.rceptNo} selected={isCurrent}>
                <th scope="row">
                  <Button variant="link" aria-pressed={isCurrent} onClick={() => onSelectCurrent(report)}>
                    {report.reportName}
                  </Button>
                  {isCurrent && (
                    <Badge tone="accent" className="report-table__badge">
                      현재
                    </Badge>
                  )}
                  {isPrevious && <Badge className="report-table__badge">비교</Badge>}
                </th>
                <td>{periodLabel(report)}</td>
                <td>{formatDate(report.receivedAt)}</td>
                <td>{correctionLabel(report.correction)}</td>
                <td title={dataStatusHelp[report.financialDataStatus]}>{dataStatusLabel(report.financialDataStatus)}</td>
                <td>
                  <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={report.reportName} />
                </td>
              </DataTableRow>
            )
          })}
        </tbody>
      </DataTable>
      {hiddenCount > 0 && (
        <div className="report-table__more">
          <Button aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
            {expanded ? '접기' : `이전 보고서 더 보기 (${hiddenCount}개)`}
          </Button>
          {!expanded && (
            <span className="report-table__more-note">최근 {RECENT_YEARS}개 사업연도 보고서를 먼저 보여 줘요.</span>
          )}
        </div>
      )}
    </>
  )
}
