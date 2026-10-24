import type { FeedbackReason } from '@/shared/api/questions'

/** AI 답이 도움이 안 된 사유(3.12, FS-9). 화면에 보이는 순서. 답 카드와 AI 사용 현황이 같이 쓴다 */
export const FEEDBACK_REASONS: readonly { reason: FeedbackReason; label: string }[] = [
  { reason: 'WRONG_SOURCE', label: '근거가 안 맞아요' },
  { reason: 'NOT_ANSWERED', label: '질문에 답하지 않았어요' },
  { reason: 'HARD_TO_READ', label: '이해하기 어려워요' },
  { reason: 'OTHER', label: '기타' },
]
