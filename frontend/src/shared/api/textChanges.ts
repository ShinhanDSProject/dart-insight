import { apiGet, apiPost } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { ReportType } from './reports'
import type { AiInfo } from './summary'

/** docs/api-spec.md GET /api/analyses/{id}/text-changes */
export type TextStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED'
/** NUMERIC_UPDATE 숫자만 바뀜, MOVED 위치 이동(두 쪽 위치가 모두 있음). 분석 버전 m2-8까지의 결과에는 없음 */
export type ChangeType = 'ADDED' | 'DELETED' | 'MODIFIED' | 'NUMERIC_UPDATE' | 'MOVED' | 'REVIEW_NEEDED'
export type BlockType = 'PARAGRAPH' | 'TABLE' | 'SECTION'
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRANKED'
export type TextSort = 'priority' | 'document'
/** 변경의 분야(2.9). 목차 제목으로 나눈 것이라 실제 내용과 다를 수 있다 */
export type TextField = 'LITIGATION' | 'CONTRACT' | 'BUSINESS' | 'DIVIDEND' | 'FUNDING' | 'BOARD' | 'SHAREHOLDER' | 'AUDIT' | 'OTHER'
/** 변경의 묶음(2.9). MAIN·UNPAIRED가 화면의 기본 목록이고 나머지는 접는다 */
export type TextListGroup = 'MAIN' | 'HEADING' | 'FORMATTING' | 'MOVED' | 'NOTE' | 'PAIRED_TABLE' | 'UNPAIRED'
/** 주석의 연결·별도 구분. UNKNOWN은 구분할 수 없음 */
export type NoteScope = 'CONSOLIDATED' | 'SEPARATE' | 'UNKNOWN'

/** 표 행 비교의 행 건수. 코드가 센다 */
export interface RowDiffCounts {
  changed: number
  added: number
  /** 이번 표에 없는 행. 끝났다는 뜻이 아니다 */
  missing: number
  same: number
}

export interface ChangedRow {
  /** 짝지은 열의 값 */
  key: string
  cells: { column: string; previous: string; current: string }[]
}

/** 행을 비교한 표. 목록은 changedRows를 앞에서 3개까지 주고, 근거 상세는 전부와 addedKeys·missingKeys를 준다 */
export interface ComparedRowDiff {
  status: 'COMPARED'
  keyColumn: string
  counts: RowDiffCounts
  /** 구성이 바뀌어 DELETED로 잡힌 이전 표의 위치. 같은 변경 안에서 비교했으면 null */
  pairedPrevious: { rceptNo: string; sectionNo: number; blockNo: number } | null
  changedRows: ChangedRow[]
  addedKeys?: string[]
  missingKeys?: string[]
}

/** 짝지을 값이 없어 행을 비교하지 않은 표 */
export interface NotComparedRowDiff {
  status: 'NOT_COMPARED'
  keyColumn: null
  counts: null
  pairedPrevious: null
  changedRows: never[]
  addedKeys?: string[]
  missingKeys?: string[]
}

export type TextRowDiff = ComparedRowDiff | NotComparedRowDiff

export interface ChangePriority {
  level: PriorityLevel
  /** 적용한 규칙 점수의 합. 판단 유보면 null */
  score: number | null
  /** 적용한 규칙(예: '사업의 내용 섹션 +30') */
  reasons: string[]
}

