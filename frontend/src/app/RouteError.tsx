import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertState } from '@/shared/ui/StateView'

/** 화면에서 예상하지 못한 오류가 나면 기본 오류 화면 대신 보여 준다. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <section className="page">
      <h1 className="page__title">{notFound ? '페이지를 찾을 수 없어요' : '화면을 그리지 못했어요'}</h1>
      <AlertState title={notFound ? '주소를 확인해 주세요.' : '잠시 뒤 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.'}>
        <Link to="/">기업 검색으로 돌아가기</Link>
      </AlertState>
    </section>
  )
}
