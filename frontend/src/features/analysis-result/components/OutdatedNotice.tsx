import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Button, Notice } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'

const errorMessages: Record<string, string> = {
  ANALYSIS_NOT_COMPARABLE: '비교할 수 없는 보고서 쌍이라 분석을 시작하지 않았어요.',
  REPORT_NOT_FOUND: '보고서를 찾지 못했어요. 보고서 선택으로 돌아가 다시 골라 주세요.',
}

/**
 * 이전 분석 방식(outdated)으로 만든 결과의 안내(#298, ADR-0021). '새 방식으로 다시 분석'은 같은 기업·두 보고서·비교 기준으로
 * 분석을 요청하고, 이미 새 방식 결과가 있으면(reused, COMPLETED) 그 결과로, 아니면 진행 화면으로 간다. 인쇄에서는 숨긴다(print.css).
 */
export function OutdatedNotice({ analysis }: { analysis: Analysis }) {
  const navigate = useNavigate()
  const submit = useAsyncAction<void>()
  // 요청이 끝나 다음 화면으로 넘어가는 동안에도 버튼을 다시 누르지 못하게 한다
  const submitting = submit.state.status === 'loading' || submit.state.status === 'success'

  function reanalyze() {
    void submit.run(async () => {
      const created = await requestAnalysis({
        corpCode: analysis.corpCode,
        currentRceptNo: analysis.current.rceptNo,
        previousRceptNo: analysis.previous.rceptNo,
        basis: analysis.basis,
      })
      navigate(analysisPath(created.analysisId, created.status))
    })
  }

  return (
    <div className="outdated-notice">
      <Notice>
        <p>이 결과는 이전 분석 방식으로 만들었어요. 새 방식은 숫자만 바뀐 문장과 자리만 옮긴 문장을 따로 보여 줘요.</p>
        <Button variant="secondary" onClick={reanalyze} disabled={submitting}>
          {submitting ? '분석을 요청하는 중…' : '새 방식으로 다시 분석'}
        </Button>
      </Notice>
      {match(submit.state)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} messages={errorMessages} />)
        .with({ status: P.union('idle', 'loading', 'success') }, () => null)
        .exhaustive()}
    </div>
  )
}
