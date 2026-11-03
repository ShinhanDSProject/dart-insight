import { createContext, useCallback, useContext, useState } from 'react'
import { browserStorage } from '@/shared/lib/recentAnalyses'
import { readProfanityMask, saveProfanityMask } from '../model/profanityMask'

/** 커뮤니티 탭 안의 글·댓글 본문이 욕설 가리기 켬·끔을 함께 본다(기본 꺼짐) */
export const ProfanityMaskContext = createContext(false)

export function useProfanityMaskSetting(): boolean {
  return useContext(ProfanityMaskContext)
}

/** 욕설 가리기 켬·끔(#468). 처음 값은 이 브라우저에 남긴 값이고, 바꾸면 다시 남긴다 */
export function useProfanityMask(): [boolean, (mask: boolean) => void] {
  const [mask, setMask] = useState(() => readProfanityMask(browserStorage()))
  const change = useCallback((next: boolean) => {
    setMask(next)
    saveProfanityMask(browserStorage(), next)
  }, [])
  return [mask, change]
}
