import { match } from 'ts-pattern'
import type { DisclosureGroup } from '@/shared/api/disclosures'
import type { CompanyNote, NoteItem, NoteList } from '@/shared/api/notes'
import { communityQuotePath } from '@/shared/lib/communityQuoteLink'

/** 판단 노트 화면 상태(ST-1). anonymous: 로그인하지 않음(서버를 부르지 않음) */
export type NotesState =
  | { status: 'anonymous' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: NoteList }

export type NotesAction =
  | { type: 'set-anonymous' }
  | { type: 'start' }
  | { type: 'resolve'; data: NoteList }
  | { type: 'reject'; error: unknown }
  /** 메모를 고친 항목(서버 응답)으로 바꾼다 */
  | { type: 'replace-item'; item: NoteItem }
  /** 항목 하나를 뺀다. 기업에 남은 항목이 없으면 기업도 뺀다 */
  | { type: 'remove-item'; itemId: number }

/** 목록 상태 전이. 목록을 다 받은 뒤에만 항목을 바꾼다 */
export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  return match<NotesAction, NotesState>(action)
    .with({ type: 'set-anonymous' }, () => ({ status: 'anonymous' }))
    .with({ type: 'start' }, () => ({ status: 'loading' }))
    .with({ type: 'resolve' }, ({ data }) => (state.status === 'loading' ? { status: 'success', data } : state))
    .with({ type: 'reject' }, ({ error }) => (state.status === 'loading' ? { status: 'error', error } : state))
    .with({ type: 'replace-item' }, ({ item }) =>
      state.status !== 'success'
        ? state
        : {
            status: 'success',
            data: {
              companies: state.data.companies.map((company) => ({
                ...company,
                items: company.items.map((current) => (current.itemId === item.itemId ? item : current)),
              })),
            },
          },
    )
    .with({ type: 'remove-item' }, ({ itemId }) =>
      state.status !== 'success'
        ? state
        : {
            status: 'success',
            data: {
              companies: state.data.companies
                .map((company) => ({ ...company, items: company.items.filter((item) => item.itemId !== itemId) }))
                .filter((company) => company.items.length > 0),
            },
          },
    )
    .exhaustive()
}

/**
 * 결과 화면의 그 근거로 돌아가는 주소(AC1). 분석 결과 화면의 주소 약속(?tab=financial&sj=&change=, ?tab=text&tc=,
 * AI 답 인용은 원문 확인 ?tab=source&doc=&section=&block=)과 같다. 위치를 모르면 null(링크를 만들지 않음)
 */
export function noteResultLink(item: NoteItem): string | null {
  const { analysisId, changeId, sjDiv, side, sectionNo, blockNo } = item.source
  if (analysisId === null) return null
  const base = `/analyses/${encodeURIComponent(analysisId)}`
  return match(item.kind)
    .with('FINANCIAL_CHANGE', () =>
      sjDiv === null || changeId === null
        ? null
        : `${base}?${new URLSearchParams({ tab: 'financial', sj: sjDiv, change: String(changeId) })}`,
    )
    .with('TEXT_CHANGE', () => (changeId === null ? null : `${base}?${new URLSearchParams({ tab: 'text', tc: String(changeId) })}`))
    .with('ANSWER_CITATION', () => {
      if (side === null || sectionNo === null) return null
      const params = new URLSearchParams({ tab: 'source', doc: side, section: String(sectionNo) })
      if (blockNo !== null) params.set('block', String(blockNo))
      return `${base}?${params}`
    })
    .exhaustive()
}

/**
 * 노트 항목을 해당 기업 커뮤니티 글쓰기 칸에 근거로 붙여 여는 주소(#535).
 * 분석 버전이 바뀌었거나(outdated), 검토 필요 항목이거나, AI 답 인용이거나, 변경 ID가 없으면 null(링크를 두지 않음)
 */
export function noteQuoteLink(item: NoteItem): string | null {
  if (item.outdated || item.changeType === 'REVIEW_NEEDED') return null
  if (item.kind !== 'FINANCIAL_CHANGE' && item.kind !== 'TEXT_CHANGE') return null
  const { analysisId, changeId, sjDiv } = item.source
  if (analysisId === null || changeId === null) return null
  return communityQuotePath({
    corpCode: item.corpCode,
    analysisId,
    kind: item.kind,
    changeId,
    sjDiv,
  })
}

const changeTypeLabels: Record<string, string> = {
  ADDED: '추가',
  DELETED: '삭제',
  MODIFIED: '수정',
  NUMERIC_UPDATE: '숫자만 바뀜',
  MOVED: '위치 이동',
  REVIEW_NEEDED: '검토 필요',
}

/** 항목 종류 배지: '재무 수치', '문장 변경 · 수정', 'AI 답 인용' */
export function noteKindLabel(item: Pick<NoteItem, 'kind' | 'changeType'>): string {
  return match(item.kind)
    .with('FINANCIAL_CHANGE', () => '재무 수치')
    .with('TEXT_CHANGE', () =>
      item.changeType === null ? '문장 변경' : `문장 변경 · ${changeTypeLabels[item.changeType] ?? item.changeType}`,
    )
    .with('ANSWER_CITATION', () => 'AI 답 인용')
    .exhaustive()
}

const disclosureGroupLabels: Record<DisclosureGroup, string> = {
  PERIODIC: '정기보고서',
  OWNERSHIP: '지분 변동',
  FUNDING: '자금 조달',
  GOVERNANCE: '지배구조',
  BUSINESS: '실적·영업',
  OTHER: '기타',
}

export function disclosureGroupLabel(group: DisclosureGroup): string {
  return disclosureGroupLabels[group]
}

export function companyOverviewLink(corpCode: string): string {
  return `/companies/${encodeURIComponent(corpCode)}`
}

export function newerAnalysisLink(analysisId: number): string {
  return `/analyses/${encodeURIComponent(analysisId)}`
}

export function hasCompanyFollowups(company: Pick<CompanyNote, 'newerAnalyses' | 'newerDisclosures'>): boolean {
  return company.newerAnalyses.length > 0 || company.newerDisclosures.length > 0
}

/** 근거 위치 한 줄: '접수번호 … · 섹션 2 · 문단 1' */
export function noteLocation(item: NoteItem): string | null {
  const { rceptNo, sectionNo, blockNo } = item.source
  if (rceptNo === null) return null
  const parts = [`접수번호 ${rceptNo}`]
  if (sectionNo !== null) parts.push(`섹션 ${sectionNo}`)
  if (blockNo !== null) parts.push(`문단 ${blockNo}`)
  return parts.join(' · ')
}

/** 2026-10-27T10:15:00 → 2026.10.27 10:15 */
export function noteTime(iso: string): string {
  return `${iso.slice(0, 10).replaceAll('-', '.')} ${iso.slice(11, 16)}`
}

export const OUTDATED_NOTE = '분석 방식이 바뀌어 위치가 달라졌을 수 있어요'

/** 후속 분석·공시 연결 고정 안내 문구(#504 AC5) */
export const FOLLOWUP_NOTICE = '같은 기업에서 이후에 공시된 내역이며 인과관계를 뜻하지 않아요.'

/** 내보내기 파일 이름(서버의 Content-Disposition과 같음) */
export function exportFileName(corpCode: string): string {
  return `judgment-note-${corpCode}.md`
}
