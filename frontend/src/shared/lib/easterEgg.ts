import { isEditableTarget, type ShortcutTarget } from './shortcuts'

/** 숨은 페이지(#753). 멘토링 때 만든 팀의 3주 기록을 public/에 정적 파일로 둔다 */
export const EASTER_EGG_PATH = '/easter/three-weeks.html'

/** Shift를 두 번 누르는 사이의 최대 간격(ms, #755) */
export const DOUBLE_SHIFT_MS = 400

export interface EasterEggKey {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  repeat: boolean
  target: ShortcutTarget | null
}

/**
 * 키 하나를 받아 다음 상태를 정한다. lastShiftAt은 바로 앞에 누른 Shift의 시각(없으면 null)이다.
 * Shift를 DOUBLE_SHIFT_MS 안에 두 번 누르면 found. 사이에 다른 키, 입력창, 조합키, 누르고 있는 반복이 끼면 처음부터 센다.
 */
export function nextShiftTap(lastShiftAt: number | null, event: EasterEggKey, now: number): { lastShiftAt: number | null; found: boolean } {
  if (event.key !== 'Shift' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
    return { lastShiftAt: null, found: false }
  }
  if (lastShiftAt !== null && now - lastShiftAt <= DOUBLE_SHIFT_MS) return { lastShiftAt: null, found: true }
  return { lastShiftAt: now, found: false }
}
