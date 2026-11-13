/** 시연 모드를 켜는 주소 매개변수(?demo). 발표 마지막 장이 /?demo#from-deck으로 넘어온다 */
export const DEMO_PARAM = 'demo'
/** 켠 시연 모드를 화면을 옮기거나 새로 고쳐도 유지하는 sessionStorage 키 */
export const DEMO_STORAGE_KEY = 'dart-insight:demo'
/**
 * 발표 페이지 안(전환 장면의 iframe)에서 시연했으면 마칠 때 발표 페이지에 보내는 메시지(#972).
 * 발표 페이지가 같은 문서에서 Q&A 장을 열어 전체화면이 유지된다
 */
export const DEMO_DONE_MESSAGE = 'dart-insight:demo-done'
/** 앱을 따로 열어 시연했으면 마치고 돌아갈 발표 페이지의 Q&A 장. #from-demo면 발표 페이지가 노트북이 닫히는 움직임으로 맞는다 */
export const DEMO_RETURN_PATH = '/easter/three-weeks.html?slide=qa#from-demo'
/** 앱 화면이 빛 한 점으로 닫히는 시간. demo-autopilot.css의 demo-close와 같다 */
export const DEMO_LEAVE_MS = 900

/** 다음에 실행할 단계(0부터). 화면이 통째로 새로 불려도 이어서 진행한다 */
export const DEMO_NEXT_STEP_KEY = 'dart-insight:demo-next'

/**
 * 시작할 단계(0부터). ?demo=5처럼 단계 번호(1부터)를 주면 그 단계부터, 아니면 이 탭에 남긴 다음 단계부터(새로 고침 뒤 이어 가기),
 * 둘 다 없거나 잘못된 값이면 처음부터다.
 */
export function demoStartStep(search: string, storedNext: string | null, total: number): number {
  const asked = Number(new URLSearchParams(search).get(DEMO_PARAM))
  if (Number.isInteger(asked) && asked >= 1 && asked <= total) return asked - 1
  const stored = Number(storedNext ?? '')
  return storedNext !== null && Number.isInteger(stored) && stored >= 0 && stored < total ? stored : 0
}

/** 주소에 ?demo가 있거나 이 탭에서 이미 켰으면 시연 모드다 */
export function isDemoRequested(search: string, stored: string | null): boolean {
  return new URLSearchParams(search).has(DEMO_PARAM) || stored === 'on'
}
