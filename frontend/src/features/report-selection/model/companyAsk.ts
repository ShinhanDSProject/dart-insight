import { match } from 'ts-pattern'
import type { CompanyQuestionAnswer, CompanyQuestionCitation } from '@/shared/api/companyQuestions'
import { displaySectionPath } from '@/shared/lib/sectionTitle'

/**
 * 기업 개요 탭 'AI에게 묻기 · 사업보고서 기준'(FS-53, ADR-0029)의 상태와 순수 함수.
 * 입력 글·보내는 요청·답 목록이 함께 바뀌어 reducer로 둔다(ST-2). 답은 최신 순이고 questionId로 한 번만 둔다.
 */

export const COMPANY_ASK_EXAMPLES = [
  '주요 제품과 서비스는 무엇인가요?',
  '회사가 밝힌 주요 위험은 무엇인가요?',
  '주요 매출처는 어디인가요?',
] as const

export const COMPANY_ASK_INTRO =
  '최신 사업보고서 원문에서 찾은 문단으로만 답해요. 투자 판단·주가 예측 질문에는 답하지 않아요.'

/** 질문을 보내지 못했을 때 에러 코드별 안내(API-3) */
export const COMPANY_ASK_ERROR_MESSAGES: Record<string, string> = {
  AI_SERVER_UNAVAILABLE: 'AI 서버를 지금 쓸 수 없어 답하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  REPORT_NOT_FOUND: '이 기업의 정기보고서가 없어 물어볼 수 없어요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 원문을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 원문을 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 인증키가 없어 원문을 받지 못했어요. 관리자에게 알려 주세요.',
  COMPANY_NOT_FOUND: '기업을 찾지 못했어요.',
  COMMON_INVALID_INPUT: '질문을 2~200자로 입력해 주세요.',
}

export type CompanyAskRequest =
  | { status: 'idle' }
  /** fromDraft: 입력창 글을 보냈는지(답이 오면 입력창을 비움). 예시 질문이면 false */
  | { status: 'sending'; question: string; fromDraft: boolean }
  | { status: 'error'; question: string; fromDraft: boolean; error: unknown }

export interface CompanyAskState {
  draft: string
  /** 짧은 글을 보내려 했음('2자 이상' 안내). 글을 고치면 지운다 */
  draftRejected: boolean
  request: CompanyAskRequest
  items: CompanyQuestionAnswer[]
  /** 마지막으로 받은 답(화면 읽기 프로그램에 알림). 없으면 null */
  lastAnsweredId: number | null
}

export type CompanyAskAction =
  | { type: 'set-draft'; draft: string }
  | { type: 'reject-draft' }
  | { type: 'send'; question: string; fromDraft: boolean }
  | { type: 'answer'; answer: CompanyQuestionAnswer }
  | { type: 'fail'; error: unknown }
  | { type: 'history'; items: CompanyQuestionAnswer[] }

export const initialCompanyAskState: CompanyAskState = {
  draft: '',
  draftRejected: false,
  request: { status: 'idle' },
  items: [],
  lastAnsweredId: null,
}

function uniqueById(items: CompanyQuestionAnswer[]): CompanyQuestionAnswer[] {
  const seen = new Set<number>()
  return items.filter((item) => (seen.has(item.questionId) ? false : (seen.add(item.questionId), true)))
}

export function companyAskReducer(state: CompanyAskState, action: CompanyAskAction): CompanyAskState {
  return match<CompanyAskAction, CompanyAskState>(action)
    .with({ type: 'set-draft' }, ({ draft }) => ({ ...state, draft, draftRejected: false }))
    .with({ type: 'reject-draft' }, () => ({ ...state, draftRejected: true }))
    // 보내는 중에는 새 질문을 받지 않는다(한 번에 하나)
    .with({ type: 'send' }, ({ question, fromDraft }) =>
      state.request.status === 'sending'
        ? state
        : { ...state, draftRejected: false, request: { status: 'sending', question, fromDraft } },
    )
    .with({ type: 'answer' }, ({ answer }) =>
      match(state.request)
        .with({ status: 'sending' }, (request) => ({
          ...state,
          draft: request.fromDraft ? '' : state.draft,
          request: { status: 'idle' } as const,
          items: uniqueById([answer, ...state.items]),
          lastAnsweredId: answer.questionId,
        }))
        .otherwise(() => state),
    )
    // 실패해도 입력창 글은 그대로 둔다(다시 보내기 쉽게)
    .with({ type: 'fail' }, ({ error }) =>
      match(state.request)
        .with({ status: 'sending' }, ({ question, fromDraft }) => ({
          ...state,
          request: { status: 'error', question, fromDraft, error } as const,
        }))
        .otherwise(() => state),
    )
    // 기록보다 이 화면에서 받은 답이 새것이라 앞에 둔다
    .with({ type: 'history' }, ({ items }) => ({ ...state, items: uniqueById([...state.items, ...items]) }))
    .exhaustive()
}

/** 인용 위치 한 줄: 섹션 경로(앞 번호 정리)와 블록 번호. 저장된 블록을 찾지 못하면 '위치 확인 안 됨' */
export function citationLocation(citation: CompanyQuestionCitation): string {
  const path = citation.sectionPath ? displaySectionPath(citation.sectionPath) : '위치 확인 안 됨'
  return citation.blockNo === null ? path : `${path} · 블록 ${citation.blockNo}`
}

/** 답이 없을 때의 안내 제목. ANSWERED면 null */
export function unansweredTitle(answer: CompanyQuestionAnswer): string | null {
  return match(answer.status)
    .with('ANSWERED', () => null)
    .with('NOT_FOUND', () => '관련 내용을 찾지 못했어요')
    .with('OUT_OF_SCOPE', () => '답하지 않는 질문이에요')
    .with('REVIEW_NEEDED', () => '검토 필요')
    .exhaustive()
}
