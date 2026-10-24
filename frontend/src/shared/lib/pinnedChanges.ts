/**
 * 고정한 문장 변경(3.3, FS-29). 분석마다 따로, 이 브라우저(localStorage)에만 변경 번호(changeId)를 남긴다. 서버에는 보내지 않는다.
 * 저장을 쓸 수 없으면 조용히 빈 목록으로 지내고 화면은 그대로 동작한다.
 */

export const PINNED_CHANGES_KEY_PREFIX = 'dart-insight:pinned-text-changes:'
export const PINNED_CHANGES_LIMIT = 50
/** 같은 탭 안에서 고정·해제를 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const PINNED_CHANGES_CHANGE_EVENT = 'dart-insight:pinned-text-changes-change'

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type PinnedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 분석 하나의 저장 키. 분석마다 키가 달라 다른 분석의 고정이 섞이지 않는다 */
export function pinnedChangesKey(analysisId: number): string {
  return `${PINNED_CHANGES_KEY_PREFIX}${analysisId}`
}

function isChangeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** 저장된 글자를 목록(최근 고정 먼저)으로 읽는다. 깨진 값이면 빈 목록, 양의 정수가 아닌 값·중복은 버리고 50개까지만 둔다 */
export function parsePinnedChanges(raw: string | null): number[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const list: number[] = []
  for (const item of parsed) {
    if (isChangeId(item) && !list.includes(item)) list.push(item)
  }
  return list.slice(0, PINNED_CHANGES_LIMIT)
}

export function isPinnedChange(list: number[], changeId: number): boolean {
  return list.includes(changeId)
}

/** 고정했으면 풀고, 아니면 맨 앞에 더한다. 50개를 넘으면 가장 먼저 고정한 것을 버린다 */
export function togglePinnedChange(list: number[], changeId: number): number[] {
  return isPinnedChange(list, changeId)
    ? list.filter((id) => id !== changeId)
    : [changeId, ...list].slice(0, PINNED_CHANGES_LIMIT)
}

/** 고른 변경들을 뺀다(이 분석에 없는 항목으로 확인된 것 등) */
export function removePinnedChanges(list: number[], changeIds: number[]): number[] {
  return list.filter((id) => !changeIds.includes(id))
}

/** 저장된 글자를 그대로 읽는다. 저장소가 없거나 읽다가 예외가 나면 null(빈 목록) */
export function readPinnedChangesRaw(storage: PinnedStorage | null, analysisId: number): string | null {
  if (storage === null) return null
  try {
    return storage.getItem(pinnedChangesKey(analysisId))
  } catch {
    return null
  }
}

export function loadPinnedChanges(storage: PinnedStorage | null, analysisId: number): number[] {
  return parsePinnedChanges(readPinnedChangesRaw(storage, analysisId))
}

/** 목록을 저장한다. 비었으면 키를 지운다. 저장하지 못하면(용량·권한) 그냥 넘어간다 */
export function savePinnedChanges(storage: PinnedStorage | null, analysisId: number, list: number[]): void {
  if (storage === null) return
  try {
    if (list.length === 0) {
      storage.removeItem(pinnedChangesKey(analysisId))
    } else {
      storage.setItem(pinnedChangesKey(analysisId), JSON.stringify(list))
    }
  } catch {
    // 저장을 쓸 수 없는 브라우저에서는 고정만 남지 않고 나머지는 그대로 둔다(FS-29)
  }
}
