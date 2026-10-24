import { useEffect } from 'react'
import { APP_TITLE } from '@/shared/lib/pageTitle'

/**
 * 이 화면에 있는 동안 브라우저 탭 제목을 title로 둔다(title은 pageTitle로 만든 전체 제목). null이면 서비스 이름만.
 * 화면을 떠나면 서비스 이름으로 돌려 둔다. 화면을 옮길 때는 떠나는 화면의 정리가 먼저 돌고
 * 다음 화면이 제 제목을 쓰므로, 지난 화면의 제목이 남거나 되살아나지 않는다.
 */
export function useDocumentTitle(title: string | null) {
  const next = title ?? APP_TITLE
  useEffect(() => {
    document.title = next
    return () => {
      document.title = APP_TITLE
    }
  }, [next])
}
