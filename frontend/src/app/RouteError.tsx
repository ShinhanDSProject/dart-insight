import { isRouteErrorResponse, useRouteError } from 'react-router'
import { match, P } from 'ts-pattern'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Page, PageHeader } from '@/shared/ui/PageHeader'
import { AlertState } from '@/shared/ui/StateView'
import { ChunkLoadError } from './lazyPage'

type RouteErrorKind = 'not-found' | 'chunk' | 'unknown'

/** 화면에서 예상하지 못한 오류가 나면 기본 오류 화면 대신 보여 준다. */
export function RouteError() {
  const kind = routeErrorKind(useRouteError())
  const home = (
    <ButtonLink to="/" variant="secondary">
      기업 검색으로 돌아가기
    </ButtonLink>
  )
  return (
    <Page>
      {match(kind)
        .with('not-found', () => (
          <>
            <PageHeader title="페이지를 찾을 수 없어요" />
            <AlertState title="주소를 확인해 주세요.">{home}</AlertState>
          </>
        ))
        .with('chunk', () => (
          <>
            <PageHeader title="화면을 불러오지 못했어요" />
            <AlertState title="새 버전이 배포되었거나 연결이 잠시 끊겼을 수 있어요. 다시 시도해 주세요.">
              <Button variant="primary" onClick={() => window.location.reload()}>
                다시 시도
              </Button>{' '}
              {home}
            </AlertState>
          </>
        ))
        .with('unknown', () => (
          <>
            <PageHeader title="화면을 그리지 못했어요" />
            <AlertState title="잠시 뒤 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.">{home}</AlertState>
          </>
        ))
        .exhaustive()}
    </Page>
  )
}

/** 화면 코드를 받지 못한 오류는 새로 고치면 풀리므로 따로 구분한다 */
function routeErrorKind(error: unknown): RouteErrorKind {
  return match(error)
    .with(P.instanceOf(ChunkLoadError), () => 'chunk' as const)
    .when((e) => isRouteErrorResponse(e) && e.status === 404, () => 'not-found' as const)
    .otherwise(() => 'unknown' as const)
}
