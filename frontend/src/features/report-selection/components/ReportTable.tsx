import type { ReportItem } from '@/shared/api/reports'
import { Badge, Button, DataTable, DataTableRow } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { correctionLabel, dataStatusHelp, dataStatusLabel, formatDate, periodLabel } from '@/shared/lib/reportLabels'

interface ReportTableProps {
  items: ReportItem[]
  current: ReportItem | null
  previous: ReportItem | null
  onSelectCurrent: (report: ReportItem) => void
}

/** W-01 ② 정기보고서 표. 보고서 이름을 누르면 현재 보고서로 고른다. */
export function ReportTable({ items, current, previous, onSelectCurrent }: ReportTableProps) {
  return (
    <DataTable caption="정기보고서 목록. 보고서 이름을 누르면 현재 보고서로 고릅니다.">
      <thead>
        <tr>
          <th scope="col">보고서</th>
          <th scope="col">유형</th>
          <th scope="col">대상 기간</th>
          <th scope="col">제출일</th>
          <th scope="col">정정 여부</th>
          <th scope="col">자료 상태</th>
          <th scope="col">원문</th>
        </tr>
      </thead>
      <tbody>
        {items.map((report) => {
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
              <td>
                <code>{report.disclosureType}</code>
              </td>
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
  )
}
