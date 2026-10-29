import { ButtonLink } from '@/shared/ui/Button'

/**
 * 로그인 전 헤더의 '알림' 자리(#493). 로그인했을 때 NotificationMenu가 있는 자리에 같은 모양으로 두고,
 * 알림 목록을 열지 않고 로그인 화면으로 보낸다. 알림 API는 부르지 않는다.
 */
export function NotificationSignInLink() {
  return (
    <ButtonLink to="/login" variant="secondary" aria-label="알림(로그인 필요)">
      알림
    </ButtonLink>
  )
}
