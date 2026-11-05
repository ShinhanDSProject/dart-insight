import { apiGet, apiPost } from './client'
import { endpoints } from './endpoints'
import type { ChangeType, TextChangeItem, TextField } from './textChanges'

/** docs/api-spec.md GET /api/analyses/{id}/event-runs/current. NOT_CREATED 만들지 않음, NOT_STARTED 실행이 없고 만들지 않을 사유도 없음 */
export type TextEventRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'NOT_CREATED' | 'NOT_STARTED'
export type TextEventNotCreatedReason = 'DISABLED' | 'OLD_ANALYSIS' | 'TEXT_COMPARE_FAILED' | 'FAKE_MODEL' | 'NO_CANDIDATES'

export interface TextEventRun {
  analysisId: number
  status: TextEventRunStatus
  eventVersion: string
  /** NOT_CREATED일 때만 */
  notCreatedReason: TextEventNotCreatedReason | null
  /** FAILED일 때 사유 */
  errorCode: string | null
  canRetry: boolean
  /** 실행이 없거나 끝나지 않았으면 null */
  startedAt: string | null
  finishedAt: string | null
}

/** CHANGE 바뀐 내용, REASON 공시에 적힌 이유 */
export type TextEventQuotePurpose = 'CHANGE' | 'REASON'
export type TextEventQuoteSide = 'PREVIOUS' | 'CURRENT'

export interface TextEventQuote {
  changeId: number
  purpose: TextEventQuotePurpose
  side: TextEventQuoteSide
  /** 원문에서 그대로 옮긴 글 */
  text: string
  /** 근거 ID({접수번호}#B{블록 번호}) */
  evidenceId: string
  sectionPath: string
}

/** docs/api-spec.md GET /api/analyses/{id}/events의 items[]. 규모(scale*)는 사건 순서를 정한 값이다 */
export interface TextEventItem {
  eventId: number
  sortOrder: number
  title: string
  /** AI가 붙인 사건 종류 이름 */
  kind: string
  /** 묶인 변경이 속한 분야 */
  fields: TextField[]
  changeIds: number[]
  quotes: TextEventQuote[]
  scaleAmount: number | null
  scaleAmountText: string | null
  currency: string | null
  scaleAmountKrw: number | null
  scaleRatio: number | null
  scaleNotComputedReason: string | null
  scaleEvidenceId: string | null
  amountSource: string
  fxSource: string | null
  fxRateDate: string | null
  sortBasis: string
  /** 코드가 항상 true로 넣는다. 'AI 생성' 표시는 이 값으로 한다 */
  aiGenerated: boolean
  model: string
  promptVersion: string
  generatedAt: string
}

/** 어느 사건에도 들어가지 않은 후보 변경 */
export interface TextEventUnboundChange {
  changeId: number
  changeType: ChangeType
  field: TextField | null
  sectionPath: string
  previousPreview: string | null
  currentPreview: string | null
}

export interface TextEventList {
  analysisId: number
  eventVersion: string
  generatedAt: string
  /** 검증에 실패해 뺀 사건 수 */
  droppedEventCount: number
  /** 칸마다 관련 사건을 한 번만 센 값. 칸을 더한 값은 사건 수와 다를 수 있다 */
  fieldCounts: { field: TextField; eventCount: number }[]
  items: TextEventItem[]
  unboundChanges: TextEventUnboundChange[]
}

/** docs/api-spec.md GET /api/analyses/{id}/events/{eventId} */
export interface TextEventDetail extends TextEventItem {
  changes: TextChangeItem[]
}

export function getCurrentEventRun(analysisId: number, signal?: AbortSignal): Promise<TextEventRun> {
  return apiGet(endpoints.currentEventRun(analysisId), undefined, { signal })
}

/** 사건 만들기 시작. 멱등하지만 FAILED면 새 실행을 만드므로 사용자가 요청하지 않은 실패에는 부르지 않는다(ADR-0050) */
export function startEventRun(analysisId: number, signal?: AbortSignal): Promise<TextEventRun> {
  return apiPost(endpoints.eventRuns(analysisId), undefined, { signal })
}

export function getTextEvents(analysisId: number, signal?: AbortSignal): Promise<TextEventList> {
  return apiGet(endpoints.textEvents(analysisId), undefined, { signal })
}

export function getTextEvent(analysisId: number, eventId: number, signal?: AbortSignal): Promise<TextEventDetail> {
  return apiGet(endpoints.textEvent(analysisId, eventId), undefined, { signal })
}
