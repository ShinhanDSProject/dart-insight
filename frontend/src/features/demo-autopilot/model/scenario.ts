/**
 * 발표 시연 시나리오(#967). 단계마다 발표자가 Space를 한 번 누르고, 그 단계의 동작이 차례로 실제 화면에서 일어난다.
 * 대상은 선택자(와 글자)로 찾는다. 분석 번호·주소를 박지 않고 기업 이름부터 따라가 로컬·배포 어디서든 같은 흐름이 된다.
 * 처음 비교하는 보고서 쌍이면 분석이 1~2분 걸리므로, 발표 전에 같은 시나리오를 한 번 돌려 두면 시연에서는 바로 결과가 열린다.
 */

export interface DemoTarget {
  selector: string
  /** 요소 글자에 이 글자가 들어 있어야 한다. exact면 앞뒤 공백을 뺀 글자가 같아야 한다 */
  text?: string
  exact?: boolean
}

export type DemoAction =
  /**
   * 대상이 나타날 때까지 기다린다(기본 DEMO_TARGET_TIMEOUT_MS).
   * giveUpWhen이 보이거나 시간이 다 되면 otherwise를 대신 한다(없으면 failReason으로 단계 실패)
   */
  | {
      kind: 'wait'
      target: DemoTarget
      timeoutMs?: number
      giveUpWhen?: DemoTarget
      otherwise?: DemoAction[]
      failReason?: string
    }
  /** 브라우저 뒤로 가기를 count번 한다 */
  | { kind: 'back'; count: number }
  /** 커서를 옮겨 누른다. optional이면 대상이 없을 때 건너뛴다 */
  | { kind: 'click'; target: DemoTarget; optional?: boolean }
  /** 커서로 칸을 누르고 글자를 한 자씩 친다 */
  | { kind: 'type'; target: DemoTarget; text: string }
  /** 커서로 고르기 칸(select)을 누르고, 글자가 option으로 시작하는 항목을 고른다 */
  | { kind: 'select'; target: DemoTarget; option: string }
  /**
   * 대상 둘레만 밝게 남겨 강조한다. 다음 단계가 시작되면 꺼진다. optional이면 대상이 없을 때 건너뛴다.
   * block이 start면 대상 머리가 화면 위쪽에 오게 내린다(화면보다 긴 대상을 통째로 강조할 때)
   */
  | { kind: 'spotlight'; target: DemoTarget; optional?: boolean; block?: 'start' | 'center' }
  | { kind: 'pause'; ms: number }

export interface DemoStep {
  /** 자막 앞 굵은 이름 */
  title: string
  /** 자막. 발표자가 그대로 읽어도 되는 한두 문장 */
  caption: string
  actions: DemoAction[]
}

/** 대상을 기다리는 기본 시간 */
export const DEMO_TARGET_TIMEOUT_MS = 10_000
/** 새로 분석하게 되면 진행 화면을 보여 주며 기다리는 시간. 넘거나 실패하면 이미 끝난 분석을 연다 */
const ANALYSIS_TIMEOUT_MS = 90_000
/** AI 답을 기다리는 시간 */
const CHAT_TIMEOUT_MS = 90_000
/** 공시 분석(AI 정리)을 기다리는 시간. 처음 열면 수십 초 걸린다 */
const ACTIVITY_TIMEOUT_MS = 60_000

export const DEMO_COMPANY = '삼성전자'
/** 첫 화면 검색어. 초성만 쳐도 찾는다는 것을 보여 준다(matchRanges, ㅅㅅㅈㅈ → 삼성전자) */
export const DEMO_SEARCH = 'ㅅㅅㅈㅈ'
export const DEMO_QUESTION = '이익잉여금이 뭐야?'
/** 비교할 두 보고서. 현재 보고서를 고르면 비교 기준(전년 동기)이 이전 보고서를 찾는다 */
export const DEMO_CURRENT_REPORT = '사업보고서 (2025.12)'
export const DEMO_PREVIOUS_REPORT = '사업보고서 (2024.12)'
/** 원문 비교로 열 바뀐 곳: 변경 유형(수정)과 섹션으로 시작하는 줄 */
export const DEMO_TEXT_CHANGE = '수정II. 사업의 내용 > 7. 기타 참고사항'

/** 채팅의 마지막 대화 묶음(기다리는 표시가 없을 때). 앞서 나눈 대화가 있어도 새 답을 기다린다 */
const LATEST_ANSWER_SELECTOR = '#chat-panel:not(:has(.chat-panel__pending)) .chat-panel__exchange:last-of-type'
const LATEST_ANSWER: DemoTarget = { selector: LATEST_ANSWER_SELECTOR }

