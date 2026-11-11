import type { Summary, SummaryKind, SummaryTarget } from '@/shared/api/summary'
import type { GlossaryTerm } from '@/shared/api/glossaryTerms'
import { findCardByName } from '@/shared/glossary/model/glossaryCards'

/** 요약 탭 맨 위 '핵심 3줄'(FS-21). 요약 응답에서 고르기만 하고 새 문장을 만들지 않는다. */

export const HEADLINE_FINANCIAL_LIMIT = 2
export const HEADLINE_TEXT_LIMIT = 1

export interface HeadlineLine {
  itemNo: number
  kind: SummaryKind
  /** 재무는 코드가 계산한 사실 문장, 문장 변화는 AI 요약 */
  text: string
  /** 'AI 생성' 표시를 붙일지. 재무 사실 문장은 항상 false */
  aiGenerated: boolean
  target: SummaryTarget
}

/**
 * 재무 사실 문장 상위 2개(요약 순서) + 문장 변화 AI 요약 1개. 부족하면 있는 만큼, 없으면 빈 목록(카드를 그리지 않음).
 * 검토 필요 항목은 요약 항목(items)에 들어 있지 않으므로 고르지 않는다.
 */
export function headlineItems(summary: Pick<Summary, 'items'>): HeadlineLine[] {
  const financial = summary.items
    .filter((i) => i.kind === 'FINANCIAL')
    .flatMap((i) => (hasText(i.factSentence) ? [{ itemNo: i.itemNo, kind: i.kind, text: i.factSentence, aiGenerated: false, target: i.target }] : []))
    .slice(0, HEADLINE_FINANCIAL_LIMIT)
  const text = summary.items
    .filter((i) => i.kind === 'TEXT')
    .flatMap((i) => (hasText(i.aiText) ? [{ itemNo: i.itemNo, kind: i.kind, text: i.aiText, aiGenerated: i.aiGenerated, target: i.target }] : []))
    .slice(0, HEADLINE_TEXT_LIMIT)
  return [...financial, ...text]
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim() !== ''
}

/** 핵심 카드 제목. 고른 줄 수를 그대로 쓴다 */
export function headlineTitle(count: number): string {
  return `이번 비교에서 크게 바뀐 것 ${count}가지`
}

/**
 * 계정 이름과 이름·별칭이 같은 용어 카드(공백·대소문자 무시). 카드를 못 받았거나 없으면 null이고,
 * 화면은 풀이를 지어내지 않는다.
 */
export function glossaryForAccount(cards: GlossaryTerm[] | null, accountName: string): GlossaryTerm | null {
  return cards === null ? null : findCardByName(cards, accountName)
}
