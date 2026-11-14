import type { ComparabilityResult } from '@/shared/api/comparability'
import { Badge, Panel, PanelTitle } from '@/shared/ui'
import { checkBadgeLabel, checkStatusTone } from '../model/comparabilityLabels'
import '../comparability.css'

/**
 * '비교 조건' 표: 항목 · 내용 · 결과 배지. 사유가 정해지는 조건 행에는 '동일 보고서' 같은 짧은 사유를 단다(FS-68 AC4).
 * 비교 확인 화면과 분석 실패 화면(FS-69)이 같이 쓴다. 실패 화면에서는 조건이 모두 '확인'이면
 * 고른 보고서가 아니라 처리 쪽 문제라는 것을 보여, 보고서를 다시 고르지 않고 다시 실행하게 한다.
 */
export function CheckTable({ result, titleId }: { result: Pick<ComparabilityResult, 'checks' | 'reasons'>; titleId: string }) {
  return (
    <Panel aria-labelledby={titleId}>
      <PanelTitle id={titleId}>비교 조건</PanelTitle>
      <table className="check-table">
        <caption className="visually-hidden">비교 조건 확인 결과. 항목, 내용, 결과 순이에요.</caption>
        <tbody>
          {result.checks.map((check) => (
            <tr key={check.item}>
              <th scope="row">{check.label}</th>
              <td>{check.detail}</td>
              <td className="check-table__status">
                <Badge tone={checkStatusTone(check.status)}>{checkBadgeLabel(check, result.reasons)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
