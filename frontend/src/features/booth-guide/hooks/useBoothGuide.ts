import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BOOTH_GUIDE_PARAM, BOOTH_GUIDE_STORAGE_KEY, boothGuideRequest, boothGuideView, type BoothGuideView } from '../model/boothGuide'

function readStored(): string | null {
  try {
    return sessionStorage.getItem(BOOTH_GUIDE_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: BoothGuideView) {
  try {
    sessionStorage.setItem(BOOTH_GUIDE_STORAGE_KEY, value)
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 기억한다
  }
}

/**
 * 부스 안내를 펼칠지·접을지·끌지 정한다. 주소의 ?guide로 정하면 이 탭에 기억하고 주소에서 지운다(시연 모드와 같은 방식).
 * Layout에 한 번만 두고, 켜졌을 때만 안내 카드 코드를 받는다.
 */
export function useBoothGuide(kiosk: boolean) {
  const { search } = useLocation()
  const navigate = useNavigate()
  const [stored, setStored] = useState(readStored)

  useEffect(() => {
    const asked = boothGuideRequest(search)
    if (asked === null) return
    writeStored(asked)
    setStored(asked)
    const params = new URLSearchParams(search)
    params.delete(BOOTH_GUIDE_PARAM)
    navigate({ search: params.toString() }, { replace: true })
  }, [search, navigate])

  const setView = useCallback((view: BoothGuideView) => {
    writeStored(view)
    setStored(view)
  }, [])

  return { view: boothGuideView(stored, kiosk), setView }
}
