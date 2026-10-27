import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { FsDiv } from '@/shared/api/financialTrends'
import { loadCompanyColumn } from '../api'
import { loadKey, loadsReducer, type LoadsState } from '../model/companyComparison'

const EMPTY: LoadsState = {}

/**
 * 고른 기업마다 주요 재무 흐름을 나란히(동시에) 부른다(ST-4·5).
 * 기업마다 AbortController를 두고, 빠진 기업·바뀐 기준의 요청과 화면을 떠날 때 남은 요청을 취소한다.
 * 이미 받은 기업은 다시 부르지 않고, retry는 그 기업 하나만 다시 부른다.
 */
export function useCompanyComparison(corps: readonly string[], fsDiv: FsDiv) {
  const [loads, dispatch] = useReducer(loadsReducer, EMPTY)
  const controllers = useRef(new Map<string, AbortController>())

  const start = useCallback((corpCode: string, div: FsDiv) => {
    const key = loadKey(corpCode, div)
    controllers.current.get(key)?.abort()
    const controller = new AbortController()
    controllers.current.set(key, controller)
    dispatch({ type: 'start', key })
    void loadCompanyColumn(corpCode, div, controller.signal).then((load) => {
      if (controller.signal.aborted) return
      controllers.current.delete(key)
      dispatch({ type: 'settle', key, load })
    })
  }, [])

  const corpsKey = corps.join(',')
  useEffect(() => {
    const wanted = corpsKey === '' ? [] : corpsKey.split(',')
    const wantedKeys = new Set(wanted.map((corpCode) => loadKey(corpCode, fsDiv)))
    const stale = [...controllers.current.keys()].filter((key) => !wantedKeys.has(key))
    stale.forEach((key) => {
      controllers.current.get(key)?.abort()
      controllers.current.delete(key)
    })
    if (stale.length > 0) dispatch({ type: 'drop', keys: stale })
    wanted.forEach((corpCode) => {
      const key = loadKey(corpCode, fsDiv)
      const current = loads[key]
      const settled = current !== undefined && current.status !== 'loading'
      if (!settled && !controllers.current.has(key)) start(corpCode, fsDiv)
    })
  }, [corpsKey, fsDiv, loads, start])

  useEffect(() => {
    const map = controllers.current
    return () => {
      map.forEach((controller) => controller.abort())
      map.clear()
    }
  }, [])

  const retry = useCallback((corpCode: string) => start(corpCode, fsDiv), [start, fsDiv])
  return { loads, retry }
}
