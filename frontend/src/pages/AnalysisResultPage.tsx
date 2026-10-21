import { useParams } from 'react-router'

/** W-03 분석 결과. 기능은 3.1(#19)부터 만든다. */
export function AnalysisResultPage() {
  const { analysisId } = useParams()

  return (
    <section className="page">
      <p className="page__step">W-03</p>
      <h1 className="page__title">분석 결과</h1>
      <p className="page__lead">분석 ID {analysisId}</p>
      <div className="placeholder">결과 화면은 3.1(#19)에서 만듭니다.</div>
    </section>
  )
}
