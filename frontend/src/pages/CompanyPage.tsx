import { useParams } from 'react-router'

/** W-01 ②·③ 보고서 선택과 비교 검증. 기능은 1.2·2.1·2.2에서 만든다. */
export function CompanyPage() {
  const { corpCode } = useParams()

  return (
    <section className="page">
      <p className="page__step">W-01 ②·③</p>
      <h1 className="page__title">보고서 선택</h1>
      <p className="page__lead">
        고유번호 <code>{corpCode}</code>
      </p>
      <div className="placeholder">보고서 목록과 비교 검증은 1.2(#9), 2.1(#12), 2.2(#13)에서 만듭니다.</div>
    </section>
  )
}
