import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { browserNotification, decideNotification, permissionState } from '../model/notification'

/**
 * 분석이 끝나면 브라우저 알림을 띄운다(4.3). 권한은 requestPermission을 부를 때(버튼을 누를 때)만 묻는다.
 * notify는 분석이 완료·실패한 순간 부르고, 탭이 숨겨져 있을 때만 분석마다 한 번 알린다.
 */
export function useCompletionNotification() {
  const navigate = useNavigate()
  const [permission, setPermission] = useState(() => permissionState(browserNotification()))
  const notifiedIds = useRef(new Set<number>())

  const requestPermission = useCallback(async () => {
    if (browserNotification() === undefined) return
    try {
      setPermission(permissionState({ permission: await Notification.requestPermission() }))
    } catch {
      // 옛 브라우저는 Promise 대신 콜백만 받는다. 그때는 지금 권한을 다시 읽는다
      setPermission(permissionState(browserNotification()))
    }
  }, [])

  const notify = useCallback(
    (analysis: Analysis) => {
      const decision = decideNotification({
        analysis,
        // 다른 탭에서 권한을 바꿨을 수 있어 알릴 때 다시 읽는다
        permission: permissionState(browserNotification()),
        visibility: document.visibilityState,
        notifiedIds: notifiedIds.current,
      })
      match(decision)
        .with({ type: 'skip' }, () => undefined)
        .with({ type: 'notify' }, ({ title, body, target }) => {
          notifiedIds.current.add(analysis.analysisId)
          try {
            const notification = new Notification(title, { body, tag: `analysis-${analysis.analysisId}` })
            notification.onclick = () => {
              window.focus()
              notification.close()
              match(target)
                .with('result', () => navigate(`/analyses/${analysis.analysisId}`, { replace: true }))
                .with('progress', () => undefined)
                .exhaustive()
            }
          } catch {
            // 모바일 크롬처럼 생성자를 막은 브라우저는 알림 없이 탭 제목으로만 알린다
          }
        })
        .exhaustive()
    },
    [navigate],
  )

  return { permission, requestPermission, notify }
}
