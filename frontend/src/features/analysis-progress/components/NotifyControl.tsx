import { match } from 'ts-pattern'
import { Button, Notice } from '@/shared/ui'
import type { NotificationPermissionState } from '../model/notification'

interface NotifyControlProps {
  permission: NotificationPermissionState
  onRequest: () => void
}

/** '끝나면 알림 받기'(4.3). 권한을 물을 수 없으면 버튼 대신 안내 문구를 보인다 */
export function NotifyControl({ permission, onRequest }: NotifyControlProps) {
  return (
    <div className="progress__notify">
      {match(permission)
        .with('default', () => (
          <Button variant="secondary" onClick={onRequest}>
            끝나면 알림 받기
          </Button>
        ))
        .with('granted', () => (
          <Notice as="p" role="status">
            완료되면 알려 드릴게요. 다른 탭에서 기다려도 돼요.
          </Notice>
        ))
        .with('denied', () => (
          <Notice as="p">알림이 꺼져 있어요. 브라우저 설정에서 이 사이트의 알림을 허용하면 받을 수 있어요.</Notice>
        ))
        .with('unsupported', () => (
          <Notice as="p">이 브라우저는 알림을 지원하지 않아요. 탭 제목에서 진행 상태를 볼 수 있어요.</Notice>
        ))
        .exhaustive()}
    </div>
  )
}
