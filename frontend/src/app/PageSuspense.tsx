import { Suspense, type ReactNode } from 'react'
import { LoadingState } from '@/shared/ui/StateView'

/** 화면 코드를 받는 동안 로딩 표시를 보여 준다. 경로마다 따로 감싸 화면을 옮길 때도 표시가 보이게 한다. */
export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState message="화면을 불러오고 있어요…" />}>{children}</Suspense>
}
