import { useLocation } from 'react-router'
import { loginPath } from '@/shared/lib/loginReturn'

/** 로그인한 뒤 지금 보던 화면으로 돌아오는 로그인 주소 */
export function useLoginHref(): string {
  const { pathname, search } = useLocation()
  return loginPath(pathname + search)
}
