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
  }
}

/** AI 사용 현황(최근 days일) */
export function getAiUsage(days: AiUsageDays, signal?: AbortSignal): Promise<AiUsage> {
  return apiGet(endpoints.aiUsage(), { days }, { signal })
}
