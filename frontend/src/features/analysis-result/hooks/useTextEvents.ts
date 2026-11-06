import { useCallback, useMemo, useRef, useState } from 'react'
import { getCurrentEventRun, getSignalTable, getTextEvent, getTextEvents, startEventRun, type TextEventRun } from '@/shared/api/textEvents'
import { useAsync } from '@/shared/hooks/useAsync'
import { usePolling } from '@/shared/hooks/usePolling'
import { eventRunPolling, needsEventStart, textEventsView, type TextEventsView } from '../model/textEvents'

/** 지금 상태를 묻고, 시작할 때면 시작한다. 시작 응답은 상태 조회와 모양이 같다 */
async function currentOrStartedRun(analysisId: number, signal: AbortSignal): Promise<TextEventRun> {
  const run = await getCurrentEventRun(analysisId, signal)
  return needsEventStart(run) ? startEventRun(analysisId, signal) : run
}

export interface TextEvents {
  view: TextEventsView
  /** 실패한 실행은 새로 시작하고, 조회가 실패했으면 다시 조회한다. 실패한 실행은 이 요청으로만 다시 시작한다(ADR-0050) */
  retry: () => void
}

/** 문장 변화 탭을 열면 사건 만들기를 시작하고, 끝나면 사건을 받는다(ADR-0050). 탭의 나머지는 이 값과 상관없이 쓴다 */
export function useTextEvents(analysisId: number): TextEvents {
  // 다음 조회 한 번만 실패한 실행을 새로 시작한다
  const startNext = useRef(false)
  const [retried, setRetried] = useState(false)
  const loadRun = useCallback(
    (signal: AbortSignal) => {
      const start = startNext.current
      startNext.current = false
      return start ? startEventRun(analysisId, signal) : currentOrStartedRun(analysisId, signal)
    },
    [analysisId],
  )
  const { state: run, restart } = usePolling(loadRun, eventRunPolling)
  const completed = run.status === 'success' && run.data.status === 'COMPLETED'
  const loadEvents = useMemo(() => (completed ? (signal: AbortSignal) => getTextEvents(analysisId, signal) : null), [completed, analysisId])
  const { state: events } = useAsync(loadEvents)
  const retry = () => {
    startNext.current = run.status === 'success' && run.data.status === 'FAILED'
    setRetried(true)
    restart()
  }
  // 다시 시도를 누른 뒤 첫 응답을 기다리는 동안 자리가 비지 않게 한다
  return { view: retried && run.status === 'loading' ? { status: 'building' } : textEventsView(run, events), retry }
}

/** 지금 사건 버전의 신호 기준표. 안내(signalNotice)와 '기준 보기'에 쓴다 */
export function useSignalTable() {
  return useAsync(getSignalTable)
}

/** 사건 하나와 묶인 변경. '변경 보기'를 처음 누를 때 마운트해 부른다 */
export function useTextEventDetail(analysisId: number, eventId: number) {
  const load = useCallback((signal: AbortSignal) => getTextEvent(analysisId, eventId, signal), [analysisId, eventId])
  return useAsync(load)
}
