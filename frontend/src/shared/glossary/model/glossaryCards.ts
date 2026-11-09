import type { GlossaryTerm } from '@/shared/api/glossaryTerms'
import { glossary, type GlossaryKey } from '@/shared/lib/glossary'

/** 화면에 보일 용어 풀이 한 줄. card는 카드 API의 카드, fallback은 #772 전까지 대신 쓰는 glossary.ts 정의 */
export type TermEntry =
  | { source: 'card'; term: string; definition: string; card: GlossaryTerm }
  | { source: 'fallback'; term: string; definition: string }

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
 * 결과 화면 용어 풀이(FS-36)의 한 줄. 카드가 있으면 카드의 한 줄 뜻(채팅 카드와 같음, AC10), 없으면
 * #772에서 카드를 반영하기 전까지만 glossary.ts 정의로 대신한다(사용자 결정 2026-11-09, ADR-0061).
 */
export function termEntryByKey(cards: GlossaryTerm[] | null, key: GlossaryKey): TermEntry {
  const card = cards === null ? null : findCardByKey(cards, key)
  if (card !== null) return { source: 'card', term: card.term, definition: card.definition, card }
  return { source: 'fallback', ...glossary[key] }
}

/**
 * 채팅의 용어 사전 열기 버튼(OPEN_GLOSSARY)이 가리키는 용어. 카드가 없으면 #772 전까지 glossary.ts에서
 * 이름이 같은 용어로 대신하고, 그것도 없으면 null('등록된 용어가 없어요')이다.
 */
export function termEntryByName(cards: GlossaryTerm[] | null, name: string): TermEntry | null {
  const card = cards === null ? null : findCardByName(cards, name)
  if (card !== null) return { source: 'card', term: card.term, definition: card.definition, card }
  const key = normalizeTermName(name)
  const entry = Object.values(glossary).find((e) => normalizeTermName(e.term) === key)
  return entry === undefined ? null : { source: 'fallback', ...entry }
}

/** 관련 용어 키 → 용어 이름(목록에 있는 카드만, 순서 그대로) */
export function relatedTerms(cards: GlossaryTerm[], card: GlossaryTerm): string[] {
  return card.related.map((key) => findCardByKey(cards, key)?.term).filter((t): t is string => t !== undefined)
}

/** 이어서 묻기 버튼이 보낼 요청 */
export const easierQuestion = (term: string) => `${term} 더 쉽게 설명해줘`
export const termQuestion = (term: string) => `${term} 뜻 알려줘`
