import type { DailyAnalyses } from '@/shared/api/admin'
import { formatInteger } from '@/shared/lib/numberFormat'
import { barPercent, shortDate } from '../model/adminConsole'

/**
 * 날짜별 분석 요청 막대(FS-72 R1). 막대 높이는 그날 요청 수이고 완료·실패·나머지(진행 중)를 쌓는다.
 * 색만으로 구분하지 않도록 범례에 이름을 두고, 같은 값을 표로도 둔다(화면 읽기 프로그램과 정확한 값 확인용).
 */
export function DailyAnalysesChart({ days }: { days: DailyAnalyses[] }) {
  const max = Math.max(0, ...days.map((d) => d.requested))
  return (
    <div className="daily">
      <ul className="daily__legend" aria-hidden="true">
        <li>
          <span className="daily__swatch daily__swatch--completed" /> 완료
        </li>
        <li>
          <span className="daily__swatch daily__swatch--failed" /> 실패
        </li>
        <li>
          <span className="daily__swatch daily__swatch--other" /> 진행 중·대기
        </li>
      </ul>
      <div className="daily__plot" aria-hidden="true">
        {days.map((d) => {
          const other = Math.max(0, d.requested - d.completed - d.failed)
          return (
            <div key={d.date} className="daily__col" title={`${shortDate(d.date)} 요청 ${d.requested} · 완료 ${d.completed} · 실패 ${d.failed}`}>
              <span className="daily__count">{formatInteger(d.requested)}</span>
              <span className="daily__stack" style={{ height: `${barPercent(d.requested, max)}%` }}>
                {other > 0 && <span className="daily__seg daily__seg--other" style={{ flexGrow: other }} />}
                {d.failed > 0 && <span className="daily__seg daily__seg--failed" style={{ flexGrow: d.failed }} />}
                {d.completed > 0 && <span className="daily__seg daily__seg--completed" style={{ flexGrow: d.completed }} />}
              </span>
              <span className="daily__date">{shortDate(d.date)}</span>
            </div>
          )
        })}
      </div>
      <details className="daily__table">
        <summary>표로 보기</summary>
        <table>
          <caption className="visually-hidden">날짜별 분석 요청·완료·실패 수</caption>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">요청</th>
              <th scope="col">완료</th>
              <th scope="col">실패</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{shortDate(d.date)}</th>
                <td>{formatInteger(d.requested)}</td>
                <td>{formatInteger(d.completed)}</td>
                <td>{formatInteger(d.failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
