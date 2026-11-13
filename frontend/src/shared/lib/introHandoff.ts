// 발표 페이지(easter/three-weeks.html)의 시연 전환이 이 앱의 첫 화면으로 넘어올 때 쓰는 약속.
// 장면 속에 미리 그려 둔 첫 화면과 이어지도록, 막 넘어온 직후에는 등장 움직임을 다시 재생하지 않고
// 바탕 점 격자는 장면 속과 같은 위치에서 이어 흐르게 한다. 값은 같은 탭의 sessionStorage로 넘긴다.
export const INTRO_HANDOFF_KEY = 'dart-insight:intro-handoff'

/** 발표 페이지가 값을 적은 뒤 이 시간 안에 열린 첫 화면만 이어 받는다. */
export const INTRO_HANDOFF_MAX_AGE_MS = 15_000

export type IntroHandoff = { driftMs: number }

/** 저장된 값을 읽어, 막 넘어온 경우에만 바탕 흐름 위치(ms)를 돌려준다. 아니면 null. */
export function parseIntroHandoff(raw: string | null, now: number): IntroHandoff | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const { at, driftMs } = value as { at?: unknown; driftMs?: unknown }
  if (typeof at !== 'number' || now < at || now - at > INTRO_HANDOFF_MAX_AGE_MS) return null
  return { driftMs: typeof driftMs === 'number' && Number.isFinite(driftMs) && driftMs > 0 ? driftMs : 0 }
}
