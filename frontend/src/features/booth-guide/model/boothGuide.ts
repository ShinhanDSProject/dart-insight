/**
 * 전시 부스용 '따라 해 보기' 안내(발표 11/18). 심사위원이 처음 보는 서비스를 혼자 써 볼 수 있게
 * 화면마다 지금 할 일을 한 장의 카드로 알려 주고, 화면에 들어오면 다음에 누를 곳에 테두리를 그리고 초점을 옮긴다.
 * 화면을 옮기면 카드가 그 화면의 단계로 따라간다(다음 버튼 없이 사용자가 직접 누르며 나아간다).
 * ?guide로 켜고(첫 화면의 '따라 해 보기' 버튼) ?guide=off로 끈다. 부스(kiosk)로 들어온 탭에서는 처음부터 켜진다.
 */
import { BOOTH_GUIDE_PARAM } from '@/shared/lib/boothGuide'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'

/** 켜고 끄는 주소 매개변수 */
export { BOOTH_GUIDE_PARAM }
/**
 * 이 탭에서 고른 보기(open·folded·off)를 화면을 옮겨도 유지하는 sessionStorage 키.
 * 대기 화면(/easter/idle.html)이 열릴 때 이 키를 지워(부스 켜짐 표시 'dart-insight:kiosk'만 남김) 다음 방문자는 처음부터 본다
 */
export const BOOTH_GUIDE_STORAGE_KEY = 'dart-insight:booth-guide'

/** open: 카드를 펼침, folded: 작은 버튼으로 접음, off: 보이지 않음 */
export type BoothGuideView = 'open' | 'folded' | 'off'

/** 주소의 ?guide를 읽는다. ?guide=off면 끄고, 값이 없거나 다른 값이면 켠다 */
export function boothGuideRequest(search: string): BoothGuideView | null {
  const params = new URLSearchParams(search)
  if (!params.has(BOOTH_GUIDE_PARAM)) return null
  return params.get(BOOTH_GUIDE_PARAM) === 'off' ? 'off' : 'open'
}

/** 이 탭에 남긴 보기를 먼저 따르고, 없으면 부스로 들어온 탭에서만 펼친다 */
export function boothGuideView(stored: string | null, kiosk: boolean): BoothGuideView {
  if (stored === 'open' || stored === 'folded' || stored === 'off') return stored
  return kiosk ? 'open' : 'off'
}

export type GuideStage = 'search' | 'company' | 'compare' | 'progress' | 'result'

/** 화면 주소로 지금 단계를 정한다. 단계 밖의 화면(노트·로그인 등)은 null */
export function guideStage(pathname: string): GuideStage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/') return 'search'
  if (/^\/companies\/[^/]+$/.test(path)) return 'company'
  if (/^\/companies\/[^/]+\/compare$/.test(path)) return 'compare'
  if (/^\/analyses\/\d+\/progress$/.test(path)) return 'progress'
  if (/^\/analyses\/\d+$/.test(path)) return 'result'
  return null
}

/** 위쪽 진행 표시에 쓰는 순서 */
export const GUIDE_STAGES: readonly { stage: GuideStage; label: string }[] = [
  { stage: 'search', label: '기업 찾기' },
  { stage: 'company', label: '보고서 고르기' },
  { stage: 'compare', label: '비교 확인' },
  { stage: 'progress', label: '분석' },
  { stage: 'result', label: '결과 보기' },
]

/** 진행 막대 한 칸의 상태. 지금 단계가 없으면(-1) 모두 아직이다 */
export function stageState(index: number, current: number): 'done' | 'current' | 'todo' {
  if (index === current) return 'current'
  return index < current ? 'done' : 'todo'
}

/** 강조할 곳. 앞에서부터 화면에 보이는 첫 요소를 고른다 */
export type GuideTarget = readonly string[]

/** 카드의 두 번째 버튼: 다른 곳을 강조하거나, 예시 화면으로 옮기거나, 화면의 링크(첫 번째)를 대신 누른다 */
export type GuideShortcut =
  | { kind: 'spotlight'; label: string; target: GuideTarget }
  | { kind: 'go'; label: string; to: string }
  | { kind: 'open'; label: string; link: string }

export interface GuideStep {
  title: string
  text: string
  /** 이 단계에 들어오면 테두리를 그릴 곳 */
  target: GuideTarget | null
  /** 이 단계에 들어오면 키보드 초점을 옮길 곳(바로 치거나 Enter로 넘어가게). 없으면 옮기지 않는다 */
  focus: string | null
  shortcut: GuideShortcut | null
}

