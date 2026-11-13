import { Suspense, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import { Page, Skeleton } from '@/shared/ui'

/** page: 경로 하나의 화면 전체. panel: 분석 결과 탭 안에 다른 화면의 내용을 넣을 때(기업 개요·보고서 선택) */
type PageSuspenseVariant = 'page' | 'panel'

const LOADING_LABEL = '화면을 불러오고 있어요…'

/**
 * 화면 코드를 받는 동안 움직이는 바탕(AppBackdrop) 위에 화면 모양(Skeleton)을 보여 준다(#963).
 * 금방 받으면 보이지 않도록 조금 늦게 옅게 띄운다(.page-loading). 경로마다 따로 감싸 화면을 옮길 때도 보이게 한다.
 */
export function PageSuspense({ children, variant = 'page' }: { children: ReactNode; variant?: PageSuspenseVariant }) {
  return <Suspense fallback={<PageLoading variant={variant} />}>{children}</Suspense>
}

function PageLoading({ variant }: { variant: PageSuspenseVariant }) {
  return match(variant)
    .with('page', () => (
      <Page width="wide" className="page-loading">
        <Skeleton label={LOADING_LABEL} className="page-loading__head" />
        <div className="page-loading__body" aria-hidden="true">
          <Skeleton label="" shape="card" count={3} />
          <Skeleton label="" shape="block" />
        </div>
      </Page>
    ))
    .with('panel', () => <Skeleton label={LOADING_LABEL} shape="block" className="page-loading" />)
    .exhaustive()
}
