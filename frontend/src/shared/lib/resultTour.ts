/**
 * 결과 화면 첫 방문 둘러보기(#842). 끝냈거나 건너뛴 표시만 브라우저(localStorage)에 남긴다.
 * 저장을 쓸 수 없으면 null로 돌려, 화면이 이번 방문 동안만 기억하게 한다(첫 화면 사용법 안내 onboarding.ts와 같은 방식).
 */
export const RESULT_TOUR_SEEN_KEY = 'dart-insight:result-tour-seen'
/** 같은 탭 안에서 끝내기·다시 보기를 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const RESULT_TOUR_CHANGE_EVENT = 'dart-insight:result-tour-change'

export type ResultTourStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 저장된 값이 '1'이면 본 것이다. 저장소가 없거나 읽다가 예외가 나면 모른다는 뜻으로 null */
export function readResultTourSeen(storage: ResultTourStorage | null): boolean | null {
  if (storage === null) return null
  try {
    return storage.getItem(RESULT_TOUR_SEEN_KEY) === '1'
  } catch {
    return null
  }
}

/** 보면 '1'을 남기고, 다시 보기면 지운다. 저장소가 없거나 실패하면 조용히 넘어간다 */
export function saveResultTourSeen(storage: ResultTourStorage | null, seen: boolean): void {
  if (storage === null) return
  try {
    if (seen) {
      storage.setItem(RESULT_TOUR_SEEN_KEY, '1')
    } else {
      storage.removeItem(RESULT_TOUR_SEEN_KEY)
    }
  } catch {
    // 저장하지 못해도 이번 방문 동안은 화면이 기억한다
  }
}

/**
 * 봤는지 정한다. 이번 방문에 끝내거나 다시 보기를 눌렀으면(session) 그 값을 먼저 쓴다.
 * 저장소를 읽을 수는 있지만 쓰기가 실패하면(용량 초과 등) 저장된 값이 바뀌지 않아도 둘러보기를 닫고 열 수 있게 하기 위해서다
 */
export function resultTourSeen(session: boolean | null, stored: boolean | null): boolean {
  return session ?? stored ?? false
}

export type ResultTourTab = 'summary' | 'activity'

export interface ResultTourStep {
  title: string
  text: string
  /** 이 단계를 볼 때 열 탭. 없으면 탭을 바꾸지 않는다 */
  tab: ResultTourTab | null
}

/** 보는 순서: 요약 → 공시 분석 → AI 에이전트 */
export const RESULT_TOUR_STEPS: readonly ResultTourStep[] = [
  { title: '요약부터 보세요', text: '크게 바뀐 숫자와 문장을 먼저 보여 줘요. 줄을 누르면 근거가 열려요.', tab: 'summary' },
  {
    title: '공시 분석에서 그사이 한 일을 보세요',
    text: '두 보고서 사이에 회사가 한 일과 앞으로의 영향을 근거 문장과 함께 보여 줘요. 바뀐 문장 전체는 원문 탭의 바뀐 곳에 있어요.',
    tab: 'activity',
  },
  { title: '궁금하면 AI 에이전트에게 물어보세요', text: '어려운 용어나 바뀐 이유를 물으면 근거와 함께 답해요.', tab: null },
]
