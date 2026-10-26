import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { FeedbackReason, QuestionStatus } from './questions'
import type { TextExplanationStatus } from './textChanges'

/** docs/api-spec.md GET /api/system/ai-usage (0.7, FS-15). 집계만 있고 질문 본문·사용자 정보는 없다 */
export type AiUsageDays = 7 | 30

/** llm_call.outcome. 그 밖의 값이 기록돼 있으면 그 값도 키로 온다 */
export type LlmCallOutcome = 'OK' | 'INVALID_OUTPUT' | 'TRANSIENT_ERROR' | 'ERROR'

export interface AiUsageTask {
  /** 작업(summary, answer 등) */
  task: string
  calls: number
  /** 제공자가 알려 준 호출의 토큰 합. 그 작업의 호출이 모두 토큰을 모르면 null */
  inputTokens: number | null
  outputTokens: number | null
}

/** 제공자·모델별 집계(FS-50) */
export interface AiUsageModel {
  /** llm_call.provider(fake, openai 등) */
  provider: string
  model: string
  calls: number
  inputTokens: number | null
  outputTokens: number | null
  /** 추정 비용(USD). 가격 설정이 없거나(fake 포함) 토큰을 모두 모르면 null */
  estimatedCostUsd: number | null
  byTask: AiUsageTask[]
}

/** 작업 단위(분석·브리핑) 1건당 평균. count가 0이거나 값을 모르면 평균은 null */
export interface AiUsageUnitAverage {
  count: number
  avgInputTokens: number | null
  avgOutputTokens: number | null
  /** 가격 설정이 없는 모델의 호출이 섞이면 null */
  avgCostUsd: number | null
}

export interface AiUsage {
  days: AiUsageDays
  /** YYYY-MM-DD(한국 시간) */
  from: string
  to: string
  questions: {
    total: number
    byStatus: Record<QuestionStatus, number>
  }
  feedback: {
    rated: number
    helpful: number
    notHelpful: number
    /** helpful ÷ rated(소수). 평가가 없으면 null */
    helpfulRate: number | null
    reasons: Record<FeedbackReason, number>
  }
  explanations: {
    total: number
    byStatus: Record<TextExplanationStatus, number>
  }
  llmCalls: {
    total: number
    byOutcome: Record<LlmCallOutcome, number> & Record<string, number>
    byTask: AiUsageTask[]
    byModel: AiUsageModel[]
    perUnit: {
      analysis: AiUsageUnitAverage
      briefing: AiUsageUnitAverage
    }
  }
}

/** AI 사용 현황(최근 days일) */
export function getAiUsage(days: AiUsageDays, signal?: AbortSignal): Promise<AiUsage> {
  return apiGet(endpoints.aiUsage(), { days }, { signal })
}