export interface TextChangeItem {
  changeId: number
  changeNo: number
  changeType: ChangeType
  blockType: BlockType
  /** 숫자만 바뀜. NUMERIC_UPDATE면 true(옛 결과는 MODIFIED에 true가 있음) */
  numbersOnly: boolean
  sectionStatus: string
  sectionTitle: string
  /** 상위 섹션부터 이은 제목. 위치 이동이면 현재 쪽 */
  sectionPath: string
  /** 위치 이동일 때 이전 쪽 섹션 경로. 그 밖은 null */
  previousSectionPath: string | null
  /** 앞부분(수정이면 처음 달라지는 곳부터). 없는 쪽은 null */
  previousPreview: string | null
  currentPreview: string | null
  similarity: number | null
  reviewReason: string | null
  priority: ChangePriority | null
  /** 위험 관련 목차의 변경인지(3.9, FS-61). 목차 제목으로 나눈 것이며 위험의 크기·좋고 나쁨이 아니다 */
  riskRelated: boolean
  /** 이 변경의 묶음. 옛 분석이면 null */
  listGroup: TextListGroup | null
  /** 기본 목록(MAIN) 변경의 분야. 그 밖은 null */
  field: TextField | null
  /** 재무제표 주석에서 기본 목록으로 올린 변경인지. 옛 분석이면 null */
  raisedFromNote: boolean | null
  /** 주석의 연결·별도 구분. 주석이 아니면 null */
  noteScope: NoteScope | null
  /** 표 행 비교(3.30). 문단, 짝이 없는 표의 추가·삭제, 옛 분석이면 null */
  rowDiff: TextRowDiff | null
}

export interface TextChangeCounts {
  all: number
  added: number
  deleted: number
  modified: number
  numericUpdate: number
  moved: number
  reviewNeeded: number
}

/** 최상위 섹션 하나(3.7). count는 유형·검색에 맞는 건수(섹션 조건은 보지 않음), 0일 수 있다 */
export interface TextSectionCount {
  title: string
  count: number
}

export interface TextChangeList {
  analysisId: number
  textStatus: TextStatus | null
  textMessage: string | null
  /** 요청에 쓴 유형을 쉼표로 이은 것(예: 'ADDED,DELETED,MODIFIED'). 없으면 null */
  type: string | null
  sort: TextSort
  /** 요청에 쓴 최상위 섹션 제목. 없으면 null */
  section: string | null
  /** 요청에 쓴 검색어(앞뒤 공백을 지운 값). 없으면 null */
  q: string | null
  /** 요청에 쓴 위험 관련 거르기(3.9) */
  risk: boolean
  page: number
  size: number
  /** type·section·q·risk에 모두 맞는 건수 */
  totalItems: number
  /** 유형별 건수. section·q·risk에 맞는 것만 센다 */
  counts: TextChangeCounts
  /** 위험 관련 목차의 유형별 건수(3.9). section·q에 맞는 것만 센다(type·risk는 보지 않음) */
  riskCounts: TextChangeCounts
  /** 이 분석에 변경이 있는 최상위 섹션 전부(문서 순서) */
  sections: TextSectionCount[]
  /** 요청에 쓴 분야. 없거나 옛 분석이면 null */
  field: TextField | null
  /** 분류 규칙 버전. 옛 분석이거나 변경이 없는 분석이면 null */
  listVersion: string | null
  /** 분야별 기본 목록 건수. 거르기와 상관없이 분석 전체를 센다. listVersion이 null이면 null */
  fieldCounts: Record<TextField, number> | null
  /** 두 보고서 어느 쪽에도 그 분야의 섹션이 없는 분야. listVersion이 null이면 null */
  missingFields: TextField[] | null
  /** 요청에 쓴 묶음. 없거나 옛 분석이면 null */
  group: string | null
  /** 묶음별 건수. 거르기와 상관없이 분석 전체를 센다. 옛 분석이면 null */
  groupCounts: Record<TextListGroup, number> | null
  items: TextChangeItem[]
}

/** 분야별 표(3.28)와 접힌 묶음(3.29)에 쓰는 응답 값 */
export type TextListing = Pick<TextChangeList, 'listVersion' | 'fieldCounts' | 'missingFields' | 'groupCounts'>

export interface TextChangeQuery {
  /** 그중 하나에 맞는 변경만(#304). 비었으면 전체 */
  types: readonly ChangeType[]
  sort: TextSort
  /** 최상위 섹션 제목. null이면 전체 */
  section: string | null
  /** 2자 이상 검색어. null이면 검색하지 않음 */
  q: string | null
  /** true면 위험 관련 목차의 변경만(3.9). 없으면 전체 */
  risk?: boolean
  /** 그 분야의 변경만(3.28). 없으면 전체 */
  field?: TextField | null
  /** 그 묶음의 변경만(3.29). 없거나 비었으면 전체 */
  groups?: readonly TextListGroup[]
  page: number
  size?: number
}

