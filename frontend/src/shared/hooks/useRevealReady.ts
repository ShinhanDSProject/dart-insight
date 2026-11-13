import { createContext, useContext, useId, useLayoutEffect } from 'react'

type RevealReport = (id: string, settled: boolean) => void

/** PageReveal이 안의 칸들에게 준비 여부를 받는 통로(#960) */
export const PageRevealContext = createContext<RevealReport | null>(null)

/**
 * PageReveal 안의 칸이 주요 데이터가 응답했는지(성공·오류·빈 결과면 true) 알린다.
 * 그려지기 전에 알려야 이미 받아 둔 데이터일 때 화면 모양이 한 번도 보이지 않으므로 layout effect로 알린다.
 * PageReveal 밖에서 부르면 아무 일도 하지 않는다.
 */
export function useRevealReady(settled: boolean) {
  const report = useContext(PageRevealContext)
  const id = useId()
  useLayoutEffect(() => {
    report?.(id, settled)
  }, [report, id, settled])
  // 칸이 사라지면 더 기다리지 않는다
  useLayoutEffect(() => () => report?.(id, true), [report, id])
}
