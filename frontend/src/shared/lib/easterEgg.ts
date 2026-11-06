import { isEditableTarget, type ShortcutTarget } from './shortcuts'

/** 숨은 페이지(#753). 멘토링 때 만든 팀의 3주 기록을 public/에 정적 파일로 둔다 */
export const EASTER_EGG_PATH = '/easter/three-weeks.html'

/** 코나미 코드: ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI_KEYS = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const

export interface EasterEggKey {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: ShortcutTarget | null
}

/**
 * 지금까지 맞춘 개수(step)에 키 하나를 더한 다음 개수. 끝까지 맞추면 KONAMI_KEYS.length를 돌려준다.
 * 입력창에서 누른 키·조합키는 세지 않고 처음부터 다시 센다. 틀린 키가 첫 키와 같으면 1부터 센다(↑↑↑ 다음에도 이어지게).
 */
export function nextKonamiStep(step: number, event: EasterEggKey): number {
  if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) return 0
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (key === KONAMI_KEYS[step]) return step + 1
  if (step === 2 && key === KONAMI_KEYS[0]) return 2
  return key === KONAMI_KEYS[0] ? 1 : 0
}
