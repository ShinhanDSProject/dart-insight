import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { parseResultParams } from '../model/resultParams'

/** 결과 화면에서 고른 탭·재무제표·보기·근거 위치(주소 쿼리, ST-6) */
export function useResultParams() {
  const { params, update } = useQueryParams()
  return { params: parseResultParams(params), update }
}
