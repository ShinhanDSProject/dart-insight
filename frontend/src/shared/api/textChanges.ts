import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { ReportType } from './reports'

/** docs/api-spec.md GET /api/analyses/{id}/text-changes */
export type TextStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED'
export type ChangeType = 'ADDED' | 'DELETED' | 'MODIFIED' | 'REVIEW_NEEDED'
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
  numbersOnly: boolean
  sectionStatus: string
  sectionTitle: string
  sectionPath: string
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
