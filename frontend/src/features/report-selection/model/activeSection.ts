/**
 * 기업 개요 바로 가기 바의 '지금 위치'를 정하는 규칙(#434).
 * 바로 가기 바 바로 아래 기준선(line)을 이미 지난 영역 가운데 가장 아래에 있는 영역이 지금 위치다.
 * 위치가 같으면(나란히 놓인 AI 브리핑 | 기업 개황) 사용자가 바로 가기에서 누른 영역(preferred), 없으면 앞 영역.
 * 아직 아무 영역도 기준선을 지나지 않았으면 첫 영역.
 * 화면 끝까지 내렸으면, 짧아서 기준선에 닿지 못하는 마지막 영역들도 고를 수 있게 화면 안에 보이는 마지막 영역을 고른다.
 */
export interface SectionTop {
  id: string
  /** 화면 위 끝에서 영역 위 끝까지(px, getBoundingClientRect().top) */
  top: number
}

export function pickActiveSection(
  sections: readonly SectionTop[],
  line: number,
  atBottom: boolean,
  viewportHeight: number,
  preferred: string | null = null,
): string | null {
  if (sections.length === 0) return null
  if (atBottom) {
    const visible = sections.filter((s) => s.top < viewportHeight)
    const last = visible.reduce<SectionTop | null>((best, s) => (best === null || s.top > best.top ? s : best), null)
    if (last) return last.id
  }
  const passed = sections.filter((s) => s.top <= line)
  const candidates = passed.length === 0 ? [sections[0]] : passed
  const best = candidates.reduce((a, s) => (s.top > a.top ? s : a))
  const tied = candidates.filter((s) => Math.abs(s.top - best.top) <= SAME_ROW_PX)
  return tied.find((s) => s.id === preferred)?.id ?? tied[0].id
}

/** 이 정도 차이면 같은 줄(나란히 놓인 영역)로 본다 */
const SAME_ROW_PX = 2
