import { match, P } from 'ts-pattern'

/** 화면을 가리고 주요 데이터를 기다리는 가장 긴 시간(#960). 넘으면 아직 불러오는 칸은 제자리에서 따로 나타난다 */
export const REVEAL_MAX_WAIT_MS = 1000

/** 보인 뒤 차례 등장(entering)을 두는 시간. 등장 시간(--motion-enter)과 몇 칸의 차례 지연(--motion-stagger)을 넉넉히 덮는다 */
export const REVEAL_ENTER_MS = 1000

/**
 * waiting: 내용을 가리고 화면 모양(Skeleton)을 보인다.
 * entering: 막 보인 참이라 구역이 차례로 떠오른다(화면 CSS가 이 동안만 차례 지연을 건다. 탭을 바꿀 때는 다시 기다리지 않게).
 * shown: 다 보였다.
 */
export type RevealPhase = 'waiting' | 'entering' | 'shown'

interface RevealProgress {
  /** 아직 응답을 기다리는 칸 수 */
  pending: number
  /** REVEAL_MAX_WAIT_MS가 지났는지 */
  timedOut: boolean
}

/** 기다리는 칸이 없거나 시간이 다 되면 보이기 시작한다. 한 번 보인 화면은 다시 가리지 않는다(다시 불러오기·더 보기에 깜빡이지 않게) */
export function nextRevealPhase(current: RevealPhase, { pending, timedOut }: RevealProgress): RevealPhase {
  return match(current)
    .with('waiting', (): RevealPhase => (timedOut || pending === 0 ? 'entering' : 'waiting'))
    .with(P.union('entering', 'shown'), (phase) => phase)
    .exhaustive()
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
