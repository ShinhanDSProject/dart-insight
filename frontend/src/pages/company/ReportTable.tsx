import type { ReportItem } from '@/shared/api/reports'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { correctionLabel, dataStatusHelp, dataStatusLabel, formatDate, periodLabel } from './reportLabels'

interface ReportTableProps {
  items: ReportItem[]
  current: ReportItem | null
  previous: ReportItem | null
  onSelectCurrent: (report: ReportItem) => void
}

/** W-01 ② 정기보고서 표. 보고서 이름을 누르면 현재 보고서로 고른다. */
export function ReportTable({ items, current, previous, onSelectCurrent }: ReportTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">정기보고서 목록. 보고서 이름을 누르면 현재 보고서로 고릅니다.</caption>
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
              <tr key={report.rceptNo} className={isCurrent ? 'data-table__row--selected' : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="link-button"
                    aria-pressed={isCurrent}
                    onClick={() => onSelectCurrent(report)}
                  >
                    {report.reportName}
                  </button>
                  {isCurrent && <span className="badge badge--strong">현재</span>}
                  {isPrevious && <span className="badge">비교</span>}
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
