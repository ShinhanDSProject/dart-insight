import { useEffect, useRef, useState } from 'react'
import { parseTextSearch, SEARCH_DEBOUNCE_MS, searchQueryOf } from '../model/textFilter'

/**
 * 문장 검색창(3.7). 입력은 화면 상태로 두고, 입력을 멈추면(SEARCH_DEBOUNCE_MS) 주소의 검색어(q)로 올린다(ST-6).
 * 2자보다 짧으면 검색을 풀고 안내한다. 주소의 q가 밖에서 바뀌면(조건 지우기 등) 입력창도 맞춘다.
 */
export function useTextSearch(q: string | null, onCommit: (q: string | null) => void) {
  const [input, setInput] = useState(q ?? '')
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    if (searchQueryOf(input) !== q) setInput(q ?? '')
  }

  // 부모가 그릴 때마다 새 함수를 넘겨도 기다리는 시간이 다시 시작되지 않게 한다
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  }, [onCommit])

  const target = searchQueryOf(input)
  useEffect(() => {
    if (target === q) return
    const timer = setTimeout(() => commit.current(target), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [target, q])

  return { input, setInput, search: parseTextSearch(input) }
}
