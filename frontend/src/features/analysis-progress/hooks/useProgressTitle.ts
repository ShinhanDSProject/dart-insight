import { useEffect, useRef } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import { progressTitle } from '../model/notification'

/** 진행 화면에 있는 동안 탭 제목에 분석 상태를 보이고, 화면을 떠나면 원래 제목으로 돌린다(4.3) */
export function useProgressTitle(analysis: Analysis | null) {
  const baseTitle = useRef(document.title)

  useEffect(() => {
    const original = baseTitle.current
    return () => {
      document.title = original
    }
  }, [])

  const title = progressTitle(analysis, baseTitle.current)
  useEffect(() => {
    document.title = title
  }, [title])
}
