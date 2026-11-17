import { match } from 'ts-pattern'
import { formatDuration } from '@/shared/lib/numberFormat'
import { Button } from '@/shared/ui/Button'
import { useKioskIdle } from '../hooks/useKioskIdle'
import { KIOSK_IDLE_PATH, KIOSK_WARNING_SECONDS } from '../model/kioskIdle'
import '../kiosk-idle.css'

/** 기록을 바꿔 끼워 돌아간다. 뒤로 가기로 앞 방문자의 화면이 다시 열리지 않게 */
function goIdle() {
  window.location.replace(KIOSK_IDLE_PATH)
}

/**
 * 시연 부스에서 조작이 seconds 동안 없으면 대기 화면으로 돌아간다(발표 11/18).
 * 돌아가기 전 몇 초 동안 아래에 안내를 띄우고, 화면을 움직이거나 '계속 쓰기'를 누르면 다시 센다.
 */
export function KioskIdleReturn({ seconds }: { seconds: number }) {
  const { phase, stay } = useKioskIdle(seconds, goIdle)

  return match(phase)
    .with({ status: 'warning' }, ({ secondsLeft }) => (
      <div className="kiosk-idle" role="status">
        <p className="kiosk-idle__text">
          {/* 화면 낭독기에는 초마다 읽지 않도록 한 번만 알린다 */}
          <span aria-hidden="true">{formatDuration(secondsLeft)} 뒤 처음 화면으로 돌아가요. 화면을 움직이면 계속 쓸 수 있어요.</span>
          <span className="visually-hidden">{formatDuration(KIOSK_WARNING_SECONDS)} 안에 조작이 없으면 처음 화면으로 돌아가요.</span>
        </p>
        <Button variant="secondary" onClick={stay}>
          계속 쓰기
        </Button>
      </div>
    ))
    .with({ status: 'active' }, { status: 'leave' }, () => null)
    .exhaustive()
}
