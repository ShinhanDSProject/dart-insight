export interface RevealInput {
  /** 가로로 스크롤되는 줄의 지금 scrollLeft */
  scrollLeft: number
  /** 줄에서 보이는 너비(clientWidth) */
  viewWidth: number
  /** 보여야 할 항목의 시작 위치(줄 내용 기준) */
  start: number
  /** 항목의 너비 */
  size: number
  /** 양쪽 끝에서 비워 둘 너비(흐림 처리에 가리지 않도록) */
  inset: number
}

/**
 * 가로 스크롤 줄에서 항목이 다 보이도록 옮길 scrollLeft. 이미 다 보이면 null(움직이지 않음).
 * 항목이 보이는 너비보다 넓으면 시작이 보이도록 맞춘다.
 */
export function revealScrollLeft({ scrollLeft, viewWidth, start, size, inset }: RevealInput): number | null {
  const from = start - inset
  const to = start + size + inset
  if (from < scrollLeft || to - from > viewWidth) return Math.max(0, from)
  if (to > scrollLeft + viewWidth) return to - viewWidth
  return null
}
