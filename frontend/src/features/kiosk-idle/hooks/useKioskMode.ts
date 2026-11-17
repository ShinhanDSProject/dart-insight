import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { KIOSK_PARAM, KIOSK_STORAGE_KEY, kioskRequest, kioskSeconds } from '../model/kioskIdle'

function readStored(): string | null {
  try {
    return sessionStorage.getItem(KIOSK_STORAGE_KEY)
  } catch {
    return null
  }
}

/** 값이 null이면 지운다. 저장소를 쓸 수 없으면 이번 화면에서만 기억한다 */
function writeStored(value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(KIOSK_STORAGE_KEY)
    else sessionStorage.setItem(KIOSK_STORAGE_KEY, value)
  } catch {
    // 저장소를 쓸 수 없음
  }
}

/** 발표 페이지 안(전환 장면의 iframe)에서 도는 앱에는 켜지 않는다 */
function isFramed(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * 대기 화면으로 돌아가기를 켤지 정한다. 주소의 ?kiosk로 켜면 이 탭에 기억하고 주소에서 지운다(?kiosk=off면 끈다).
 * 기다릴 초를 돌려주고, 꺼져 있으면 null이다. Layout에 한 번만 둔다.
 */
export function useKioskMode(): number | null {
  const { search } = useLocation()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState<number | null>(() =>
    isFramed()
      ? null
      : match(kioskRequest(search))
          .with({ kind: 'on' }, (request) => request.seconds)
          .with({ kind: 'off' }, () => null)
          .with({ kind: 'none' }, () => kioskSeconds(readStored()))
          .exhaustive(),
  )

  useEffect(() => {
    const request = kioskRequest(search)
    if (request.kind === 'none' || isFramed()) return
    match(request)
      .with({ kind: 'on' }, ({ seconds: next }) => {
        writeStored(String(next))
        setSeconds(next)
      })
      .with({ kind: 'off' }, () => {
        writeStored(null)
        setSeconds(null)
      })
      .exhaustive()
    const params = new URLSearchParams(search)
    params.delete(KIOSK_PARAM)
    navigate({ search: params.toString() }, { replace: true })
  }, [search, navigate])

  return seconds
}
