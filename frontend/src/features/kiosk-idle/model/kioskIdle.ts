/**
 * 시연 부스용 '조작이 없으면 대기 화면으로 돌아가기'(발표 11/18).
 * 대기 화면(/easter/idle.html)을 누르면 /?kiosk로 들어오고, 그 탭에서만 켜진다. 다른 방문자에게는 켜지지 않는다.
 */

/** 켜는 주소 매개변수. ?kiosk=60처럼 초를 주면 그 시간을 기다리고, ?kiosk=off면 끈다 */
export const KIOSK_PARAM = 'kiosk'
/** 켠 값(초)을 화면을 옮기거나 새로 고쳐도 이 탭에 유지하는 sessionStorage 키 */
export const KIOSK_STORAGE_KEY = 'dart-insight:kiosk'
/** 조작이 없으면 돌아갈 대기 화면 */
export const KIOSK_IDLE_PATH = '/easter/idle.html'
/** 기본 기다림. 새 분석(1~2분)을 지켜보는 동안에는 돌아가지 않을 만큼 */
export const KIOSK_DEFAULT_SECONDS = 120
/** 돌아가기 전에 안내를 보이는 시간 */
export const KIOSK_WARNING_SECONDS = 15
/** 안내를 볼 시간은 남도록 30초보다 짧게는 두지 않는다 */
const KIOSK_MIN_SECONDS = 30
const KIOSK_MAX_SECONDS = 3600

export type KioskRequest = { kind: 'none' } | { kind: 'on'; seconds: number } | { kind: 'off' }

/** 주소의 ?kiosk를 읽는다. 값이 없거나 숫자가 아니면 기본 시간이다 */
export function kioskRequest(search: string): KioskRequest {
  const params = new URLSearchParams(search)
  if (!params.has(KIOSK_PARAM)) return { kind: 'none' }
  const raw = params.get(KIOSK_PARAM)
  if (raw === 'off') return { kind: 'off' }
  return { kind: 'on', seconds: kioskSeconds(raw) ?? KIOSK_DEFAULT_SECONDS }
}

/** 기다릴 초. 정수가 아니면 null, 범위를 벗어나면 30초~1시간 안으로 맞춘다 */
export function kioskSeconds(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const seconds = Number(value)
  if (!Number.isInteger(seconds)) return null
  return Math.min(KIOSK_MAX_SECONDS, Math.max(KIOSK_MIN_SECONDS, seconds))
}

export type KioskPhase = { status: 'active' } | { status: 'warning'; secondsLeft: number } | { status: 'leave' }

/** 마지막 조작 뒤 지난 시간(ms)으로 지금 할 일을 정한다. 끝나기 KIOSK_WARNING_SECONDS 전부터 남은 초를 센다 */
export function kioskPhase(idleMs: number, limitSeconds: number): KioskPhase {
  const left = limitSeconds - idleMs / 1000
  if (left <= 0) return { status: 'leave' }
  if (left <= KIOSK_WARNING_SECONDS) return { status: 'warning', secondsLeft: Math.ceil(left) }
  return { status: 'active' }
}
