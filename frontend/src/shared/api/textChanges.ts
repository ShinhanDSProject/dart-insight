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
  type: ChangeType | null
  sort: TextSort
  /** 요청에 쓴 최상위 섹션 제목. 없으면 null */
  section: string | null
  /** 요청에 쓴 검색어(앞뒤 공백을 지운 값). 없으면 null */
  q: string | null
  page: number
  size: number
  /** type·section·q에 모두 맞는 건수 */
  totalItems: number
  /** 유형별 건수. section·q에 맞는 것만 센다 */
  counts: TextChangeCounts
  /** 이 분석에 변경이 있는 최상위 섹션 전부(문서 순서) */
  sections: TextSectionCount[]
  items: TextChangeItem[]
}

export interface TextChangeQuery {
  type: ChangeType | null
  sort: TextSort
  /** 최상위 섹션 제목. null이면 전체 */
  section: string | null
  /** 2자 이상 검색어. null이면 검색하지 않음 */
  q: string | null
  page: number
  size?: number
}

export function getTextChanges(analysisId: number, query: TextChangeQuery, signal?: AbortSignal): Promise<TextChangeList> {
  return apiGet(
    endpoints.textChanges(analysisId),
    {
      type: query.type ?? undefined,
      sort: query.sort,
      section: query.section ?? undefined,
      q: query.q ?? undefined,
      page: query.page,
      size: query.size ?? 20,
    },
    { signal },
  )
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
  /** AI 문장일 때만. NO_SOURCE면 null */
  ai: AiInfo | null
  /** 저장된 풀이를 그대로 돌려줬는지(AI 호출 없음) */
  cached: boolean
}

/** 문장 변경 AI 한 줄 풀이(만들거나 저장된 것). 서버가 분석·변경마다 하나만 저장한다 */
export function explainTextChange(analysisId: number, changeId: number, signal?: AbortSignal): Promise<TextExplanation> {
  return apiPost(endpoints.textChangeExplanations(analysisId, changeId), undefined, { signal })
}
