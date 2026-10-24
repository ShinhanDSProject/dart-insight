import { match } from 'ts-pattern'
import type { DocumentSide } from '@/shared/api/documents'
import type { TextChangeDetail, TextExplanation, TextExplanationEvidence } from '@/shared/api/textChanges'
import type { SourceTarget } from './resultParams'

/**
 * 문장 카드의 AI 한 줄 풀이(3.11, FS-6). 카드마다 따로 불러오고, 목록이 떠 있는 동안 받은 풀이를 남겨
 * 다시 펼쳐도 다시 부르지 않는다. 풀이와 함께 그 변경의 근거 상세(섹션 번호)를 받아 원문 확인으로 연다.
 */
export interface ExplanationResult {
  explanation: TextExplanation
  /** 근거를 원문 확인에서 열 섹션 번호를 얻는 곳. 받지 못했으면 null(근거는 글자로만 보임) */
  detail: TextChangeDetail | null
}

export type ExplanationEntry =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ExplanationResult }
  | { status: 'error'; error: unknown }

/** changeId → 풀이 상태. 없는 changeId는 idle */
export type ExplanationsState = Readonly<Record<number, ExplanationEntry>>

export type ExplanationAction =
  | { type: 'start'; changeId: number }
  | { type: 'resolve'; changeId: number; data: ExplanationResult }
  | { type: 'reject'; changeId: number; error: unknown }
  | { type: 'reset' }

export const initialExplanations: ExplanationsState = {}

const IDLE_ENTRY: ExplanationEntry = { status: 'idle' }

export function explanationOf(state: ExplanationsState, changeId: number): ExplanationEntry {
  return state[changeId] ?? IDLE_ENTRY
}

/** 처음이거나 실패했을 때만 새로 부른다(불러오는 중·받은 풀이는 그대로) */
export function shouldRequest(entry: ExplanationEntry): boolean {
  return match(entry)
    .with({ status: 'idle' }, { status: 'error' }, () => true)
    .with({ status: 'loading' }, { status: 'success' }, () => false)
    .exhaustive()
}

/** 응답은 그 카드가 불러오는 중일 때만 받는다(초기화한 뒤 늦게 온 응답은 버림) */
export function explanationReducer(state: ExplanationsState, action: ExplanationAction): ExplanationsState {
  return match<ExplanationAction, ExplanationsState>(action)
    .with({ type: 'start' }, ({ changeId }) =>
      shouldRequest(explanationOf(state, changeId)) ? { ...state, [changeId]: { status: 'loading' } } : state,
    )
    .with({ type: 'resolve' }, ({ changeId, data }) =>
      explanationOf(state, changeId).status === 'loading' ? { ...state, [changeId]: { status: 'success', data } } : state,
    )
    .with({ type: 'reject' }, ({ changeId, error }) =>
      explanationOf(state, changeId).status === 'loading' ? { ...state, [changeId]: { status: 'error', error } } : state,
    )
    .with({ type: 'reset' }, () => initialExplanations)
    .exhaustive()
}

/** 근거 표시 이름 */
export function explanationSideLabel(side: DocumentSide): string {
  return match(side)
    .with('previous', () => '이전 원문')
    .with('current', () => '현재 원문')
    .exhaustive()
}

/** 근거를 이전 → 현재 순서로. 같은 근거 ID는 한 번만 */
export function orderedEvidence(evidence: TextExplanationEvidence[]): TextExplanationEvidence[] {
  const seen = new Set<string>()
  const unique = evidence.filter((e) => (seen.has(e.evidenceId) ? false : (seen.add(e.evidenceId), true)))
  const rank = (side: DocumentSide) => (side === 'previous' ? 0 : 1)
  return [...unique].sort((a, b) => rank(a.side) - rank(b.side))
}

/**
 * 근거를 원문 확인의 어느 위치로 열지. 풀이 응답에는 섹션 번호가 없어 그 변경의 근거 상세에서 같은 쪽 원문을 찾는다.
 * 근거 상세가 없거나, 그쪽 원문이 없거나, 접수번호가 다르면 null(열지 않음).
 * 저장된 원문이 분석 때와 달라졌으면 위치(블록)는 강조하지 않고 섹션만 연다(근거 상세의 '원문 위치 보기'와 같음).
 */
export function explanationTarget(evidence: TextExplanationEvidence, detail: TextChangeDetail | null): SourceTarget | null {
  const source = detail?.[evidence.side] ?? null
  if (source === null || source.rceptNo !== evidence.rceptNo) return null
  return { side: evidence.side, section: source.sectionNo, block: source.blockMatches ? evidence.blockNo : null }
}

/** 풀이를 받지 못했을 때 ApiError.code별 안내(API-3) */
export const explanationErrorMessages: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어 풀이하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  ANALYSIS_NOT_READY: '분석이 아직 끝나지 않아 풀이할 수 없어요.',
  ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요.',
  ANALYSIS_TEXT_CHANGE_NOT_FOUND: '이 분석의 변경 항목이 아니에요. 목록을 다시 불러와 주세요.',
}

export const EXPLANATION_REVIEW_DEFAULT = '풀이가 근거 확인을 통과하지 못해 보여 주지 않아요. 아래 근거 상세에서 원문을 직접 확인해 주세요.'
export const EXPLANATION_NO_SOURCE_DEFAULT = '이 변경은 비교할 원문을 짝짓지 못해 풀이하지 않았어요.'
export const EXPLANATION_NOTE = '이 변경의 이전·현재 원문만 읽고 AI가 쓴 풀이예요. 투자 판단이 아니에요.'
