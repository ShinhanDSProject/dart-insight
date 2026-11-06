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

/** 외화 환산에 쓴 환율. disclosed_rate 그 공시 글의 환율, reference_table 저장소 환율표, none 환율 없음 */
export type TextEventFxSource = 'disclosed_rate' | 'reference_table' | 'none'

/** 코드가 기준표로 붙인 신호(ADR-0060). AI가 정하지 않는다 */
export type TextEventSignal = 'CAUTION' | 'POSITIVE' | 'HOLD'
export type TextEventHoldReason = 'NO_CRITERIA' | 'EVIDENCE_NOT_CONFIRMED' | 'MIXED_SIDES' | 'MIXED_LITIGATION'

/** 묶인 표 변경의 행 비교를 더한 값 */
export interface TextEventRowCounts {
  changed: number
  added: number
  missing: number
}

/** GENERATED AI 문장, FALLBACK 기준표의 일반 문구(신호 이유만), FAILED 문장 없음(공시의 의미만) */
export type TextEventSentenceStatus = 'GENERATED' | 'FALLBACK' | 'FAILED'
/** 공시의 의미: FACT·ABSENT. 신호 이유: REASON·GOOD·BAD·WHY_HOLD·GENERAL */
export type TextEventSentenceType = 'FACT' | 'ABSENT' | 'REASON' | 'GOOD' | 'BAD' | 'WHY_HOLD' | 'GENERAL'

export interface TextEventEvidence {
  evidenceId: string
  /** 근거 블록이 속한 변경의 섹션 경로. 찾지 못하면 null */
  sectionPath: string | null
}

export interface TextEventSentenceItem {
  type: TextEventSentenceType
  /** 공시의 의미에만 있다 */
  absentTopics?: string[]
  text: string
  /** ABSENT면 확인한 범위, GENERAL이면 [] */
  evidence: TextEventEvidence[]
}

/** 사건 문장 칸(공시의 의미, 신호 이유) */
export interface TextEventSentence {
  status: TextEventSentenceStatus
  failReason: string | null
  /** GENERATED면 true. 'AI 생성' 표시는 이 값으로 한다 */
  aiGenerated: boolean
  items: TextEventSentenceItem[]
  model: string | null
  promptVersion: string | null
  generatedAt: string | null
}

export interface TextEventGlossaryTerm {
  term: string
  meaning: string
  source: string
}

/** docs/api-spec.md GET /api/analyses/{id}/events의 items[]. 규모(scale*)는 사건 순서를 정한 값이다 */
export interface TextEventItem {
  eventId: number
  sortOrder: number
  title: string
  /** 기준표의 사건 종류 이름. 기준표에 없으면 '그 밖의 사건' */
  kind: string
  kindCode: string
  changeCode: string
  /** 기준표의 변화 이름 */
  changeName: string | null
  signal: TextEventSignal
  /** HOLD일 때만 */
  holdReason: TextEventHoldReason | null
  signalEvidenceId: string | null
  /** 행을 비교한 표가 없으면 null */
  rowCounts: TextEventRowCounts | null
  /** 만들지 않았으면 null */
  meaning: TextEventSentence | null
  /** NO_CRITERIA·EVIDENCE_NOT_CONFIRMED면 만들지 않아 null */
  signalReason: TextEventSentence | null
  glossary: TextEventGlossaryTerm[]
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
  /** 외화일 때만 */
  fxSource: TextEventFxSource | null
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
  /** 사건을 만들 때 쓴 기준표 버전 */
  signalTableVersion: string
  generatedAt: string
  /** 검증에 실패해 뺀 사건 수 */
  droppedEventCount: number
  /** 칸마다 관련 사건을 한 번만 센 값. 칸을 더한 값은 사건 수와 다를 수 있다 */
  fieldCounts: { field: TextField; eventCount: number }[]
  /** 신호마다 사건 수(0인 신호도 있음) */
  signalCounts: { signal: TextEventSignal; eventCount: number }[]
  items: TextEventItem[]
  unboundChanges: TextEventUnboundChange[]
}

/** docs/api-spec.md GET /api/analyses/{id}/events/{eventId} */
export interface TextEventDetail extends TextEventItem {
  changes: TextChangeItem[]
}

/** MIXED 좋은 면·나쁜 면이 함께 있어 보류, null 기준 없음(보류) */
export type SignalTableSignal = 'CAUTION' | 'POSITIVE' | 'MIXED'

export interface SignalTableChange {
  code: string
  name: string
  signal: SignalTableSignal | null
  explicitOnly: boolean
  general: string | null
}

export interface SignalTableKind {
  code: string
  name: string
  /** 새로 발생하면 맨 앞에 두는 종류 */
  front: boolean
  changes: SignalTableChange[]
  generalSides: { good: string; bad: string } | null
}

/** docs/api-spec.md GET /api/signal-tables/current. 화면에 쓰지 않는 계정 칸은 두지 않는다 */
export interface SignalTable {
  version: string
  /** 신호를 보여 주는 화면에 함께 두는 안내 */
  signalNotice: string
  kinds: SignalTableKind[]
  glossary: TextEventGlossaryTerm[]
}

export function getSignalTable(signal?: AbortSignal): Promise<SignalTable> {
  return apiGet(endpoints.currentSignalTable(), undefined, { signal })
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
