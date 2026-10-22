import { apiGet } from './client'

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

export function getTextChanges(analysisId: number, query: TextChangeQuery): Promise<TextChangeList> {
  return apiGet(`/api/analyses/${analysisId}/text-changes`, {
    type: query.type ?? undefined,
    sort: query.sort,
    page: query.page,
    size: query.size ?? 20,
  })
}