/** 공시 분석 정리가 끝난 화면. 오류 화면도 불러오는 그림이 없으므로 따로 뺀다(실행기는 대상을 포기 조건보다 먼저 본다) */
export const ACTIVITY_DONE: DemoTarget = { selector: '.activity:not(:has(.activity-loading)):not(:has(.state--error))' }
const resultTab = (label: string): DemoTarget => ({ selector: '.result-tabs button.tabs__item', text: label, exact: true })
/** 결과 화면이 다 떠오름(PageReveal). 핵심 줄이 없는 분석도 있어 핵심 3줄이 아니라 결과 화면을 기다린다 */
const RESULT_PAGE: DemoTarget = { selector: '.page-reveal--entering .result-page, .page-reveal--shown .result-page' }

/**
 * 같은 보고서 쌍의 분석이 없어 새로 돌리다 실패하거나 오래 걸리면, 기업 화면으로 돌아가(비교 확인 → 진행 화면을 거슬러)
 * '이미 분석한 비교'의 가장 최근 결과를 연다. 발표가 멈추지 않게 하는 대비책이다
 */
const OPEN_PAST_ANALYSIS: DemoAction[] = [
  { kind: 'back', count: 2 },
  { kind: 'click', target: { selector: '.past-analyses a.list-link' } },
  { kind: 'wait', target: RESULT_PAGE, timeoutMs: 20_000 },
]

