import type { Analysis } from '@/shared/api/analyses'
import type { TextEventItem } from '@/shared/api/textEvents'
import { DataTable } from '@/shared/ui'
import { FACTS_NOTE, FACTS_TITLE, factsView } from '../model/eventFacts'

/** 사건 카드의 사실 칸(3.43, AC28). 기준표가 계정을 정한 종류에만 있고, 값은 재무 수치 탭과 같다. 원인이라는 뜻이 아니라고 함께 적는다 */
export function FactsPart({ analysis, item }: { analysis: Analysis; item: TextEventItem }) {
  const view = factsView(item.facts)
  if (view === null) return null
  const titleId = `text-event-facts-${item.eventId}`
  return (
    <section className="text-event__part" aria-labelledby={titleId}>
      <h5 id={titleId} className="text-event__part-title">
        {FACTS_TITLE}
      </h5>
      <p className="panel__note">{FACTS_NOTE}</p>
      <DataTable caption={`관련 계정의 이전 값, 이번 값, 증감액, 증감률. 단위 ${view.unit}`} density="dense">
        <thead>
          <tr>
            <th scope="col">계정</th>
            <th scope="col" className="num">
              이전 · {analysis.previous.reportName}
            </th>
            <th scope="col" className="num">
              이번 · {analysis.current.reportName}
            </th>
            <th scope="col" className="num">
              증감
            </th>
            <th scope="col" className="num">
              증감률
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.changeId}>
              <th scope="row">{row.account}</th>
              <td className="num">{row.previous}</td>
              <td className="num">{row.current}</td>
              <td className="num">{row.change}</td>
              <td className="num">{row.rate}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <p className="panel__note">단위: {view.unit}</p>
    </section>
  )
}
