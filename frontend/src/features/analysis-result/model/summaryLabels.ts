import type { SjDiv } from '@/shared/api/results'
import type { AiInfo, ExplanationGrade, ExplanationStatus, SummaryKind, SummaryStatus, SummaryTarget } from '@/shared/api/summary'
import type { TextStatus } from '@/shared/api/textChanges'

/** 요약·설명(W-03 ①) 화면 문구. 요약은 공시에 적힌 내용만 옮기며 투자 판단이 아니다. */

export const SUMMARY_NOTE =
  "수치 문장은 공시 수치로 코드가 계산했어요. 'AI 생성' 문장은 공시 원문에서 찾은 내용만 옮겼고, 투자 판단이 아니에요."

export const NO_EXPLANATION = '확인된 설명 없음'

export function kindLabel(kind: SummaryKind): string {
  return kind === 'FINANCIAL' ? '재무 수치' : '문장 변화'
}

/** 요약 상태 안내. 문제가 없으면 null */
export function summaryStatusNotice(status: SummaryStatus | null, message: string | null): string | null {
  if (status === null) return '이 분석은 요약 기능이 생기기 전에 만들어져 요약이 없어요. 분석을 다시 요청하면 요약을 만들어요.'
  if (status === 'EMPTY') return message ?? '요약할 변화가 없어요.'
  if (status === 'PARTIAL') return message ?? "근거를 확인하지 못한 항목은 요약에서 빼고 '검토 필요'로 남겼어요."
  return null
}

/** 문장을 비교하지 못했으면 요약이 재무 수치만 다룬다는 안내. 비교했으면 null */
export function textCoverageNote(textStatus: TextStatus | null): string | null {
  if (textStatus === null || textStatus === 'FAILED') return '문장을 비교하지 못해 재무 수치 변화만 요약했어요.'
  if (textStatus === 'PARTIAL') return '원문 일부를 읽지 못해 문장 변화 요약이 빠졌을 수 있어요.'
  return null
}

/**
 * 재무 수치 설명이 없을 때의 문구. 설명이 있으면 null.
 * gradeReason이 있으면 코드가 인용을 확인하지 못해 등급을 낮춘 경우라, 후보 문단이 없던 경우와 다르게 쓴다.
 */
export function explanationNote(status: ExplanationStatus | null, gradeReason: string | null = null): string | null {
  if (status === 'NOT_FOUND' && gradeReason) return `${NO_EXPLANATION} · 관련 문단은 있지만 인용을 원문에서 확인하지 못했어요.`
  if (status === 'NOT_FOUND') return `${NO_EXPLANATION} · 공시에서 이 변화의 이유를 적은 문단을 찾지 못했어요.`
  if (status === 'TEMPLATE') return '검토 필요 · AI 설명이 검증을 통과하지 못해 보여 주지 않아요.'
  if (status === 'REVIEW_NEEDED') return '검토 필요 · 설명의 근거를 확인하지 못해 보여 주지 않아요.'
  return null
}

/** 템플릿 요약(#149)의 회사 설명 제목. 인용문은 코드가 원문에서 확인한 것이고 AI 문장이 아니다 */
export const TEMPLATE_CAPTION = '회사 설명 · 공시 원문 인용'

/** 템플릿 요약에 확인된 인용이 없을 때 */
export const TEMPLATE_NO_QUOTE = `회사 설명: ${NO_EXPLANATION}`

/** 재무 수치 설명의 등급 제목. 설명이 없거나 등급 기능 전 분석이면 null */
export function gradeLabel(grade: ExplanationGrade | null): string | null {
  if (grade === 'STATED') return '회사가 공시에서 밝힌 설명'
  if (grade === 'RELATED') return '관련 공시 내용'
  return null
}

/** 관련 내용(RELATED)은 회사가 이 변화를 설명한 문장이 아님을 알린다. 원인으로 읽히는 말을 쓰지 않는다 */
export function gradeNote(grade: ExplanationGrade | null): string | null {
  return grade === 'RELATED' ? '이 변화와 관련된 공시 내용이에요. 회사가 직접 밝힌 설명은 아니에요.' : null
}

/** 인용문 제목. 인용문은 AI가 쓴 문장이 아니라 공시 원문 그대로다 */
export const QUOTE_CAPTION = '공시 원문 인용'

/** 'AI 생성' 문장의 모델·프롬프트 버전·생성 시각 */
export function aiInfoLabel(ai: AiInfo | null): string {
  if (!ai) return ''
  const parts = [ai.model, ai.promptVersion && `프롬프트 ${ai.promptVersion}`, ai.generatedAt && `${ai.generatedAt.replace('T', ' ').slice(0, 16)} 생성`]
  return parts.filter(Boolean).join(' · ')
}

/** 요약 항목에서 열 결과 화면. 열 수 없으면(항목을 찾지 못함) null이라 버튼을 그리지 않는다 */
export type SummaryLink = { tab: 'financial'; sjDiv: SjDiv; changeId: number } | { tab: 'text'; changeId: number }

export function summaryLink(target: SummaryTarget): SummaryLink | null {
  if (target.changeId === null) return null
  if (target.type === 'FINANCIAL') return target.sjDiv ? { tab: 'financial', sjDiv: target.sjDiv, changeId: target.changeId } : null
  return { tab: 'text', changeId: target.changeId }
}