/** 목록 요청의 주소 값. 유형은 쉼표로 잇고, 없으면 보내지 않는다 */
export function textChangeParams(query: TextChangeQuery) {
  return {
    type: query.types.length > 0 ? query.types.join(',') : undefined,
    sort: query.sort,
    section: query.section ?? undefined,
    q: query.q ?? undefined,
    risk: query.risk ? true : undefined,
    field: query.field ?? undefined,
    group: query.groups && query.groups.length > 0 ? query.groups.join(',') : undefined,
    page: query.page,
    size: query.size ?? 20,
  }
}

export function getTextChanges(analysisId: number, query: TextChangeQuery, signal?: AbortSignal): Promise<TextChangeList> {
  return apiGet(endpoints.textChanges(analysisId), textChangeParams(query), { signal })
}

export interface TableCell {
  text: string
  header?: boolean
  colspan?: number
  rowspan?: number
}

/** 한쪽 보고서의 원문 근거(3.4) */
export interface TextSource {
  rceptNo: string
  reportName: string
  reportType: ReportType
  fiscalYear: number
  periodEnd: string
  sectionNo: number
  /** 상위 섹션부터 이은 제목 */
  sectionPath: string
  /** 섹션 단위 검토 필요면 null */
  blockNo: number | null
  /** 근거 ID({접수번호}#B{블록 번호}) */
  evidenceId: string | null
  blockType: string | null
  /** 분석할 때 저장한 전체 글 */
  text: string | null
  /** 표 셀. 문단이거나 저장된 원문과 맞지 않으면 null */
  table: TableCell[][] | null
  /** 저장된 원문 블록이 분석 때와 같은지 */
  blockMatches: boolean
  dartUrl: string
}

export interface TextChangeDetail {
  change: TextChangeItem
  previous: TextSource | null
  current: TextSource | null
}

export function getTextChange(analysisId: number, changeId: number, signal?: AbortSignal): Promise<TextChangeDetail> {
  return apiGet(endpoints.textChange(analysisId, changeId), undefined, { signal })
}

/** docs/api-spec.md GET /api/analyses/{id}/text-changes/{changeId}/history (3.8) */
export type HistoryStatus = 'PRESENT' | 'ABSENT' | 'NOT_ANALYZED' | 'REVIEW_NEEDED'

export interface TextHistoryEntry {
  /** dartUrl: 그 보고서의 DART 원문 주소('출처: DART' 링크, 5.6) */
  report: { rceptNo: string; reportName: string; reportType: ReportType; periodEnd: string; dartUrl: string }
  status: HistoryStatus
  /** PRESENT일 때 그 보고서의 글 */
  text: string | null
  /** PRESENT일 때 근거 위치 */
  sectionPath: string | null
  evidenceId: string | null
  /** 바로 앞 항목에서 이 보고서로 오며 생긴 변경. 바뀌지 않았거나 알 수 없으면 null */
  change: { analysisId: number; changeId: number; changeType: ChangeType } | null
}

export interface TextChangeHistory {
  analysisId: number
  changeId: number
  /** 오래된 보고서부터 */
  entries: TextHistoryEntry[]
}

export function getTextChangeHistory(
  analysisId: number,
  changeId: number,
  signal?: AbortSignal,
): Promise<TextChangeHistory> {
  return apiGet(endpoints.textChangeHistory(analysisId, changeId), undefined, { signal })
}

