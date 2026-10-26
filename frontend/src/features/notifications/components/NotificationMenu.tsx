import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { markNotificationRead, markNotificationUnread, type AnalysisNotification } from '@/shared/api/notifications'
import { Badge, Button } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useNotifications } from '../hooks/useNotifications'
import { notificationDetail, notificationTime, notificationTitle, unreadLabel } from '../model/notificationText'
import '../notifications.css'

interface NotificationMenuProps {
  /** 바뀌면 알림을 다시 받는다(화면 이동) */
  refreshKey: string
}

/**
 * 헤더의 분석 완료 알림(6.4, ADR-0031). 로그인한 회원에게만 보인다.
 * 알림을 누르면 읽음으로 표시하고 그 분석 결과로 간다. 줄마다 읽음·안 읽음으로 바꿀 수 있다.
 */
export function NotificationMenu({ refreshKey }: NotificationMenuProps) {
  const { state, reload } = useNotifications(refreshKey)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const navigate = useNavigate()
  const unread = state.status === 'success' ? state.data.unreadCount : 0

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) close()
  }

  async function openResult(event: MouseEvent<HTMLAnchorElement>, item: AnalysisNotification) {
    event.preventDefault()
    setOpen(false)
    // 읽음 표시가 실패해도 결과로는 간다. 다음에 목록을 받을 때 안 읽음으로 다시 보인다
    if (item.readAt === null) await markNotificationRead(item.notificationId).catch(() => undefined)
    navigate(`/analyses/${item.analysisId}`)
  }

  async function toggleRead(item: AnalysisNotification) {
    const change = item.readAt === null ? markNotificationRead : markNotificationUnread
    await change(item.notificationId).catch(() => undefined)
    reload()
  }

  return (
    <div className="notification-menu" onKeyDown={onKeyDown}>
      <Button
        ref={buttonRef}
        variant="secondary"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread === 0 ? '알림' : `알림, 읽지 않은 알림 ${unread}개`}
        onClick={() => setOpen((v) => !v)}
      >
        {unreadLabel(unread)}
      </Button>
      {open && (
        <section id={panelId} className="notification-menu__panel" aria-label="분석 완료 알림">
          {match(state)
            .with({ status: 'loading' }, () => <LoadingState message="알림을 불러오는 중입니다…" />)
            .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
            .with({ status: 'success' }, ({ data }) =>
              data.items.length === 0 ? (
                <p className="notification-menu__empty">
                  아직 알림이 없어요. 관심 기업에 새 정기보고서가 나오면 전년 동기와 비교 분석해 알려 드려요.
                </p>
              ) : (
                <ul className="notification-menu__list">
                  {data.items.map((item) => (
                    <li key={item.notificationId} className="notification-menu__item">
                      <a href={`/analyses/${item.analysisId}`} onClick={(event) => void openResult(event, item)}>
                        {item.readAt === null && <Badge tone="accent">새 알림</Badge>} {notificationTitle(item)}
                      </a>
                      <span className="notification-menu__meta">
                        {notificationDetail(item)} · <time dateTime={item.createdAt}>{notificationTime(item.createdAt)}</time>
                      </span>
                      <Button variant="link" onClick={() => void toggleRead(item)}>
                        {item.readAt === null ? '읽음으로 표시' : '안 읽음으로 표시'}
                      </Button>
                    </li>
                  ))}
                </ul>
              ),
            )
            .exhaustive()}
        </section>
      )}
    </div>
  )
}
