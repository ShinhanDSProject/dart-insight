import { ReportCompareView } from './ReportCompareView'
import '../report-selection.css'

/** 기업 화면 밖(분석 결과의 '보고서 선택' 탭, #659)에서 보고서 비교를 그린다. 고른 값은 기업 화면과 같은 주소 값을 쓴다 */
export function ReportSelectionPanel({ corpCode }: { corpCode: string }) {
  return <ReportCompareView corpCode={corpCode} />
}
