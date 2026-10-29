import { match } from 'ts-pattern'
import type { AiUsage } from '@/shared/api/system'
import { Card, DataTable, Panel, PanelTitle } from '@/shared/ui'
import { formatCount, formatTokens } from '../model/aiUsage'
import { formatUsd, modelRows, providerLabel, unitStats } from '../model/modelUsage'

/**
 * 제공자·모델별 호출·토큰·추정 비용과 분석·브리핑·전망·계획·약속 대조 1건당 평균(FS-50).
 * 비용은 backend가 설정한 공식 가격으로 계산한 값이고, 가격 설정이 없으면 '가격 설정 없음'이다.
 */
export function ModelUsagePanel({
  usage,
  realOnly,
  onRealOnlyChange,
}: {
  usage: AiUsage
  realOnly: boolean
  onRealOnlyChange: (realOnly: boolean) => void
}) {
  const rows = modelRows(usage, realOnly)

  return (
    <Panel aria-labelledby="ai-usage-models" className="ai-usage__models">
      <div className="ai-usage__models-head">
        <PanelTitle id="ai-usage-models">제공자·모델별</PanelTitle>
        <label className="ai-usage__toggle">
          <input type="checkbox" checked={realOnly} onChange={(event) => onRealOnlyChange(event.target.checked)} />
          <span>실제 제공자만 보기</span>
        </label>
      </div>

      <ul className="ai-usage__units" aria-label="1건당 평균">
        {unitStats(usage).map((stat) => (
          <li key={stat.key}>
            <Card className="ai-usage__stat">
              <span className="ai-usage__stat-label">{stat.label}</span>
              <span className="ai-usage__stat-value">{stat.cost}</span>
              <span className="ai-usage__stat-detail">{stat.tokens}</span>
              <span className="ai-usage__stat-detail">{stat.detail}</span>
            </Card>
          </li>
        ))}
      </ul>

      {match(rows.length)
        .with(0, () => (
          <p className="ai-usage__note">
            {realOnly ? '이 기간에 실제 제공자 호출이 없어요.' : '이 기간에 LLM 호출이 없어요.'}
          </p>
        ))
        .otherwise(() => (
          <DataTable caption="제공자·모델별 LLM 호출 수, 입력·출력 토큰 합, 추정 비용" density="dense">
            <thead>
              <tr>
                <th scope="col">제공자</th>
                <th scope="col">모델</th>
                <th scope="col" className="num">호출 수</th>
                <th scope="col" className="num">입력 토큰</th>
                <th scope="col" className="num">출력 토큰</th>
                <th scope="col" className="num">추정 비용</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.provider}:${row.model}`}>
                  <td>{providerLabel(row.provider)}</td>
                  <th scope="row">{row.model}</th>
                  <td className="num">{formatCount(row.calls)}</td>
                  <td className="num">{formatTokens(row.inputTokens)}</td>
                  <td className="num">{formatTokens(row.outputTokens)}</td>
                  <td className="num">{formatUsd(row.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ))}
      <p className="ai-usage__hint">
        추정 비용은 공식 가격 페이지의 100만 토큰당 단가로 계산해요. 가격을 설정하지 않은 모델(가짜 제공자 포함)은 '가격
        설정 없음'이에요. 1건당 평균은 이 기간에 호출이 있는 분석·브리핑·전망·계획·약속 대조 기준이고(실패한 분석 포함), 가격이 없는 모델 호출이 섞이면 비용을
        보이지 않아요.
      </p>
    </Panel>
  )
}
