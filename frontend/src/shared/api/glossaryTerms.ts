import { apiGet } from './client'
import { endpoints } from './endpoints'

/** 카드를 확인한 공식 자료 */
export interface GlossarySource {
  title: string
  url: string
}

/**
 * 공시 용어 카드 하나(docs/api-spec.md GET /api/glossary-terms, ADR-0061). 출처·검토를 마친 카드만 온다.
 * 예시는 카드 내용이며 어느 회사의 실제 값이 아니다.
 */
export interface GlossaryTerm {
  key: string
  /** BASIC 기초 카드, CORE 핵심 카드 */
  level: 'BASIC' | 'CORE'
  term: string
  aliases: string[]
  definition: string
  example: string | null
  whereToCheck: string | null
  noJudgment: string | null
  /** 이 목록에 나오는 카드의 키만 */
  related: string[]
  sources: GlossarySource[]
  /** YYYY-MM-DD */
  reviewedAt: string
}

export interface GlossaryTermListResponse {
  items: GlossaryTerm[]
}

export function getGlossaryTerms(signal?: AbortSignal): Promise<GlossaryTermListResponse> {
  return apiGet(endpoints.glossaryTerms(), undefined, { signal })
}
