import { useEffect, useRef, useState } from 'react'
import { ACCOUNT_SEARCH_DEBOUNCE_MS, accountQueryOf } from '../model/accountFilter'

/**
 * 재무 표 계정 찾기 입력창(FS-14). 입력은 화면 상태로 두고, 입력을 멈추면(ACCOUNT_SEARCH_DEBOUNCE_MS) 주소의 fq로 올린다(ST-6).
 * 주소의 검색어가 밖에서 바뀌면(검색어 지우기, 다른 탭에서 옮겨 오기) 입력창도 맞춘다.
 */
export function useAccountSearch(q: string | null, onCommit: (q: string | null) => void) {
  const [input, setInput] = useState(q ?? '')
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    if (accountQueryOf(input) !== q) setInput(q ?? '')
  }

  // 부모가 그릴 때마다 새 함수를 넘겨도 기다리는 시간이 다시 시작되지 않게 한다
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  }, [onCommit])

  const target = accountQueryOf(input)
  useEffect(() => {
    if (target === q) return
    const timer = setTimeout(() => commit.current(target), ACCOUNT_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [target, q])

  /** 입력창과 주소를 함께 바로 비운다 */
  const clear = () => {
    setInput('')
    if (q !== null) commit.current(null)
  }

  return { input, setInput, clear }
}
