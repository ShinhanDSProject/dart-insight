import type { ReportItem } from '@/shared/api/reports'
import { DartLinkInline } from './DartLink'

interface DartSourceLineProps {
  /** 이 화면의 수치·문장을 가져온 보고서 */
  reports?: { role: string; report: Pick<ReportItem, 'rceptNo' | 'reportName' | 'dartUrl'> }[]
  /** 보고서 하나로 가리킬 수 없는 자료(공시 목록 등)의 출처·기준 기간. 예: 'OpenDART 공시검색 · 2025.10.27 ~ 2026.10.26 접수' */
  detail?: string
}

/** '출처: DART'와 보고서별 원문 링크(5.6). 공시에서 가져온 수치·문장 옆에 둔다. */
export function DartSourceLine({ reports = [], detail }: DartSourceLineProps) {
  return (
    <p className="dart-source">
      출처: DART
      {detail && ` · ${detail}`}
      {reports.map(({ role, report }) => (
        <span key={report.rceptNo}>
          {' · '}
          {role} {report.reportName} <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={`${role} ${report.reportName}`} />
        </span>
      ))}
    </p>
  )
}
