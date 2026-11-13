// 발표 페이지(easter/three-weeks.html)의 시연 전환이 이 앱의 첫 화면으로 넘어올 때 쓰는 약속.
// 바탕 점 격자가 장면 속 첫 화면과 같은 위치에서 이어 흐르도록, 넘어가기 직전의 흐름 위치를 같은 탭의 sessionStorage로 넘긴다.
// 등장 움직임을 건너뛰는 일은 index.html의 #from-deck 처리(data-intro="skip")가 맡는다.
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
