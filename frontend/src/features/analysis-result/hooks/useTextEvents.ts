import { useCallback, useMemo } from 'react'
import { getCurrentEventRun, getTextEvent, getTextEvents, startEventRun, type TextEventList, type TextEventRun } from '@/shared/api/textEvents'
import { useAsync } from '@/shared/hooks/useAsync'
import { usePolling } from '@/shared/hooks/usePolling'
import { eventRunPolling, needsEventStart } from '../model/textEvents'

/** 지금 상태를 묻고, 시작할 때면 시작한다. 시작 응답은 상태 조회와 모양이 같다 */
async function currentOrStartedRun(analysisId: number, signal: AbortSignal): Promise<TextEventRun> {
  const run = await getCurrentEventRun(analysisId, signal)
  return needsEventStart(run) ? startEventRun(analysisId, signal) : run
}

/** 문장 변화 탭을 열면 사건 만들기를 시작하고, 끝나면 사건을 받는다(ADR-0050). 받은 사건이 없으면 null이고, 탭의 나머지는 이 값과 상관없이 쓴다 */
export function useTextEvents(analysisId: number): TextEventList | null {
  const loadRun = useCallback((signal: AbortSignal) => currentOrStartedRun(analysisId, signal), [analysisId])
  const { state: run } = usePolling(loadRun, eventRunPolling)
  const completed = run.status === 'success' && run.data.status === 'COMPLETED'
  const loadEvents = useMemo(() => (completed ? (signal: AbortSignal) => getTextEvents(analysisId, signal) : null), [completed, analysisId])
  const { state: events } = useAsync(loadEvents)
  return events.status === 'success' ? events.data : null
}

/** 사건 하나와 묶인 변경. '변경 보기'를 처음 누를 때 마운트해 부른다 */
export function useTextEventDetail(analysisId: number, eventId: number) {
  const load = useCallback((signal: AbortSignal) => getTextEvent(analysisId, eventId, signal), [analysisId, eventId])
  return useAsync(load)
}
