import { useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { analysisPath, requestAnalysis } from '@/shared/api/analyses'
import type { ComparabilityRequest } from '@/shared/api/comparability'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { usePinnedChanges } from '../hooks/usePinnedChanges'

/**
 * 문장 변화 탭의 변경 고정(AC25). 브라우저에만 저장하고 확인을 묻지 않는다.
 * 같은 저장소를 쓰므로 문장 변화 탭의 고정 표시·'고정' 보기에 바로 반영된다. 이미 고정했으면 다시 누르지 않는다(풀기는 탭에서).
 */
export function ChatPinAction({ analysisId, changeId, label }: { analysisId: number; changeId: number; label: string }) {
  const pinned = usePinnedChanges(analysisId)
  if (pinned.isPinned(changeId)) {
    return (
      <p className="chat-panel__done" role="status">
        원문 탭의 바뀐 곳에 고정했어요.
      </p>
    )
  }
  return (
    <Button variant="secondary" onClick={() => pinned.toggle(changeId)}>
      {label}
    </Button>
  )
}

/**
 * 분석 요청 확인 버튼(AC18). 에이전트는 요청하지 않고 버튼만 보내며, 누르면 분석을 요청하고 분석 진행 화면(W-02)으로 간다.
 * 이미 있는 분석이면 서버가 그 분석을 돌려주므로 완료됐으면 결과 화면으로 간다. 하루 한도를 넘으면 그 안내를 보인다.
 */
export function ChatRequestAnalysisAction({ request, label }: { request: ComparabilityRequest; label: string }) {
  const navigate = useNavigate()
  const send = useAsyncAction<unknown>()
  const confirm = () => {
    void send.run(async () => {
      const created = await requestAnalysis(request)
      navigate(analysisPath(created.analysisId, created.status))
      return created
    })
  }
  const loading = send.state.status === 'loading'
  return (
    <div className="chat-panel__confirm">
      <Button variant="secondary" disabled={loading} aria-busy={loading} onClick={confirm}>
        {loading ? '요청하는 중…' : label}
      </Button>
      {match(send.state)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} />)
        .with({ status: 'idle' }, { status: 'loading' }, { status: 'success' }, () => null)
        .exhaustive()}
    </div>
  )
}
