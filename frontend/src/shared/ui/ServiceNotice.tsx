import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'
import { Notice } from './Notice'

/** 첫 화면(W-01) 이용 안내(5.6): 생성형 AI 사용, 투자 조언 아님, 출처 */
export function ServiceNotice() {
  return (
    <Notice as="aside" className="service-notice" title="이용 안내" aria-label="이용 안내">
      <ul>
        {SERVICE_NOTICE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Notice>
  )
}
