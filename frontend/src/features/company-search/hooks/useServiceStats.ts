import { getServiceStats } from '@/shared/api/serviceStats'
import { useAsync } from '@/shared/hooks/useAsync'

/** 첫 화면 숫자 줄(#866) */
export function useServiceStats() {
  return useAsync(getServiceStats)
}