export const GUIDE_STEPS: Record<GuideStage, GuideStep> = {
  search: {
    title: '회사를 찾아 보세요',
    text: '검색창에 바로 회사 이름을 쳐 보세요. 초성만 쳐도 찾아요(예: ㅅㅅㅈㅈ → 삼성전자). 목록에서 회사를 누르세요.',
    target: ['.search-hero .search-form', '#company-query'],
    focus: '#company-query',
    shortcut: { kind: 'go', label: '삼성전자로 해 보기', to: `/companies/${ONBOARDING_EXAMPLE_CORP_CODE}` },
  },
  company: {
    title: '비교할 보고서를 고르세요',
    text: '현재 보고서만 고르면 1년 전 같은 시기 보고서를 알아서 짝지어 줘요. 테두리 친 요약에서 비교 확인으로 넘어가세요.',
    target: ['section.pick-summary', '#pair-current'],
    focus: 'section.pick-summary .pick-summary__actions a.button--primary',
    // 가장 최근에 끝난 비교(목록 첫 줄)의 결과 화면으로 바로 간다
    shortcut: { kind: 'open', label: '이미 분석한 결과 보기', link: '.past-analyses a.list-link' },
  },
  compare: {
    title: '비교할 수 있는지 확인해요',
    text: '두 보고서의 기간과 재무제표가 맞는지 먼저 봐요. 맞으면 테두리 친 분석 실행을 누르세요.',
    target: ['.compare-actions .button--primary', '.compare-actions'],
    focus: '.compare-actions .button--primary',
    shortcut: null,
  },
  progress: {
    title: '분석하는 중이에요',
    text: '처음 비교하는 보고서 쌍이면 1~2분 걸려요. 끝나면 결과 화면으로 저절로 넘어가요.',
    target: null,
    focus: null,
    shortcut: null,
  },
  result: {
    title: '결과를 둘러보세요',
    text: '요약에 크게 바뀐 숫자와 문장이 먼저 나와요. 아래를 하나씩 눌러 보세요.',
    target: ['section.headline'],
    focus: null,
    shortcut: null,
  },
}

/** 단계 밖의 화면에서 보이는 안내 */
export const GUIDE_OFF_PATH_STEP: GuideStep = {
  title: '기업 찾기부터 해 보세요',
  text: '처음부터를 누르면 첫 화면으로 돌아가 회사를 찾아 비교할 수 있어요.',
  target: null,
  focus: null,
  shortcut: null,
}

export type ResultTaskId = 'financial' | 'activity' | 'text' | 'chat'

export interface ResultTask {
  id: ResultTaskId
  label: string
  text: string
  /** 이 일을 할 때 열 결과 탭(주소 ?tab=). AI 에이전트는 탭이 아니라 null */
  tab: 'financial' | 'activity' | 'text' | null
  target: GuideTarget
}

/** 결과 화면에서 해 볼 것. 보는 순서대로 둔다 */
export const RESULT_TASKS: readonly ResultTask[] = [
  {
    id: 'financial',
    label: '재무 수치',
    text: '증감액·증감률은 AI가 아니라 코드가 계산해요. 숫자를 누르면 근거가 열려요.',
    tab: 'financial',
    target: ['.tab-transition table', '.tab-transition'],
  },
  {
    id: 'activity',
    label: '공시 분석',
    text: '두 보고서 사이 회사가 한 일을 근거 문장과 함께 정리해요.',
    tab: 'activity',
    target: ['.activity', '.tab-transition'],
  },
  {
    id: 'text',
    label: '바뀐 문장',
    text: '바뀐 문장마다 이전·현재 원문을 나란히 비교해요. 목록에서 다른 줄도 눌러 보세요.',
    tab: 'text',
    target: ['.change-browser__list', '.tab-transition'],
  },
  {
    id: 'chat',
    label: 'AI 에이전트',
    text: '모르는 용어나 바뀐 이유를 물어보세요. 근거와 함께 답해요.',
    tab: null,
    target: ['.chat-launcher', '#chat-input'],
  },
]

/** 결과 화면에서 지금 보이는 것 */
export interface ResultSeen {
  /** 주소의 ?tab= 값(없으면 null) */
  tab: string | null
  chatOpen: boolean
}

/** 해 본 일을 더한다. 한 번 해 본 일은 다른 탭으로 옮겨도 해 본 것으로 둔다 */
export function withDoneTasks(done: ReadonlySet<ResultTaskId>, seen: ResultSeen): ReadonlySet<ResultTaskId> {
  const now: ResultTaskId[] = []
  if (seen.tab === 'financial') now.push('financial')
  if (seen.tab === 'activity') now.push('activity')
  // 원문 탭(바뀐 곳·원문 읽기)을 열면 첫 변경의 이전·현재 원문이 바로 보인다
  if (seen.tab === 'text' || seen.tab === 'source') now.push('text')
  if (seen.chatOpen) now.push('chat')
  if (now.every((id) => done.has(id))) return done
  return new Set([...done, ...now])
}
