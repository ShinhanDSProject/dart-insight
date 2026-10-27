import type { BriefingAi, BriefingEvidence } from '@/shared/api/briefing'
import { displaySectionPath } from '@/shared/lib/sectionTitle'

/** 브리핑을 불러오지 못했을 때 에러 코드별 안내(conventions.yaml API-3) */
export const BRIEFING_ERROR_MESSAGES: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어 브리핑을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 원문을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 원문을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 인증키가 없어 원문을 받지 못했어요. 관리자에게 알려 주세요.',
  COMPANY_NOT_FOUND: '기업을 찾지 못했어요.',
}

/** 만든 모델·프롬프트 버전·시각. 'AI 생성' 표시 옆에 보인다 */
export function briefingAiLabel(ai: BriefingAi | null): string {
  if (!ai) return ''
  const parts = [
    ai.model,
    ai.promptVersion && `프롬프트 ${ai.promptVersion}`,
    ai.generatedAt && `${ai.generatedAt.replace('T', ' ').slice(0, 16)} 생성`,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** 근거 위치 한 줄: 섹션 경로(앞 번호 정리)와 블록 번호. 전망·계획(FS-59)의 근거도 쓴다 */
export function evidenceLocation(evidence: Pick<BriefingEvidence, 'sectionPath' | 'blockNo'>): string {
  const path = evidence.sectionPath ? displaySectionPath(evidence.sectionPath) : '위치 확인 안 됨'
  return `${path} · 블록 ${evidence.blockNo}`
}

/** 인용 글을 줄로 나눈다(표는 행마다 한 줄). 빈 줄은 뺀다 */
export function quoteLines(quote: string): string[] {
  return quote
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** 근거 열기 버튼은 한 번에 하나만 펼친다. 같은 문장을 다시 누르면 닫는다 */
export function toggleOpen(open: number | null, no: number): number | null {
  return open === no ? null : no
}
