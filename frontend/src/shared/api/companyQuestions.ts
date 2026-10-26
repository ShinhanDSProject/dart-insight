import { apiGet, apiPost } from './client'
import { endpoints } from './endpoints'
import type { QuestionStatus } from './questions'
import type { AiInfo } from './summary'

/** docs/api-spec.md POST·GET /api/companies/{corpCode}/questions (1.2, FS-53, ADR-0029) */

/** 답한 보고서(최신 사업보고서, 없으면 최신 정기보고서) */
export interface CompanyQuestionReport {
  rceptNo: string
  reportName: string
  dartUrl: string
}

/** 답이 인용한 원문 문단. 답 안의 `[no]`가 가리킨다. 저장된 블록을 찾지 못하면 위치·글이 null */
export interface CompanyQuestionCitation {
  no: number
  evidenceId: string
  rceptNo: string
  sectionNo: number | null
  blockNo: number | null
  /** 상위 목차부터 이은 제목(' > '로 이음) */
  sectionPath: string | null
  /** 문단 앞 160자 */
  quote: string | null
}

export interface CompanyQuestionAnswer {
  questionId: number
  question: string
  status: QuestionStatus
  /** ANSWERED일 때만. 그 밖은 null */
  answer: string | null
  /** 답하지 못한 사유 등 안내. ANSWERED면 null */
  message: string | null
  citations: CompanyQuestionCitation[]
  report: CompanyQuestionReport
  /** AI가 답을 만들었으면 true(ANSWERED·REVIEW_NEEDED) */
  aiGenerated: boolean
  ai: AiInfo | null
  createdAt: string
}

export interface CompanyQuestionHistory {
  /** 지금 대상 보고서. 정기보고서가 없으면 null */
  report: CompanyQuestionReport | null
  items: CompanyQuestionAnswer[]
}

/** 사업보고서에 근거해 묻기(동기 호출, 처음 여는 기업은 원문 준비로 수십 초). 서버에 쓰는 요청이라 취소하지 않는다 */
export function askCompanyQuestion(corpCode: string, question: string): Promise<CompanyQuestionAnswer> {
  return apiPost(endpoints.companyQuestions(corpCode), { question })
}

/** 지금 대상 보고서에 한 질문·답 기록(최신 순, 최대 20개) */
export function getCompanyQuestions(corpCode: string, signal?: AbortSignal): Promise<CompanyQuestionHistory> {
  return apiGet(endpoints.companyQuestions(corpCode), undefined, { signal })
}
