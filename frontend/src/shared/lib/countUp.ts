/** 큰 숫자 count-up(FS-58)의 순수 계산. 화면 값은 응답 값을 그대로 쓰고, 여기서는 움직이는 동안의 중간 값만 정한다. */

/** 기본 시간(ms). 토큰 --motion-count를 읽지 못할 때 쓴다 */
export const DEFAULT_COUNT_UP_MS = 600

/** 3차 ease-out. 0 → 0, 1 → 1, 처음에 빠르고 끝에서 느려진다. 범위 밖은 0·1로 자른다 */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 3
}

/**
 * 시작 값에서 목표 값까지 elapsed(ms)만큼 지난 때의 값. 시간이 다 되면(또는 duration이 0 이하면) 정확히 목표 값이다.
 * 중간 값은 반올림하지 않는다(보여 줄 때 format 함수가 자릿수를 정한다).
 */
export function countUpValue(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to
  return from + (to - from) * easeOutCubic(elapsed / duration)
}

/** CSS 시간 값(예: '600ms', '0.6s')을 ms로. 읽을 수 없으면 null */
export function parseDurationMs(value: string): number | null {
  const found = /^\s*(-?[\d.]+)\s*(ms|s)\s*$/.exec(value)
  if (!found) return null
  const amount = Number(found[1])
  if (!Number.isFinite(amount) || amount < 0) return null
  return found[2] === 's' ? amount * 1000 : amount
}
