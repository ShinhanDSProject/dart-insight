import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'

/** 첫 화면(W-01) 이용 안내(5.6): 생성형 AI 사용, 투자 조언 아님, 출처 */
export function ServiceNotice() {
  return (
    <aside className="notice service-notice" aria-label="이용 안내">
      <p className="service-notice__title">이용 안내</p>
      <ul>
        {SERVICE_NOTICE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  )
}
