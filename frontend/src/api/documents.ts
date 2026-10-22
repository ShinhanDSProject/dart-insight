import { apiGet } from './client'
import type { TableCell } from './textChanges'

/** docs/api-spec.md GET /api/analyses/{id}/documents/{side} (3.5) */
export type DocumentSide = 'current' | 'previous'
export type DocumentStatus = 'STRUCTURED' | 'PARTIAL' | 'FAILED' | 'NOT_AVAILABLE' | 'NOT_FETCHED'

export interface SectionItem {
  sectionNo: number
  parentNo: number | null
  /** 목차 깊이(1이 대목차) */
  depth: number
  title: string
  cover: boolean
  blockCount: number
}

export interface DocumentOutline {
  side: DocumentSide
  rceptNo: string
  reportName: string
  documentStatus: DocumentStatus
  /** 일부만 읽었거나 읽지 못했을 때 사유 */
  statusMessage: string | null
  dartUrl: string
  /** DART 원문 안 위치로 바로 가는 주소를 주는지(지금은 늘 false: 위치 이동 미지원) */
  positionLinkSupported: boolean
  sections: SectionItem[]
}

export interface SourceBlock {
  blockNo: number
  evidenceId: string
  type: 'PARAGRAPH' | 'TABLE'
  text: string
  table: TableCell[][] | null
}

export interface SectionContent {
  side: DocumentSide
  rceptNo: string
  sectionNo: number
  title: string
  sectionPath: string
  blocks: SourceBlock[]
}

export function getDocumentOutline(analysisId: number, side: DocumentSide): Promise<DocumentOutline> {
  return apiGet(`/api/analyses/${analysisId}/documents/${side}`)
}

export function getSection(analysisId: number, side: DocumentSide, sectionNo: number): Promise<SectionContent> {
  return apiGet(`/api/analyses/${analysisId}/documents/${side}/sections/${sectionNo}`)
}

/** 목차에서 처음 보여 줄 섹션: 표지가 아니고 글이 있는 첫 섹션 */
export function firstContentSection(sections: SectionItem[]): number | null {
  return sections.find((s) => !s.cover && s.blockCount > 0)?.sectionNo ?? sections[0]?.sectionNo ?? null
}
