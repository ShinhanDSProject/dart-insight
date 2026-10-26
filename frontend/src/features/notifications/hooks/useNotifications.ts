import { useCallback } from 'react'
import { getNotifications } from '@/shared/api/notifications'
import { useAsync } from '@/shared/hooks/useAsync'

/**
 * 내 분석 완료 알림(6.4). 화면을 옮길 때마다(refreshKey) 다시 받아 읽지 않은 수를 맞춘다.
 * 실시간으로 밀어 주지는 않는다(알림은 최대 6시간 주기 폴링 뒤 분석이 끝나야 생긴다).
 */
export function useNotifications(refreshKey: string) {
  const load = useCallback(
    (signal: AbortSignal) => {
      void refreshKey
      return getNotifications(signal)
    },
    [refreshKey],
  )
  return useAsync(load)
}
