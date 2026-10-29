import { match } from 'ts-pattern'
import type { DocumentSide, SectionItem } from '@/shared/api/documents'
import { displaySectionTitle } from '@/shared/lib/sectionTitle'

/**
 * 원문 확인(3.5)에서 비교 보고서 ↔ 현재 보고서를 전환할 때 보던 항목과 같은 목차를 반대편 보고서에서 찾는다(#523).
 *
 * 매칭 순서(확실한 것부터):
 * 1. 정규화한 전체 계층 경로(번호·제목 포함, NFKC·공백·문장부호 제거)가 같은 첫 항목
 * 2. 앞 번호 표지('I.', 'Ⅲ.', '3.', '가.', '(1)' 등)를 뗀 핵심 제목 계층 경로가 같은 첫 항목(절 추가·삭제로 번호만 밀린 경우)
 * 3. 대목차 핵심 제목과 말단 핵심 제목이 모두 같은 후보가 반대편에 딱 하나뿐일 때 그 항목(중간 깊이가 달라진 경우)
 */
export interface SourceSectionOrigin {
  /** 사용자 안내 문구에 보일 원래 항목 경로 */
  label: string
  /** 번호를 포함한 정규화 계층 경로(대목차 → 현재 항목) */
  fullPath: string[]
  /** 앞 번호 표지를 뗀 핵심 제목 계층 경로(대목차 → 현재 항목) */
  corePath: string[]
}

export type SourceSectionMatchState =
  | { status: 'idle' }
  | { status: 'pending'; targetSide: DocumentSide; origin: SourceSectionOrigin }
  | { status: 'unmatched'; side: DocumentSide; label: string }

export type SourceSectionMatchAction =
  | { type: 'request-match'; targetSide: DocumentSide; origin: SourceSectionOrigin }
  | { type: 'resolve-match'; side: DocumentSide; matched: boolean; label: string }
  | { type: 'clear-match' }

export const initialSourceSectionMatchState: SourceSectionMatchState = { status: 'idle' }

export function sourceSectionMatchReducer(
  state: SourceSectionMatchState,
  action: SourceSectionMatchAction,
): SourceSectionMatchState {
  return match(action)
    .with({ type: 'request-match' }, ({ targetSide, origin }) => ({
      status: 'pending' as const,
      targetSide,
      origin,
    }))
    .with({ type: 'resolve-match' }, ({ side, matched, label }) =>
      matched ? { status: 'idle' as const } : { status: 'unmatched' as const, side, label },
    )
    .with({ type: 'clear-match' }, () => {
      if (state.status === 'idle') return state
      return { status: 'idle' as const }
    })
    .exhaustive()
}

const PUNCT_AND_SPACE = /[\s·.,()[\]<>「」『』\-_:;/]+/gu
/** 로마자('I.', 'III.'), 아라비아 숫자('3.', '3-1.', '(1)'), 한글 기호('가.', '(가)') 같은 목차 앞 표지 */
const LEADING_MARKER =
  /^(?:[IVXLCDM]+\.\s*|\(\d+\)\s*|\d+(?:[.-]\d+)*(?:[.)]\s*|\s+)|\([가-하]\)\s*|[가-하][.)]\s*)/i

function normalizeKey(text: string): string {
  return text.normalize('NFKC').replace(PUNCT_AND_SPACE, '').toLowerCase()
}

function normalizeFullTitle(title: string): string {
  return normalizeKey(displaySectionTitle(title))
}

function normalizeCoreTitle(title: string): string {
  const shown = displaySectionTitle(title).normalize('NFKC').trim()
  const stripped = shown.replace(LEADING_MARKER, '').trim()
  const key = normalizeKey(stripped)
  return key.length > 0 ? key : normalizeKey(shown)
}

function ancestorChain(byNo: Map<number, SectionItem>, item: SectionItem): SectionItem[] {
  const chain: SectionItem[] = []
  const visited = new Set<number>()
  let cursor: SectionItem | undefined = item
  while (cursor !== undefined && !visited.has(cursor.sectionNo)) {
    visited.add(cursor.sectionNo)
    chain.push(cursor)
    cursor = cursor.parentNo === null ? undefined : byNo.get(cursor.parentNo)
  }
  return chain.reverse()
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index])
}

function pickPreferred(candidates: SectionItem[]): number | null {
  if (candidates.length === 0) return null
  const withContent = candidates.find((s) => !s.cover && s.blockCount > 0)
  return (withContent ?? candidates[0]).sectionNo
}

/** 현재 보고 있는 섹션 번호로 반대편 보고서에서 찾을 기준 경로를 만든다 */
export function buildSectionOrigin(sections: SectionItem[], sectionNo: number | null): SourceSectionOrigin | null {
  if (sectionNo === null) return null
  const byNo = new Map(sections.map((s) => [s.sectionNo, s]))
  const current = byNo.get(sectionNo)
  if (current === undefined) return null
  const chain = ancestorChain(byNo, current)
  const fullPath = chain.map((s) => normalizeFullTitle(s.title))
  if (fullPath.some((p) => p.length === 0)) return null
  return {
    label: chain.map((s) => displaySectionTitle(s.title).trim()).join(' > '),
    fullPath,
    corePath: chain.map((s) => normalizeCoreTitle(s.title)),
  }
}

/** 반대편 보고서 목차에서 origin과 대응하는 sectionNo를 찾는다. 없으면 null */
export function matchOutlineSection(sections: SectionItem[], origin: SourceSectionOrigin): number | null {
  if (sections.length === 0) return null
  const byNo = new Map(sections.map((s) => [s.sectionNo, s]))
  const indexed = sections.map((item) => {
    const chain = ancestorChain(byNo, item)
    return {
      item,
      fullPath: chain.map((s) => normalizeFullTitle(s.title)),
      corePath: chain.map((s) => normalizeCoreTitle(s.title)),
    }
  })

  const exactMatches = indexed.filter((entry) => samePath(entry.fullPath, origin.fullPath)).map((entry) => entry.item)
  const exact = pickPreferred(exactMatches)
  if (exact !== null) return exact

  const coreMatches = indexed.filter((entry) => samePath(entry.corePath, origin.corePath)).map((entry) => entry.item)
  const core = pickPreferred(coreMatches)
  if (core !== null) return core

  if (origin.corePath.length >= 2) {
    const rootCore = origin.corePath[0]
    const leafCore = origin.corePath[origin.corePath.length - 1]
    const leafMatches = indexed.filter(
      (entry) =>
        entry.corePath.length >= 2 &&
        entry.corePath[0] === rootCore &&
        entry.corePath[entry.corePath.length - 1] === leafCore,
    )
    if (leafMatches.length === 1) return leafMatches[0].item.sectionNo
  }

  return null
}
