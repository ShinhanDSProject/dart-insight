/** 화면을 가리고 주요 데이터를 기다리는 가장 긴 시간(#960). 넘으면 아직 불러오는 칸은 제자리에서 따로 나타난다 */
export const REVEAL_MAX_WAIT_MS = 1000

/** waiting: 내용을 가리고 화면 모양(Skeleton)을 보인다. shown: 내용을 한 번에 보인다 */
export type RevealPhase = 'waiting' | 'shown'

interface RevealProgress {
  /** 아직 응답을 기다리는 칸 수 */
  pending: number
  /** REVEAL_MAX_WAIT_MS가 지났는지 */
  timedOut: boolean
}

/** 기다리는 칸이 없거나 시간이 다 되면 보인다. 한 번 보인 화면은 다시 가리지 않는다(다시 불러오기·더 보기에 깜빡이지 않게) */
export function nextRevealPhase(current: RevealPhase, { pending, timedOut }: RevealProgress): RevealPhase {
  return current === 'shown' || timedOut || pending === 0 ? 'shown' : 'waiting'
}

interface RevealEnvironment {
  /** <html data-intro>. 발표에서 넘어온 첫 화면(index.html의 #from-deck)이면 'skip' */
  intro: string | undefined
  /** 운영체제 '동작 줄이기' */
  reducedMotion: boolean
}

/** 발표에서 넘어온 첫 화면은 이미 끝난 모습으로 이어 받고, 동작 줄이기면 기다리지 않고 바로 보인다 */
export function shouldSkipReveal({ intro, reducedMotion }: RevealEnvironment): boolean {
  return intro === 'skip' || reducedMotion
}
