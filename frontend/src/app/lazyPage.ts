import { lazy, type ComponentType } from 'react'

/** 화면 코드(청크)를 받지 못했을 때(배포 뒤 옛 파일, 연결 끊김) 던지는 오류. RouteError가 '다시 시도'를 보여 준다. */
export class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super('화면 코드를 불러오지 못했어요.', { cause })
    this.name = 'ChunkLoadError'
  }
}

/**
 * 화면을 처음 열 때 코드를 받아 오는 컴포넌트를 만든다(React.lazy).
 * 화면은 named export라서 import 결과에서 컴포넌트를 골라 넘긴다: lazyPage(() => import('...').then((m) => m.SearchPage))
 * 받는 동안은 PageSuspense가 로딩 표시를 보여 준다.
 */
export function lazyPage(load: () => Promise<ComponentType>) {
  return lazy(() =>
    load().then(
      (Page) => ({ default: Page }),
      (cause: unknown) => {
        throw new ChunkLoadError(cause)
      },
    ),
  )
}
