import { match } from 'ts-pattern'
import { formatCount } from './overview'
import { partIndexOf, type SourcePart } from './sourceParts'

/**
 * 원문 확인(3.5)에서 선택한 항목 안의 문단·표 셀을 찾고 강조·이동하는 규칙(#523).
 * 소제목별로 나뉜 긴 항목(splitParts)에서도 전체 블록을 한 번에 찾아 해당 소제목으로 바로 넘어간다.
 */
export const SOURCE_SEARCH_MIN_LENGTH = 2
export const SOURCE_SEARCH_MAX_LENGTH = 100

export type SourceSearchQuery =
  | { status: 'empty' }
  | { status: 'too-short' }
  | { status: 'ready'; query: string }

export interface HighlightSegment {
  text: string
  hit: boolean
}

export interface SourceBlockHit {
  partIndex: number
  blockNo: number
  hitCount: number
}

export interface SourceSearchResult {
  totalOccurrences: number
  blocks: SourceBlockHit[]
}

export interface SourceSearchState {
  partIndex: number
  input: string
  activeHitIndex: number
  navSeq: number
  navTarget: 'none' | 'heading' | 'hit'
}

export type SourceSearchAction =
  | { type: 'sync-anchor'; parts: SourcePart[]; blockNo: number | null }
  | { type: 'select-part'; partIndex: number }
  | { type: 'set-query'; input: string; parts: SourcePart[] }
  | { type: 'step-hit'; delta: 1 | -1; blocks: SourceBlockHit[] }
  | { type: 'clear-query' }

export const EMPTY_SOURCE_SEARCH_RESULT: SourceSearchResult = {
  totalOccurrences: 0,
  blocks: [],
}

const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g

function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL, '\\$&')
}

export function parseSourceSearch(input: string): SourceSearchQuery {
  const query = input.trim().slice(0, SOURCE_SEARCH_MAX_LENGTH)
  if (query.length === 0) return { status: 'empty' }
  if (query.length < SOURCE_SEARCH_MIN_LENGTH) return { status: 'too-short' }
  return { status: 'ready', query }
}

/** 글 안에서 검색어와 일치하는 건수(대소문자 구분 없음, 겹치지 않게) */
export function countTextHits(text: string, query: string): number {
  if (text.length === 0 || query.length === 0) return 0
  const pattern = new RegExp(escapeRegExp(query), 'gi')
  return Array.from(text.matchAll(pattern)).length
}

/** 글에서 검색어와 맞는 조각(hit=true)과 나머지 조각을 순서대로 나눈다 */
export function highlightSegments(text: string, query: string | null | undefined): HighlightSegment[] {
  if (!query || text.length === 0) return [{ text, hit: false }]
  const pattern = new RegExp(escapeRegExp(query), 'gi')
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const found of text.matchAll(pattern)) {
    const start = found.index ?? 0
    const end = start + found[0].length
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    cursor = end
  }
  if (segments.length === 0) return [{ text, hit: false }]
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}

/** 나뉜 모든 조각(소제목)의 문단과 표 셀에서 검색어가 든 블록과 총 건수를 찾는다 */
export function findSourceHits(parts: SourcePart[], query: string): SourceSearchResult {
  if (query.length < SOURCE_SEARCH_MIN_LENGTH) return EMPTY_SOURCE_SEARCH_RESULT
  const blocks: SourceBlockHit[] = []
  let totalOccurrences = 0
  parts.forEach((part, partIndex) => {
    part.blocks.forEach((block) => {
      const hitCount = block.table
        ? block.table.reduce(
            (rowSum, row) => rowSum + row.reduce((cellSum, cell) => cellSum + countTextHits(cell.text, query), 0),
            0,
          )
        : countTextHits(block.text, query)
      if (hitCount > 0) {
        totalOccurrences += hitCount
        blocks.push({ partIndex, blockNo: block.blockNo, hitCount })
      }
    })
  })
  return { totalOccurrences, blocks }
}

/** 검색창 옆 상태 문구. 입력이 비어 있으면 null */
export function sourceSearchStatusLabel(
  queryState: SourceSearchQuery,
  result: SourceSearchResult,
  activeHitIndex: number,
): string | null {
  return match(queryState)
    .with({ status: 'empty' }, () => null)
    .with({ status: 'too-short' }, () => `${SOURCE_SEARCH_MIN_LENGTH}자 이상 입력해 주세요.`)
    .with({ status: 'ready' }, () => {
      if (result.blocks.length === 0) return '일치하는 내용이 없어요.'
      const currentPos = Math.min(activeHitIndex, result.blocks.length - 1) + 1
      return `${formatCount(result.totalOccurrences)}건 일치 (${formatCount(currentPos)} / ${formatCount(result.blocks.length)})`
    })
    .exhaustive()
}

export function initialSourceSearchState(parts: SourcePart[], blockNo: number | null): SourceSearchState {
  return {
    partIndex: partIndexOf(parts, blockNo),
    input: '',
    activeHitIndex: 0,
    navSeq: 0,
    navTarget: 'none',
  }
}

export function sourceSearchReducer(state: SourceSearchState, action: SourceSearchAction): SourceSearchState {
  return match(action)
    .with({ type: 'sync-anchor' }, ({ parts, blockNo }) => ({
      ...state,
      partIndex: partIndexOf(parts, blockNo),
      navTarget: 'none' as const,
    }))
    .with({ type: 'select-part' }, ({ partIndex }) => ({
      ...state,
      partIndex,
      navSeq: state.navSeq + 1,
      navTarget: 'heading' as const,
    }))
    .with({ type: 'set-query' }, ({ input, parts }) => {
      const parsed = parseSourceSearch(input)
      if (parsed.status !== 'ready') {
        return { ...state, input, activeHitIndex: 0, navTarget: 'none' as const }
      }
      const hits = findSourceHits(parts, parsed.query)
      const nextPartIndex = hits.blocks.length > 0 ? hits.blocks[0].partIndex : state.partIndex
      return {
        ...state,
        input,
        partIndex: nextPartIndex,
        activeHitIndex: 0,
        navTarget: 'none' as const,
      }
    })
    .with({ type: 'step-hit' }, ({ delta, blocks }) => {
      if (blocks.length === 0) return state
      const nextIndex = (state.activeHitIndex + delta + blocks.length) % blocks.length
      const target = blocks[nextIndex]
      return {
        ...state,
        partIndex: target.partIndex,
        activeHitIndex: nextIndex,
        navSeq: state.navSeq + 1,
        navTarget: 'hit' as const,
      }
    })
    .with({ type: 'clear-query' }, () => ({
      ...state,
      input: '',
      activeHitIndex: 0,
      navTarget: 'none' as const,
    }))
    .exhaustive()
}
