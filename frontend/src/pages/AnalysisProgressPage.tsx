import { useParams } from 'react-router'

/** W-02 분석 진행. 기능은 2.3(#14)에서 만든다. */
export function AnalysisProgressPage() {
  const { analysisId } = useParams()

  return (
    <section className="page">
      <p className="page__step">W-02</p>
      <h1 className="page__title">분석 진행</h1>
      <p className="page__lead">분석 ID {analysisId}</p>
      <div className="placeholder">진행 단계 표시는 2.3(#14)에서 만듭니다.</div>
    </section>
  )
}