/** docs/api-spec.md GET /api/analyses/{id}/text-changes/{changeId}/related-disclosures (3.6, FS-54) */
export type RelatedStatus = 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE'
/** B001 주요사항보고서, I001 수시공시, I002 공정공시 */
export type DisclosureDetailType = 'B001' | 'I001' | 'I002'
/** DURING 현재 보고서 기간 안, AFTER 기간 뒤~제출 전 */
export type DisclosureTiming = 'DURING' | 'AFTER'
/** STRONG 내용 일치(주요정보 값이 변경 글에 있음), TYPE_ONLY 같은 종류 */
export type MatchLevel = 'STRONG' | 'TYPE_ONLY'
export type MatchedField = 'NEW_SHARES' | 'PLAINTIFF' | 'CASE_NAME' | 'TARGET_COMPANY'

export interface RelatedDisclosure {
  rceptNo: string
  /** 주요정보로 확인한 최신 정정본 접수번호. 모르면 rceptNo와 같음 */
  latestRceptNo: string
  reportName: string
  receivedDate: string
  disclosureType: DisclosureDetailType
  timing: DisclosureTiming
  matchRule: string
  matchRuleLabel: string
  matchLevel: MatchLevel
  /** STRONG일 때 일치한 값 종류. TYPE_ONLY면 빈 배열 */
  matchedFields: MatchedField[]
  remarks: string | null
  /** latestRceptNo의 DART 공시뷰어 주소 */
  dartUrl: string
}

export interface TextChangeRelatedDisclosures {
  analysisId: number
  changeId: number
  status: RelatedStatus
  /** UNAVAILABLE일 때 공시 목록을 받지 못한 사유(DART_*). 아니면 null */
  unavailableReason: string | null
  /** 주요정보(DS005)를 받지 못해 '내용 일치'를 판정하지 못했으면 true */
  partial: boolean
  window: { from: string; periodEnd: string; to: string }
  ruleVersion: string
  computedAt: string
  cached: boolean
  /** STRONG 먼저, 같으면 접수일이 최근인 순서. NOT_FOUND·UNAVAILABLE이면 빈 배열 */
  items: RelatedDisclosure[]
  /** 영역 맨 아래에 그대로 보여 줄 고정 문구 */
  notice: string
}

export function getTextChangeRelatedDisclosures(
  analysisId: number,
  changeId: number,
  signal?: AbortSignal,
): Promise<TextChangeRelatedDisclosures> {
  return apiGet(endpoints.textChangeRelatedDisclosures(analysisId, changeId), undefined, { signal })
}

/** docs/api-spec.md POST /api/analyses/{id}/text-changes/{changeId}/explanations (3.11, FS-6) */
export type TextExplanationStatus = 'OK' | 'REVIEW_NEEDED' | 'NO_SOURCE'

/** 풀이가 인용한 원문 위치 */
export interface TextExplanationEvidence {
  side: DocumentSide
  rceptNo: string
  /** 근거 블록이 속한 섹션 번호(분석 때 저장한 위치). 찾지 못하면 null */
  sectionNo: number | null
  blockNo: number
  /** 상위 섹션부터 이은 경로. 찾지 못하면 null */
  sectionPath: string | null
  /** 근거 ID({접수번호}#B{블록 번호}) */
  evidenceId: string
}

export interface TextExplanation {
  changeId: number
  status: TextExplanationStatus
  /** OK일 때만. 그 밖은 null */
  sentence: string | null
  /** 풀이하지 못한 사유 등 안내 */
  message: string | null
  evidence: TextExplanationEvidence[]
  /** sentence가 AI가 만든 문장(OK)이면 true. 'AI 생성' 표시는 이 값으로 한다(5.6) */
  aiGenerated: boolean
  /** AI 문장일 때만. NO_SOURCE면 null */
  ai: AiInfo | null
  /** 저장된 풀이를 그대로 돌려줬는지(AI 호출 없음) */
  cached: boolean
}

/** 문장 변경 AI 한 줄 풀이(만들거나 저장된 것). 서버가 분석·변경마다 하나만 저장한다 */
export function explainTextChange(analysisId: number, changeId: number, signal?: AbortSignal): Promise<TextExplanation> {
  return apiPost(endpoints.textChangeExplanations(analysisId, changeId), undefined, { signal })
}
