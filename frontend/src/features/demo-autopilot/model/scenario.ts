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
  /** 대상 둘레만 밝게 남겨 강조한다. 다음 단계가 시작되면 꺼진다 */
  | { kind: 'spotlight'; target: DemoTarget }
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

export const DEMO_COMPANY = '삼성전자'
export const DEMO_QUESTION = '이번 변화를 3줄로 정리해줘'

const resultTab = (label: string): DemoTarget => ({ selector: '.result-tabs button.tabs__item', text: label, exact: true })
/** 결과 화면이 다 떠올라 핵심 3줄이 보임(PageReveal) */
const RESULT_HEADLINE: DemoTarget = { selector: '.page-reveal--entering section.headline, .page-reveal--shown section.headline' }

/**
 * 같은 보고서 쌍의 분석이 없어 새로 돌리다 실패하거나 오래 걸리면, 기업 화면으로 돌아가(비교 확인 → 진행 화면을 거슬러)
 * '이미 분석한 비교'의 가장 최근 결과를 연다. 발표가 멈추지 않게 하는 대비책이다
 */
const OPEN_PAST_ANALYSIS: DemoAction[] = [
  { kind: 'back', count: 2 },
  { kind: 'click', target: { selector: '.past-analyses a.list-link' } },
  { kind: 'wait', target: RESULT_HEADLINE, timeoutMs: 20_000 },
]

export const DEMO_SCENARIO: DemoStep[] = [
  {
    title: '기업 찾기',
    caption: '회사 이름만 넣으면 돼요. 종목코드나 초성으로도 찾아요.',
    actions: [
      { kind: 'type', target: { selector: '#company-query' }, text: DEMO_COMPANY },
      { kind: 'wait', target: { selector: 'a[data-result-index]' } },
      { kind: 'spotlight', target: { selector: '#company-search-results' } },
    ],
  },
  {
    title: '보고서 고르기',
    caption: '가장 최근 보고서와 1년 전 같은 시기 보고서를 알아서 골라 줘요.',
    actions: [
      { kind: 'click', target: { selector: 'a[data-result-index] .company-list__name', text: DEMO_COMPANY, exact: true } },
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
        target: RESULT_HEADLINE,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
        giveUpWhen: { selector: '.progress__failed' },
        otherwise: OPEN_PAST_ANALYSIS,
      },
      { kind: 'pause', ms: 900 },
      { kind: 'spotlight', target: { selector: 'section.headline' } },
    ],
  },
  {
    title: '근거 확인',
    caption: '한 줄을 누르면 계산한 값과 보고서 원문 위치가 함께 열려요.',
    actions: [
      { kind: 'click', target: { selector: 'button.headline__line' } },
      { kind: 'wait', target: { selector: '#evidence, .text-compare-dialog' } },
      { kind: 'pause', ms: 400 },
      { kind: 'spotlight', target: { selector: '#evidence, .text-compare-dialog' } },
    ],
  },
  {
    title: '재무 수치',
    caption: '모든 계정의 증감액과 증감률은 AI가 아니라 코드가 계산해요.',
    actions: [
      { kind: 'click', target: { selector: '#evidence .evidence__head button, .text-compare-dialog button[aria-label="닫기"]' }, optional: true },
      { kind: 'click', target: resultTab('재무 수치') },
      { kind: 'wait', target: { selector: 'button[id^="evidence-button-"]' } },
      { kind: 'spotlight', target: { selector: '.tab-transition table' } },
    ],
  },
  {
    title: '바뀐 문장',
    caption: '문장이 더해지고 빠지고 고쳐진 곳을 원문 위치와 함께 짚어 줘요.',
    actions: [
      { kind: 'click', target: resultTab('원문') },
      { kind: 'click', target: { selector: '.segmented__item', text: '바뀐 곳', exact: true } },
      { kind: 'click', target: { selector: 'button.change-row' } },
      { kind: 'wait', target: { selector: 'article.change-card' } },
      { kind: 'spotlight', target: { selector: 'article.change-card' } },
    ],
  },
  {
    title: 'AI 에이전트',
    caption: '궁금한 건 물어보면 돼요. 답마다 근거를 붙이고, 투자 조언은 하지 않아요.',
    actions: [
      { kind: 'click', target: { selector: '.chat-launcher' } },
      { kind: 'type', target: { selector: '#chat-input' }, text: DEMO_QUESTION },
      { kind: 'click', target: { selector: 'form.chat-panel__form button[type="submit"]' } },
      // 답이 오면 대화 묶음이 생긴다. 한도·오류로 답하지 못하면 기다리지 않고 알린다
      {
        kind: 'wait',
        target: { selector: '.chat-panel__exchange' },
        timeoutMs: CHAT_TIMEOUT_MS,
        giveUpWhen: { selector: '#chat-panel .state--error' },
        failReason: 'AI가 이번에는 답하지 못했어요.',
      },
      { kind: 'spotlight', target: { selector: '.chat-panel__exchange' } },
    ],
  },
]
