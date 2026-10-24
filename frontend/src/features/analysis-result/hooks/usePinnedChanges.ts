import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { getTextChange, type TextChangeItem } from '@/shared/api/textChanges'
import {
  PINNED_CHANGES_CHANGE_EVENT,
  PINNED_CHANGES_KEY_PREFIX,
  isPinnedChange,
  loadPinnedChanges,
  parsePinnedChanges,
  pinnedChangesKey,
  readPinnedChangesRaw,
  removePinnedChanges,
  savePinnedChanges,
  togglePinnedChange,
} from '@/shared/lib/pinnedChanges'
import { browserStorage } from '@/shared/lib/recentAnalyses'
import { initialPinnedList, isMissingChange, pinnedIdsToFetch, pinnedListReducer, pinnedView } from '../model/pinnedList'

export interface PinnedChangesController {
  /** 고정한 변경 번호(최근 고정 먼저, 최대 50) */
  ids: number[]
  isPinned: (changeId: number) => boolean
  toggle: (changeId: number) => void
  remove: (changeIds: number[]) => void
}

// useSyncExternalStore는 같은 값이면 같은 참조를 받아야 다시 그리지 않으므로, 저장된 글자가 같으면 읽은 목록을 다시 쓴다
let cache: { key: string; raw: string | null; ids: number[] } = { key: '', raw: null, ids: [] }

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PINNED_CHANGES_KEY_PREFIX)) onChange()
  }
  window.addEventListener(PINNED_CHANGES_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(PINNED_CHANGES_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * 이 분석에서 고정한 문장 변경(3.3, FS-29). 분석마다 따로 이 브라우저에만 남는다.
 * 같은 탭의 다른 곳과 다른 탭에서 바꾼 것도 따라간다. 저장을 쓸 수 없으면 빈 목록으로 지낸다.
 */
export function usePinnedChanges(analysisId: number): PinnedChangesController {
  const getIds = useCallback(() => {
    const key = pinnedChangesKey(analysisId)
    const raw = readPinnedChangesRaw(browserStorage(), analysisId)
    if (key !== cache.key || raw !== cache.raw) cache = { key, raw, ids: parsePinnedChanges(raw) }
    return cache.ids
  }, [analysisId])
  const ids = useSyncExternalStore(subscribe, getIds)

  // 다른 탭에서 바뀌었을 수 있어 저장된 값을 다시 읽어 바꾸고, 같은 탭의 다른 곳에도 알린다
  const update = useCallback(
    (change: (list: number[]) => number[]) => {
      const storage = browserStorage()
      savePinnedChanges(storage, analysisId, change(loadPinnedChanges(storage, analysisId)))
      window.dispatchEvent(new Event(PINNED_CHANGES_CHANGE_EVENT))
    },
    [analysisId],
  )
  const isPinned = useCallback((changeId: number) => isPinnedChange(ids, changeId), [ids])
  const toggle = useCallback((changeId: number) => update((list) => togglePinnedChange(list, changeId)), [update])
  const remove = useCallback((changeIds: number[]) => update((list) => removePinnedChanges(list, changeIds)), [update])
  return { ids, isPinned, toggle, remove }
}

/**
 * '고정' 보기(3.3)의 목록. 목록 API는 번호로 거를 수 없어 고정한 변경을 하나씩 근거 상세로 받는다(최대 50건).
 * 받은 항목은 남겨 두고 새로 고정한 것만 더 받는다. 이 분석에 없는 번호는 고정에서 빼 건수를 맞춘다.
 * 보기를 끄거나 언마운트하면 진행 중인 요청을 취소한다(ST-5).
 */
export function usePinnedTextChanges(analysisId: number, ids: number[], enabled: boolean, onMissing: (changeIds: number[]) => void) {
  const [state, dispatch] = useReducer(pinnedListReducer, initialPinnedList)
  const [attempt, setAttempt] = useState(0)
  // 부모가 그릴 때마다 새 함수를 넘겨도 다시 받지 않게 한다
  const missing = useRef(onMissing)
  useEffect(() => {
    missing.current = onMissing
  }, [onMissing])
  const pendingKey = enabled ? pinnedIdsToFetch(ids, state).join(',') : ''

  useEffect(() => {
    if (pendingKey === '') return
    const want = pendingKey.split(',').map(Number)
    const controller = new AbortController()
    dispatch({ type: 'fetch-start' })
    Promise.allSettled(want.map((id) => getTextChange(analysisId, id, controller.signal))).then((results) => {
      if (controller.signal.aborted) return
      const items: TextChangeItem[] = []
      const gone: number[] = []
      const errors: unknown[] = []
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') items.push(result.value.change)
        else if (isMissingChange(result.reason)) gone.push(want[i])
        else errors.push(result.reason)
      })
      dispatch(errors.length === 0 ? { type: 'fetch-success', items, gone } : { type: 'fetch-failure', items, gone, error: errors[0] })
      if (gone.length > 0) missing.current(gone)
    })
    return () => controller.abort()
  }, [analysisId, pendingKey, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { view: pinnedView(ids, state), reload }
}
