import { useEffect, useState } from 'react'

/** 화면을 px보다 아래로 내렸는지(#396). '맨 위로' 버튼을 언제 보일지 정한다. 스크롤마다 다시 그리지 않도록 값이 바뀔 때만 바꾼다 */
export function useScrolledPast(px: number): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const update = () => setPast(window.scrollY > px)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [px])
  return past
}