export const DEMO_SCENARIO: DemoStep[] = [
  {
    title: '기업 찾기',
    caption: '회사 이름을 다 치지 않아도 돼요. 초성 ㅅㅅㅈㅈ만 쳐도 삼성전자가 나와요.',
    actions: [
      { kind: 'type', target: { selector: '#company-query' }, text: DEMO_SEARCH },
      { kind: 'wait', target: { selector: 'a[data-result-index]' } },
      { kind: 'spotlight', target: { selector: '#company-search-results' } },
    ],
  },
  {
    title: '보고서 고르기',
    caption: '현재 보고서만 고르면 1년 전 같은 시기 보고서를 알아서 짝지어 줘요. 2025년 사업보고서와 2024년 사업보고서를 비교해요.',
    actions: [
      { kind: 'click', target: { selector: 'a[data-result-index] .company-list__name', text: DEMO_COMPANY, exact: true } },
      { kind: 'select', target: { selector: '#pair-current' }, option: DEMO_CURRENT_REPORT },
      // 전년 동기 보고서를 찾아 위 요약에 두 보고서가 다 보이면 고른 것이다
      { kind: 'wait', target: { selector: 'section.pick-summary', text: DEMO_PREVIOUS_REPORT } },
      { kind: 'wait', target: { selector: 'section.pick-summary .pick-summary__actions a.button--primary' } },
      { kind: 'spotlight', target: { selector: 'section.pick-summary' } },
    ],
  },
  {
    title: '비교할 수 있는지 확인',
    caption: '두 보고서의 기간과 재무제표가 맞는지 먼저 확인하고, 맞지 않으면 분석하지 않아요.',
    actions: [
      { kind: 'click', target: { selector: 'section.pick-summary .pick-summary__actions a.button--primary' } },
      { kind: 'wait', target: { selector: '.compare-actions button.button--primary', text: '분석 실행', exact: true } },
      { kind: 'spotlight', target: { selector: '.check-notice' } },
    ],
  },
  {
    title: '핵심 3줄',
    caption: '바뀐 숫자와 문장 중 중요한 것을 3줄로 먼저 보여 줘요. 줄마다 근거가 붙어 있어요.',
    actions: [
      { kind: 'click', target: { selector: '.compare-actions button.button--primary', text: '분석 실행', exact: true } },
      {
        kind: 'wait',
        target: RESULT_PAGE,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
        giveUpWhen: { selector: '.progress__failed' },
        otherwise: OPEN_PAST_ANALYSIS,
      },
      { kind: 'pause', ms: 900 },
      { kind: 'spotlight', target: { selector: 'section.headline' }, optional: true },
    ],
  },
  {
    title: '재무 수치',
    caption: '모든 계정의 증감액과 증감률은 AI가 아니라 코드가 계산해요.',
    actions: [
      { kind: 'click', target: resultTab('재무 수치') },
      { kind: 'wait', target: { selector: 'button[id^="evidence-button-"]' } },
      { kind: 'spotlight', target: { selector: '.tab-transition table' } },
    ],
  },
  {
    title: 'AI 에이전트',
    caption: '표를 보다 모르는 용어가 나오면 물어보면 돼요. 쉬운 말로 풀고 이 회사 숫자도 근거와 함께 보여 주며, 투자 조언은 하지 않아요.',
    actions: [
      // 이익잉여금이 있는 재무상태표를 펴 두고 묻는다
      { kind: 'click', target: resultTab('재무 수치') },
      { kind: 'click', target: { selector: '.fin-bar__statements button', text: '재무상태표', exact: true }, optional: true },
      { kind: 'pause', ms: 500 },
      { kind: 'click', target: { selector: '.chat-launcher' } },
      { kind: 'type', target: { selector: '#chat-input' }, text: DEMO_QUESTION },
      { kind: 'click', target: { selector: 'form.chat-panel__form button[type="submit"]' } },
      // 기다리는 표시가 사라지고 마지막 대화 묶음이 생기면 답이 온 것이다. 한도·오류로 답하지 못하면 기다리지 않고 알린다
      {
        kind: 'wait',
        target: LATEST_ANSWER,
        timeoutMs: CHAT_TIMEOUT_MS,
        giveUpWhen: { selector: '#chat-panel .state--error' },
        failReason: 'AI가 이번에는 답하지 못했어요.',
      },
      { kind: 'spotlight', target: LATEST_ANSWER },
    ],
  },
  {
    title: '공시 분석 · 한 문단 요약',
    caption: '두 보고서 사이 1년 동안 회사가 한 일을 한 문단으로 먼저 요약해요. 원문 근거로 확인하지 못한 요약은 보여 주지 않아요.',
    actions: [
      { kind: 'click', target: { selector: '.chat-panel__head button', text: '닫기' }, optional: true },
      { kind: 'click', target: resultTab('공시 분석') },
      // 불러오는 그림이 사라지면 정리가 끝난 것이다(활동 카드·검토 필요·활동 없음 모두). 오류 화면은 끝으로 치지 않고 알린다
      {
        kind: 'wait',
        target: ACTIVITY_DONE,
        timeoutMs: ACTIVITY_TIMEOUT_MS,
        giveUpWhen: { selector: '.activity .state--error' },
        failReason: '공시 분석을 이번에는 불러오지 못했어요.',
      },
      { kind: 'pause', ms: 600 },
      // 요약이 원문 근거로 확인되지 않으면 '검토 필요' 자리가 대신 보인다
      { kind: 'spotlight', target: { selector: '.activity__overview, .activity__overview-missing' }, optional: true },
    ],
  },
  {
    title: '공시 분석 · 이 기간 타임라인',
    caption: '그사이 나온 공시를 날짜순으로 모았어요. 줄마다 언제 무엇을 했는지와 그 공시 원문 링크가 붙어 있어요.',
    actions: [
      // 타임라인을 펼쳐 통째로 강조한다. 화면보다 길어 머리가 위쪽에 오게 내린다
      { kind: 'click', target: { selector: '.activity__timeline-details:not([open]) .activity__timeline-summary' }, optional: true },
      { kind: 'pause', ms: 400 },
      { kind: 'spotlight', target: { selector: '.activity__timeline-wrap' }, optional: true, block: 'start' },
    ],
  },
  {
    title: '공시 분석 · 이 기간에 한 일',
    caption: '눈여겨볼 활동만 골라 카드로 보여 줘요. 공시에 적힌 사실과 AI 전망은 따로 표시해요.',
    actions: [
      // 펼친 타임라인을 접어 활동 목록까지 조금만 내려가게 한다
      { kind: 'click', target: { selector: '.activity__timeline-details[open] .activity__timeline-summary' }, optional: true },
      { kind: 'pause', ms: 400 },
      { kind: 'spotlight', target: { selector: '.activity__list .activity-card' }, optional: true },
    ],
  },
  {
    title: '원문 비교',
    caption: '바뀐 곳을 우선순위 순으로 보고, 한 줄을 열어 이전·현재 보고서 문단을 나란히 비교해요. 바뀐 낱말에 밑줄을 그어요.',
    actions: [
      { kind: 'click', target: resultTab('원문') },
      { kind: 'click', target: { selector: '.segmented__item', text: '바뀐 곳', exact: true } },
      { kind: 'select', target: { selector: 'select.text-filterbar__sort' }, option: '우선순위 순' },
      { kind: 'wait', target: { selector: 'button.change-row' } },
      // 우선순위 순 첫 10줄 다음에 있는 '사업의 내용' 수정 문단을 연다
      { kind: 'click', target: { selector: '.change-list__more button' } },
      { kind: 'click', target: { selector: 'button.change-row', text: DEMO_TEXT_CHANGE } },
      { kind: 'wait', target: { selector: 'article.change-card' } },
      { kind: 'click', target: { selector: 'article.change-card button', text: '원문 비교', exact: true } },
      { kind: 'wait', target: { selector: '.text-compare-dialog' } },
      { kind: 'pause', ms: 500 },
      { kind: 'spotlight', target: { selector: '.text-compare-dialog' } },
    ],
  },
]
