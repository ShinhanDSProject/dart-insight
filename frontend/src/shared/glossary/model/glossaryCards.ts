import type { GlossaryTerm } from '@/shared/api/glossaryTerms'
import type { GlossaryKey } from '@/shared/lib/glossary'

/** 이름 비교 기준(backend GlossaryTerms.normalizeName과 같음): 공백을 모두 빼고 영문은 소문자 */
export function normalizeTermName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

/** 용어·별칭이 같은 카드. 없으면 null이고 뜻을 지어내지 않는다 */
export function findCardByName(cards: GlossaryTerm[], name: string): GlossaryTerm | null {
  const key = normalizeTermName(name)
  if (key === '') return null
  return cards.find((card) => [card.term, ...card.aliases].some((n) => normalizeTermName(n) === key)) ?? null
}

export function findCardByKey(cards: GlossaryTerm[], key: string): GlossaryTerm | null {
  return cards.find((card) => card.key === key) ?? null
}

/**
 * 결과 화면 용어 풀이(FS-36)의 카드. 뜻은 카드의 한 줄 뜻이다(채팅 카드와 같음, AC10).
 * 카드를 아직 못 받았거나 그 키의 카드가 없으면 null이고, 화면은 뜻을 지어내지 않는다.
 */
export function termCardByKey(cards: GlossaryTerm[] | null, key: GlossaryKey): GlossaryTerm | null {
  return cards === null ? null : findCardByKey(cards, key)
}

/** 관련 용어 키 → 용어 이름(목록에 있는 카드만, 순서 그대로) */
export function relatedTerms(cards: GlossaryTerm[], card: GlossaryTerm): string[] {
  return card.related.map((key) => findCardByKey(cards, key)?.term).filter((t): t is string => t !== undefined)
}

/** 이어서 묻기 버튼이 보낼 요청 */
export const easierQuestion = (term: string) => `${term} 더 쉽게 설명해줘`
export const termQuestion = (term: string) => `${term} 뜻 알려줘`
