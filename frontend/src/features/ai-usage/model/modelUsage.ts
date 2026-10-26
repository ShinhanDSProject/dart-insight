import type { AiUsage, AiUsageModel, AiUsageUnitAverage } from '@/shared/api/system'
import { formatCount, formatTokens } from './aiUsage'

/**
 * 제공자·모델별 집계와 1건당 평균(FS-50). 비용·평균은 API가 계산한 값을 그대로 쓰고 여기서 다시 계산하지 않는다.
 */

/** 개발·테스트용 가짜 제공자(llm_call.provider) */
export const FAKE_PROVIDER = 'fake'

/** 주소의 ?real= 값. '1'이면 실제 제공자만 본다(기본은 모두) */
export function parseRealOnly(value: string | null): boolean {
  return value === '1'
}

/** 표에 보일 모델 행. 실제 제공자만 보기면 가짜 제공자(fake)를 뺀다 */
export function modelRows(usage: AiUsage, realOnly: boolean): AiUsageModel[] {
  return realOnly ? usage.llmCalls.byModel.filter((m) => m.provider !== FAKE_PROVIDER) : usage.llmCalls.byModel
}

const PROVIDER_LABELS: Record<string, string> = {
  fake: '가짜(개발용)',
  openai: 'OpenAI',
}

/** 제공자 이름. 모르는 제공자는 기록된 이름 그대로 */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider
}

const usdFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** 추정 비용(USD) → $0.032. 가격 설정이 없어 비용이 없으면(null) 0달러가 아니라 '가격 설정 없음' */
export function formatUsd(value: number | null): string {
  return value === null ? '가격 설정 없음' : `$${usdFormat.format(value)}`
}

export interface UnitStat {
  key: 'analysis' | 'briefing'
  label: string
  /** 1건당 평균 입력·출력 토큰 */
  tokens: string
  cost: string
  detail: string
}

const UNIT_LABELS = { analysis: '분석 1건당 평균', briefing: '브리핑 1건당 평균' } as const

function unitStat(key: UnitStat['key'], unit: AiUsageUnitAverage): UnitStat {
  return {
    key,
    label: UNIT_LABELS[key],
    tokens: `입력 ${formatTokens(unit.avgInputTokens)} · 출력 ${formatTokens(unit.avgOutputTokens)} 토큰`,
    cost: unit.count === 0 ? '기록 없음' : formatUsd(unit.avgCostUsd),
    detail: `호출이 있는 ${key === 'analysis' ? '분석' : '브리핑'} ${formatCount(unit.count)}건 기준`,
  }
}

/** 분석·브리핑 1건당 평균 칸 */
export function unitStats(usage: AiUsage): UnitStat[] {
  const { analysis, briefing } = usage.llmCalls.perUnit
  return [unitStat('analysis', analysis), unitStat('briefing', briefing)]
}
