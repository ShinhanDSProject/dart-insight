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

export interface TextChangeList {
  analysisId: number
  textStatus: TextStatus | null
  textMessage: string | null
  type: ChangeType | null
  sort: TextSort
  page: number
  size: number
  totalItems: number
  counts: TextChangeCounts
  items: TextChangeItem[]
}

export interface TextChangeQuery {
  type: ChangeType | null
  sort: TextSort
  page: number
  size?: number
}

export function getTextChanges(analysisId: number, query: TextChangeQuery, signal?: AbortSignal): Promise<TextChangeList> {
  return apiGet(
    endpoints.textChanges(analysisId),
    {
      type: query.type ?? undefined,
      sort: query.sort,
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
