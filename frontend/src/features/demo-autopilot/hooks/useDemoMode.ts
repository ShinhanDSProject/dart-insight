import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DEMO_NEXT_STEP_KEY, DEMO_PARAM, DEMO_STORAGE_KEY, demoStartStep, isDemoRequested } from '../model/demoActivation'
import { DEMO_SCENARIO } from '../model/scenario'

function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** 값이 null이면 지운다. 저장소를 쓸 수 없으면 이번 화면에서만 기억한다 */
export function writeDemoStorage(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // 저장소를 쓸 수 없음
  }
}

/**
 * 시연 모드를 켤지 정한다(#967). 주소의 ?demo로 켜면 이 탭에 기억하고 주소에서 지운다(시연 중 주소가 깔끔하게).
 * ?demo=5처럼 단계 번호를 주면 그 단계부터 이어서 시작한다(리허설·중간에 멈췄을 때). 화면이 새로 불리면 남긴 다음 단계부터 이어 간다.
 * Layout에 한 번만 두고, 켜졌을 때만 시연 화면 코드를 받는다.
 */
export function useDemoMode() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const [active, setActive] = useState(() => isDemoRequested(search, readStored(DEMO_STORAGE_KEY)))
  const [startStep, setStartStep] = useState(() => demoStartStep(search, readStored(DEMO_NEXT_STEP_KEY), DEMO_SCENARIO.length))

  useEffect(() => {
    const params = new URLSearchParams(search)
    if (!params.has(DEMO_PARAM)) return
    // 주소로 새로 켜면 남은 진행은 버리고 처음(또는 ?demo=n)부터
    writeDemoStorage(DEMO_STORAGE_KEY, 'on')
    writeDemoStorage(DEMO_NEXT_STEP_KEY, null)
    setActive(true)
    setStartStep(demoStartStep(search, null, DEMO_SCENARIO.length))
    params.delete(DEMO_PARAM)
    navigate({ search: params.toString() }, { replace: true })
  }, [search, navigate])

  const exit = useCallback(() => {
    writeDemoStorage(DEMO_STORAGE_KEY, null)
    writeDemoStorage(DEMO_NEXT_STEP_KEY, null)
    setActive(false)
  }, [])

  return { active, startStep, exit }
}
